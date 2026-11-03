// Creates a compressed logical backup with pg_dump (custom format) into ./backups.
// Schedule it (cron / Task Scheduler) and ship files off-site; see README "Backups".
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.BACKUP_DIR || path.resolve('backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `christmas-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const bin = process.env.PG_DUMP_PATH || 'pg_dump';
const child = spawn(bin, ['--format=custom', '--no-owner', '--file', file, process.env.DATABASE_URL], { stdio: 'inherit' });
child.on('exit', (code) => {
  if (code === 0) {
    console.log(`✔ Backup written to ${file}`);
    const keep = Number(process.env.BACKUP_KEEP || 14);
    const old = fs.readdirSync(dir).filter((f) => f.endsWith('.dump')).sort().slice(0, -keep);
    old.forEach((f) => fs.unlinkSync(path.join(dir, f)));
  } else {
    console.error(`pg_dump exited with ${code}`);
    process.exitCode = 1;
  }
});
