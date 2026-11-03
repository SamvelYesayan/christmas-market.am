import crypto from 'node:crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomInt = (max) => crypto.randomInt(max);

/** Pick an item by integer weight using a CSPRNG (server-side reward draws). */
export function weightedPick(items, weightKey = 'weight') {
  const total = items.reduce((s, it) => s + Math.max(0, it[weightKey]), 0);
  if (total <= 0) return null;
  let roll = crypto.randomInt(total);
  for (const it of items) {
    roll -= Math.max(0, it[weightKey]);
    if (roll < 0) return it;
  }
  return items[items.length - 1];
}

export function couponCode(prefix = 'MAGIC') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return `${prefix}-${s}`;
}
