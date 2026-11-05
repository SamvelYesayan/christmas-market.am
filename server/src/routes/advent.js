// Christmas Calendar — 31 Days of Gifts (public API). Rules: services/calendar.js.
// The browser never tells the server what day it is: "today" is the server clock in Asia/Yerevan.
import { Router } from 'express';
import { z } from 'zod';
import { one, many } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { publicGrant, syncPioneerPoints } from '../services/rewards.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { loc } from '../i18n/index.js';
import {
  GRAND_DAY, SOURCE, TOTAL_DAYS, VALID_CLAIM_SQL, calendarClock, claimDay, dayStatus, doorOptions, grandEligibility,
} from '../services/calendar.js';

const r = Router();

/** What a customer sees after claiming: the gift text, product, game link and personal reward. */
async function giftContent(door, optionKey, grant) {
  const base = loc(door);
  const option = optionKey ? doorOptions(door).find((o) => o.key === optionKey) : null;
  const g = option ? loc(option) : base;
  const payload = (option ? option.payload : door.payload) ?? {};
  const content = { kind: (option?.kind ?? door.kind), title: g.title, description: g.description ?? (option ? null : base.description) ?? null };
  const story = g.story ?? payload.story;
  const text = g.text ?? payload.text;
  if (story) content.story = story;
  if (text) content.text = text;
  if (payload.game) content.game = payload.game;
  if (payload.product_slug) {
    const p = await one(`${PRODUCT_CARD_SQL} WHERE p.slug=$1 AND p.is_active`, [payload.product_slug]);
    if (p) content.product = productCard(p);
  }
  if (option?.image_url || door.image_url) content.image = option?.image_url ?? door.image_url;
  if (grant) content.reward = publicGrant(grant);
  return content;
}

async function loadState(userId, clock) {
  const doors = await many('SELECT * FROM advent_doors WHERE year=$1 ORDER BY day', [clock.year]);
  const claims = userId ? await many(
    `SELECT d.day, ao.option_key, ao.outcome, ao.opened_at FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id
      WHERE ao.user_id=$1 AND d.year=$2 AND ${VALID_CLAIM_SQL}`, [userId, clock.year]) : [];
  const grants = userId ? await many(
    `SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id = g.coupon_id
      WHERE g.user_id=$1 AND g.source=$2 AND g.source_ref LIKE $3`, [userId, SOURCE, `${clock.year}-%`]) : [];
  const giftsTaken = await many(
    `SELECT door_id, count(*)::int AS n FROM advent_openings WHERE outcome='gift' AND door_id = ANY($1::int[]) GROUP BY door_id`,
    [doors.filter((d) => d.max_claims).map((d) => d.id)]);
  return {
    doors: new Map(doors.map((d) => [d.day, d])),
    claims: new Map(claims.map((c) => [c.day, c])),
    grants: new Map(grants.map((g) => [Number(g.source_ref.split('-')[1]), g])),
    taken: new Map(giftsTaken.map((t) => [t.door_id, t.n])),
  };
}

async function publicDay(day, state, clock, signedIn) {
  const door = state.doors.get(day);
  const claim = state.claims.get(day);
  const claimedDays = new Set(state.claims.keys());
  let status = dayStatus(day, clock.day, claimedDays);
  if (!signedIn && status === 'missed') status = 'closed';
  const isGrand = day === GRAND_DAY;
  const out = { day, status, isGrand, isToday: day === clock.day, art: door?.art ?? (isGrand ? 'star' : 'gift') };
  // Locked windows keep their secret — except the Grand Prize, which everyone may admire.
  if (status === 'locked' && !isGrand) return out;
  const configured = !!door?.is_available;
  out.configured = configured;
  if (door && (configured || isGrand)) {
    const l = loc(door);
    Object.assign(out, { title: l.title, teaser: l.teaser ?? null, description: l.description ?? null, image: door.image_url ?? null });
  }
  if (status === 'available' && configured) {
    out.options = doorOptions(door).map((o) => { const lo = loc(o); return { key: o.key, title: lo.title, description: lo.description ?? null, image: o.image_url ?? null }; });
    if (door.max_claims) out.giftsLeft = Math.max(0, door.max_claims - (state.taken.get(door.id) ?? 0));
  }
  if (claim) out.received = { outcome: claim.outcome, claimedAt: claim.opened_at, content: door && claim.outcome !== 'check_in' && claim.outcome !== 'sold_out' ? await giftContent(door, claim.option_key, state.grants.get(day)) : null };
  return out;
}

r.get('/', ah(async (req, res) => {
  const clock = calendarClock();
  const state = await loadState(req.user?.id, clock);
  const days = await Promise.all(Array.from({ length: TOTAL_DAYS }, (_, i) => publicDay(i + 1, state, clock, !!req.user)));
  const claimed = new Set(state.claims.keys());
  res.json({
    year: clock.year, today: clock.today, todayDay: clock.phase === 'during' ? clock.day : null, phase: clock.phase,
    signedIn: !!req.user,
    progress: { completed: claimed.size, total: TOTAL_DAYS },
    grand: req.user ? grandEligibility(clock.day, claimed) : null,
    days,
  });
}));

// The body is strict: a date, year or any other field is rejected, and `day` must be the server's today.
const claimSchema = z.object({ day: z.number().int().min(1).max(TOTAL_DAYS), optionKey: z.string().max(40).optional() }).strict();

r.post('/claim', requireAuth, validate({ body: claimSchema }), ah(async (req, res) => {
  const result = await claimDay(req.user.id, req.body);
  if (result.grant?.points) syncPioneerPoints(req.user.id).catch(() => {});
  const clock = calendarClock();
  const state = await loadState(req.user.id, clock);
  res.status(201).json({
    day: req.body.day,
    outcome: result.outcome,
    window: await publicDay(req.body.day, state, clock, true),
    progress: { completed: state.claims.size, total: TOTAL_DAYS },
    grand: grandEligibility(clock.day, new Set(state.claims.keys())),
    achievements: result.achievements,
  });
}));

export default r;
