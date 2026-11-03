import { Router } from 'express';
import { z } from 'zod';
import { one, many, withTransaction } from '../db.js';
import { ah, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { adventToday, dateParts } from '../lib/time.js';
import { awardAchievement, grantReward, publicGrant, syncPioneerPoints } from '../services/rewards.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { loc } from '../i18n/index.js';

const r = Router();

/** How many doors may be open today: 0 before December, day-of-month in Dec 1–24, 24 after. */
function unlockedThrough() {
  const today = adventToday();
  const { year, month, day } = dateParts(today);
  if (month < 12) return { year, unlocked: 0, today };
  return { year, unlocked: Math.min(24, day), today };
}

async function doorContent(raw, grant) {
  const door = loc(raw);
  const content = { kind: door.kind, title: door.title };
  const story = door.story ?? door.payload.story;
  const text = door.text ?? door.payload.text;
  if (story) content.story = story;
  if (text) content.text = text;
  if (door.payload.game) content.game = door.payload.game;
  if (door.kind === 'product' && door.payload.product_slug) {
    const p = await one(`${PRODUCT_CARD_SQL} WHERE p.slug=$1 AND p.is_active`, [door.payload.product_slug]);
    content.product = productCard(p);
  }
  if (grant) content.reward = publicGrant(grant);
  return content;
}

r.get('/', ah(async (req, res) => {
  const { year, unlocked, today } = unlockedThrough();
  const doors = await many('SELECT * FROM advent_doors WHERE year=$1 ORDER BY day', [year]);
  const opened = req.user
    ? await many(`SELECT d.day, g.*, c.code AS coupon_code FROM advent_openings ao JOIN advent_doors d ON d.id=ao.door_id
                   LEFT JOIN reward_grants g ON g.user_id=ao.user_id AND g.source='advent' AND g.source_ref = d.year || '-' || d.day
                   LEFT JOIN coupons c ON c.id = g.coupon_id
                  WHERE ao.user_id=$1 AND d.year=$2`, [req.user.id, year])
    : [];
  const openedMap = new Map(opened.map((o) => [o.day, o]));
  const list = await Promise.all(doors.map(async (d) => {
    const o = openedMap.get(d.day);
    const state = o ? 'opened' : d.day <= unlocked ? 'available' : 'locked';
    return {
      day: d.day,
      art: d.art,
      state,
      teaser: state === 'locked' ? null : loc(d).teaser,
      content: o ? await doorContent(d, o.id ? o : null) : null,
    };
  }));
  res.json({ year, today, unlockedThrough: unlocked, doors: list, signedIn: !!req.user });
}));

r.post('/:day/open', requireAuth, validate({ params: z.object({ day: z.coerce.number().int().min(1).max(24) }) }), ah(async (req, res) => {
  const { year, unlocked } = unlockedThrough();
  const day = req.params.day;
  if (day > unlocked) throw forbidden(unlocked === 0 ? 'The Clocktower opens on the 1st of December.' : `Patience! Door ${day} opens on ${day} December.`);
  const door = await one('SELECT * FROM advent_doors WHERE year=$1 AND day=$2', [year, day]);
  if (!door) throw notFound('This door has not been prepared yet.');

  const result = await withTransaction(async (db) => {
    await db.query('INSERT INTO advent_openings (user_id, door_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, door.id]);
    const p = door.payload ?? {};
    let reward = null;
    if (door.kind === 'coupon') reward = { kind: 'coupon', coupon: p, title: door.title };
    else if (door.kind === 'points') reward = { kind: 'points', points: p.points, title: door.title };
    else if (door.kind === 'gift' && p.coupon) reward = { kind: 'coupon', coupon: p.coupon, title: door.title };
    let grant = null;
    let created = false;
    if (reward) ({ grant, created } = await grantReward(db, req.user.id, { ...reward, titleHy: door.i18n?.hy?.title, source: 'advent', sourceRef: `${year}-${day}` }));
    const { rows: [{ n }] } = await db.query(
      'SELECT count(*)::int AS n FROM advent_openings ao JOIN advent_doors d ON d.id=ao.door_id WHERE ao.user_id=$1 AND d.year=$2', [req.user.id, year]);
    const achievements = [];
    for (const [need, key] of [[5, 'advent_5'], [12, 'advent_12'], [24, 'advent_24']]) {
      if (n >= need) { const a = await awardAchievement(db, req.user.id, key); if (a) achievements.push(a); }
    }
    return { grant, created, achievements };
  });
  if (result.created && result.grant?.points) syncPioneerPoints(req.user.id).catch(() => {});
  res.json({ day, content: await doorContent(door, result.grant), newReward: result.created, achievements: result.achievements });
}));

export default r;
