// Applies the approved Armenian homepage texts and achievement texts to an existing database.
// Only the Armenian overlay (i18n.hy) of these rows changes: no rows are added or removed, English and every
// other field stay as they are. The previous values are saved to ./backups first. Safe to run more than once.
//   npm run content:hy -w server            (production: NODE_ENV=production npm run content:hy -w server)
import fs from 'node:fs';
import path from 'node:path';
import { pool, withTransaction } from '../src/db.js';
import { achievementsHy, contentHy } from './translations-hy.js';

// Homepage blocks: only the approved fields (the rest of each block keeps whatever the admin set).
const BLOCKS = {
  'home.hero': ['title', 'subtitle'],
  'home.newsletter': ['title', 'body'],
};

const dir = process.env.BACKUP_DIR || path.resolve('backups');
fs.mkdirSync(dir, { recursive: true });
const before = {
  content_blocks: (await pool.query('SELECT key, i18n FROM content_blocks WHERE key = ANY($1)', [Object.keys(BLOCKS)])).rows,
  achievements: (await pool.query('SELECT key, i18n FROM achievements WHERE key = ANY($1)', [Object.keys(achievementsHy)])).rows,
};
const file = path.join(dir, `hy-content-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(before, null, 2));
console.log(`Previous Armenian texts saved to ${file}`);

const counts = await withTransaction(async (db) => {
  let blocks = 0;
  let achievements = 0;
  for (const [key, fields] of Object.entries(BLOCKS)) {
    const hy = Object.fromEntries(fields.map((f) => [f, contentHy[key][f]]));
    const r = await db.query(
      `UPDATE content_blocks SET i18n = jsonb_set(i18n, '{hy}', COALESCE(i18n->'hy', '{}'::jsonb) || $2::jsonb) WHERE key = $1`,
      [key, JSON.stringify(hy)]);
    blocks += r.rowCount;
  }
  for (const [key, hy] of Object.entries(achievementsHy)) {
    const r = await db.query(
      `UPDATE achievements SET i18n = jsonb_set(i18n, '{hy}', COALESCE(i18n->'hy', '{}'::jsonb) || $2::jsonb) WHERE key = $1`,
      [key, JSON.stringify(hy)]);
    achievements += r.rowCount;
  }
  return { blocks, achievements };
});
console.log(`✔ Updated the Armenian text of ${counts.blocks} homepage blocks and ${counts.achievements} achievements.`);
await pool.end();
