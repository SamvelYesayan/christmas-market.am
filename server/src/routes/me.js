import { Router } from 'express';
import { z } from 'zod';
import { one, many, query, pool } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { personalRecommendations } from '../services/recommend.js';
import { productCard } from '../services/catalog.js';
import { publicGrant, stardustBalance } from '../services/rewards.js';
import { adventToday, dateParts } from '../lib/time.js';
import { loc } from '../i18n/index.js';

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  atmosphere: z.enum(['cozy', 'grand', 'enchanted', 'nordic']),
  preferences: z.object({
    favorite: z.string().max(40).optional(),
    tradition: z.string().max(40).optional(),
    giftStyle: z.string().max(40).optional(),
    season: z.string().max(40).optional(),
    interests: z.array(z.string().max(30)).max(10).optional(),
  }).passthrough(),
});

const pickHouse = ({ name, animal, motto }) => ({ name, animal, motto });

export async function loadMe(userId) {
  const user = await one(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.marketing_consent, u.personalization_consent, u.created_at,
            p.display_name, p.atmosphere, p.preferences, p.identity, p.sorted_at,
            h.slug AS house_slug, h.i18n AS house_i18n, h.name AS house_name, h.color AS house_color, h.accent AS house_accent, h.animal AS house_animal, h.motto AS house_motto,
            l.card_masked, l.tier AS pioneer_tier, l.is_sandbox AS pioneer_sandbox
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN houses h ON h.id = p.house_id
       LEFT JOIN pioneer_links l ON l.user_id = u.id AND l.status = 'active'
      WHERE u.id = $1`, [userId]);
  if (!user) return { user: null };
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at,
      consents: { marketing: user.marketing_consent, personalization: user.personalization_consent },
      profile: {
        displayName: user.display_name ?? user.name,
        atmosphere: user.atmosphere,
        preferences: user.preferences ?? {},
        identity: loc(user.identity),
        house: user.house_slug ? { slug: user.house_slug, color: user.house_color, accent: user.house_accent, ...pickHouse(loc({ name: user.house_name, animal: user.house_animal, motto: user.house_motto, i18n: user.house_i18n })) } : null,
      },
      pioneer: user.card_masked ? { cardMasked: user.card_masked, tier: user.pioneer_tier, sandbox: user.pioneer_sandbox } : null,
    },
  };
}

const r = Router();
r.use(requireAuth);

r.put('/profile', validate({ body: profileSchema.partial().extend({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  marketingConsent: z.boolean().optional(),
  personalizationConsent: z.boolean().optional(),
}) }), ah(async (req, res) => {
  const b = req.body;
  await query(
    `UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone),
       marketing_consent = COALESCE($4, marketing_consent), personalization_consent = COALESCE($5, personalization_consent), updated_at = now()
     WHERE id = $1`,
    [req.user.id, b.name ?? null, b.phone ?? null, b.marketingConsent ?? null, b.personalizationConsent ?? null],
  );
  if (b.personalizationConsent === false) {
    // Withdrawing consent erases personalization answers (keeps house — it is part of the game profile).
    await query(`UPDATE user_profiles SET atmosphere=NULL, preferences='{}'::jsonb, updated_at=now() WHERE user_id=$1`, [req.user.id]);
  } else if (b.displayName || b.atmosphere || b.preferences) {
    await query(
      `INSERT INTO user_profiles (user_id, display_name, atmosphere, preferences) VALUES ($1,$2,$3,COALESCE($4,'{}'::jsonb))
       ON CONFLICT (user_id) DO UPDATE SET display_name = COALESCE($2, user_profiles.display_name),
         atmosphere = COALESCE($3, user_profiles.atmosphere), preferences = COALESCE($4, user_profiles.preferences), updated_at = now()`,
      [req.user.id, b.displayName ?? null, b.atmosphere ?? null, b.preferences ?? null],
    );
  }
  if (b.marketingConsent === true) {
    await query(`INSERT INTO newsletter_subscribers (email, name) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET unsubscribed_at=NULL`, [req.user.email, req.user.name]);
  } else if (b.marketingConsent === false) {
    await query(`UPDATE newsletter_subscribers SET unsubscribed_at = now() WHERE email=$1`, [req.user.email]);
  }
  res.json(await loadMe(req.user.id));
}));

r.get('/recommendations', ah(async (req, res) => {
  const profile = await one('SELECT * FROM user_profiles WHERE user_id=$1', [req.user.id]);
  const list = await personalRecommendations(req.user.id, profile);
  res.json({ products: list.map(productCard) });
}));

r.get('/dashboard', ah(async (req, res) => {
  const uid = req.user.id;
  const { year } = dateParts(adventToday());
  const [orders, wishlistCount, grants, coupons, achievements, allAchievements, advent, stardust] = await Promise.all([
    many(`SELECT number, status, payment_status, total, is_test, created_at,
            (SELECT count(*)::int FROM order_items WHERE order_id = o.id) AS item_count
            FROM orders o WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, [uid]),
    one('SELECT count(*)::int AS n FROM wishlists WHERE user_id=$1', [uid]),
    many(`SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id=g.coupon_id WHERE g.user_id=$1 ORDER BY g.created_at DESC LIMIT 30`, [uid]),
    many(`SELECT code, description, type, value, min_subtotal, ends_at, pioneer_only, i18n FROM coupons
            WHERE user_id=$1 AND is_active AND (ends_at IS NULL OR ends_at > now()) AND (max_uses IS NULL OR used_count < max_uses)
            ORDER BY ends_at NULLS LAST`, [uid]),
    many(`SELECT a.key, ua.earned_at FROM user_achievements ua JOIN achievements a ON a.key=ua.achievement_key WHERE ua.user_id=$1`, [uid]),
    many('SELECT key, title, description, icon, i18n FROM achievements ORDER BY key').then((r) => r.map((x) => loc(x))),
    one(`SELECT count(*)::int AS opened FROM advent_openings ao JOIN advent_doors d ON d.id=ao.door_id WHERE ao.user_id=$1 AND d.year=$2`, [uid, year]),
    stardustBalance(pool, uid),
  ]);
  res.json({
    orders: orders.map((o) => ({ number: o.number, status: o.status, paymentStatus: o.payment_status, total: o.total, isTest: o.is_test, createdAt: o.created_at, itemCount: o.item_count })),
    wishlistCount: wishlistCount.n,
    rewards: grants.map(publicGrant),
    coupons: coupons.map((x) => loc(x)).map((c) => ({ code: c.code, description: c.description, type: c.type, value: c.value, minSubtotal: c.min_subtotal, endsAt: c.ends_at, pioneerOnly: c.pioneer_only })),
    achievements: allAchievements.map((a) => ({ ...a, i18n: undefined, earnedAt: achievements.find((x) => x.key === a.key)?.earned_at ?? null })),
    advent: { opened: advent.opened, total: 24 },
    stardust,
  });
}));

export default r;
