// DEVELOPMENT-ONLY sandbox. Refused in production by config.js. Every response is labelled sandbox.
// Accepts card codes of 12 digits starting with 9999 and the verification code 1225.
import { query, one, many } from '../../db.js';

export class SandboxPioneerClient {
  mode = 'sandbox';
  configured = true;
  sandbox = true;

  constructor(PioneerError) {
    this.Err = PioneerError;
  }

  async verifyCard(cardCode, verificationCode) {
    const digits = String(cardCode).replace(/\D/g, '');
    if (!/^9999\d{8}$/.test(digits) || verificationCode !== '1225') {
      throw new this.Err('invalid_card', 'Sandbox: use a 12-digit card starting with 9999 and verification code 1225.');
    }
    const cardId = `sandbox-${digits}`;
    await query(
      `INSERT INTO pioneer_sandbox_ledger (card_id, points, type, reference, description)
       VALUES ($1, 500, 'opening', $2, 'Sandbox opening balance') ON CONFLICT (reference) DO NOTHING`,
      [cardId, `opening-${cardId}`],
    );
    return { cardId, maskedNumber: `•••• ${digits.slice(-4)}`, tier: 'Silver Star', holderName: null };
  }

  async getBalance(cardId) {
    const r = await one('SELECT COALESCE(SUM(points),0)::int AS points FROM pioneer_sandbox_ledger WHERE card_id = $1', [cardId]);
    return { points: r.points, tier: r.points >= 1000 ? 'Golden Star' : 'Silver Star' };
  }

  async getHistory(cardId) {
    const rows = await many(
      'SELECT id, created_at, type, points, description FROM pioneer_sandbox_ledger WHERE card_id=$1 ORDER BY created_at DESC, id DESC LIMIT 50',
      [cardId],
    );
    return rows.map((r) => ({ id: String(r.id), date: r.created_at, type: r.type, points: r.points, description: r.description }));
  }

  async creditPoints(cardId, points, reference, description) {
    await query(
      `INSERT INTO pioneer_sandbox_ledger (card_id, points, type, reference, description) VALUES ($1,$2,'credit',$3,$4)
       ON CONFLICT (reference) DO NOTHING`, [cardId, points, reference, description],
    );
    return this.getBalance(cardId);
  }

  async redeemPoints(cardId, points, reference, description) {
    const { points: balance } = await this.getBalance(cardId);
    const existing = await one('SELECT 1 FROM pioneer_sandbox_ledger WHERE reference=$1', [reference]);
    if (!existing && balance < points) throw new this.Err('insufficient_points', 'Not enough Pioneer points.');
    await query(
      `INSERT INTO pioneer_sandbox_ledger (card_id, points, type, reference, description) VALUES ($1,$2,'redeem',$3,$4)
       ON CONFLICT (reference) DO NOTHING`, [cardId, -points, reference, description],
    );
    return this.getBalance(cardId);
  }
}
