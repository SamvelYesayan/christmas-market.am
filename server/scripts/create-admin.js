// Usage: npm run admin:create -- --email you@example.com --name "Head Elf"
// The password is read interactively (hidden) or from ADMIN_PASSWORD for automated provisioning.
import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { pool } from '../src/db.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string', default: 'Head Elf' } } });
if (!values.email) {
  console.error('Usage: npm run admin:create -- --email you@example.com [--name "Head Elf"]');
  process.exit(1);
}

async function askHidden(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => rl.output.write(s.includes(prompt) ? s : '*');
  return new Promise((resolve) => rl.question(prompt, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); }));
}

const password = process.env.ADMIN_PASSWORD || (await askHidden('Admin password (min 10 chars): '));
if (!password || password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
const { rows } = await pool.query(
  `INSERT INTO users (email, password_hash, name, role, personalization_consent)
   VALUES ($1,$2,$3,'admin',true)
   ON CONFLICT (email) DO UPDATE SET role='admin', password_hash=EXCLUDED.password_hash, is_active=true
   RETURNING id, email`,
  [values.email, hash, values.name],
);
await pool.query('INSERT INTO user_profiles (user_id, display_name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, values.name]);
console.log(`✔ Admin ready: ${rows[0].email}`);
await pool.end();
