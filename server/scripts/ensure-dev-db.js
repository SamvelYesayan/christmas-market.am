// Development only: `npm run dev` starts the local .devdb PostgreSQL cluster if it is not already running.
// That cluster is not a Windows service, so it does not come back after a restart, and the site then opens with no
// data. This only ever runs `pg_ctl start` on an existing .devdb folder: it never creates, changes or removes data,
// does nothing for any other DATABASE_URL, and never blocks the dev server (the API reports 503 if the database is down).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = path.join(root, '.devdb');
const say = (m) => console.log(`[dev-db] ${m}`);

function target() {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return { host: u.hostname, port: Number(u.port || 5432) };
  } catch {
    return null;
  }
}

const isListening = (port) => new Promise((resolve) => {
  const s = net.connect({ host: '127.0.0.1', port });
  s.setTimeout(1500);
  s.once('connect', () => { s.destroy(); resolve(true); });
  s.once('timeout', () => { s.destroy(); resolve(false); });
  s.once('error', () => resolve(false));
});

/** pg_ctl of the same major version as the cluster: the standard Windows install folder, otherwise PATH. */
function pgCtl() {
  const version = fs.readFileSync(path.join(dataDir, 'PG_VERSION'), 'utf8').trim();
  const windows = path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PostgreSQL', version, 'bin', 'pg_ctl.exe');
  return fs.existsSync(windows) ? windows : 'pg_ctl';
}

async function main() {
  const db = target();
  if (process.env.NODE_ENV === 'production' || !db || !['localhost', '127.0.0.1', '::1'].includes(db.host)) return;
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) return; // Docker or another local setup
  if (await isListening(db.port)) return;
  say(`PostgreSQL is not running on port ${db.port}; starting .devdb…`);
  await new Promise((resolve) => {
    // After an unclean shutdown PostgreSQL syncs its files and replays its log first, which can take a minute or more.
    execFile(pgCtl(), ['-D', dataDir, '-o', `-p ${db.port}`, '-l', path.join(dataDir, 'server.log'), '-w', '-t', '180', 'start'], { windowsHide: true, timeout: 200_000 }, (err) => {
      if (err) say(`could not start it (${err.message.split('\n')[0]}). See .devdb/server.log.`);
      else say('PostgreSQL is ready.');
      resolve();
    });
  });
}

await main().catch((err) => say(`skipped: ${err.message}`));
