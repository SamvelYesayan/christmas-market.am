import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one, withTransaction, query } from '../db.js';
import { ah, badRequest, conflict, unauthorized } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/security.js';
import { createSession, destroySession } from '../middleware/auth.js';
import { mergeGuestCart } from '../services/cart.js';
import { awardAchievement } from '../services/rewards.js';
import { profileSchema, loadMe } from './me.js';

const r = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
  marketingConsent: z.boolean().default(false),
  personalizationConsent: z.boolean().default(false),
  profile: profileSchema.partial().optional(),
});

r.post('/register', authLimiter, validate({ body: registerSchema }), ah(async (req, res) => {
  const b = req.body;
  const hash = await bcrypt.hash(b.password, 12);
  const userId = await withTransaction(async (db) => {
    const exists = await db.query('SELECT 1 FROM users WHERE email=$1', [b.email]);
    if (exists.rows.length) throw conflict('An account with this email already exists.', 'email_taken');
    const { rows: [u] } = await db.query(
      `INSERT INTO users (email, password_hash, name, marketing_consent, personalization_consent) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [b.email, hash, b.name, b.marketingConsent, b.personalizationConsent],
    );
    const p = b.personalizationConsent ? b.profile ?? {} : {};
    await db.query(
      `INSERT INTO user_profiles (user_id, display_name, atmosphere, preferences) VALUES ($1,$2,$3,$4)`,
      [u.id, p.displayName ?? b.name, p.atmosphere ?? null, p.preferences ?? {}],
    );
    if (b.marketingConsent) {
      await db.query(`INSERT INTO newsletter_subscribers (email, name) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET unsubscribed_at=NULL`, [b.email, b.name]);
    }
    await awardAchievement(db, u.id, 'first_snow');
    await mergeGuestCart(db, req, res, u.id);
    return u.id;
  });
  const mobile = await createSession(res, req, userId);
  res.status(201).json({ ...(await loadMe(userId)), ...(mobile ? { session: mobile } : {}) });
}));

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

// Equalise timing between unknown email and wrong password.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', 12);

r.post('/login', authLimiter, validate({ body: loginSchema }), ah(async (req, res) => {
  const user = await one('SELECT id, password_hash, is_active FROM users WHERE email=$1', [req.body.email]);
  const ok = await bcrypt.compare(req.body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('That email and password do not match.');
  if (!user.is_active) throw unauthorized('This account has been disabled. Please contact us.');
  await withTransaction((db) => mergeGuestCart(db, req, res, user.id));
  await query('UPDATE users SET last_login_at = now() WHERE id=$1', [user.id]);
  await query('DELETE FROM sessions WHERE user_id=$1 AND expires_at < now()', [user.id]);
  const mobile = await createSession(res, req, user.id);
  res.json({ ...(await loadMe(user.id)), ...(mobile ? { session: mobile } : {}) });
}));

r.post('/logout', ah(async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
}));

r.get('/me', ah(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json(await loadMe(req.user.id));
}));

const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(200) });

r.post('/password', authLimiter, validate({ body: passwordSchema }), ah(async (req, res) => {
  if (!req.user) throw unauthorized();
  const u = await one('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await bcrypt.compare(req.body.currentPassword, u.password_hash))) throw badRequest('Current password is incorrect.', 'wrong_password');
  await query('UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1', [req.user.id, await bcrypt.hash(req.body.newPassword, 12)]);
  await query('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
  const mobile = await createSession(res, req, req.user.id);
  res.json({ ok: true, ...(mobile ? { session: mobile } : {}) });
}));

export default r;
