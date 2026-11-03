// Games, hidden objects and daily challenges. The client only reports what happened;
// the server decides whether it is plausible and what (if anything) it is worth.
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { one, many, pool, withTransaction } from '../db.js';
import { ah, badRequest, conflict, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gameLimiter } from '../middleware/security.js';
import { localDate, storeToday } from '../lib/time.js';
import { weightedPick } from '../lib/crypto.js';
import { awardAchievement, getRule, grantReward, publicGrant, syncPioneerPoints } from '../services/rewards.js';
import { loc, tr } from '../i18n/index.js';

const r = Router();
const today = () => storeToday();
const sync = (userId, grant) => { if (grant?.points) syncPioneerPoints(userId).catch(() => {}); };

async function playsToday(db, userId, game) {
  const { rows: [x] } = await db.query(
    `SELECT count(*)::int AS n FROM game_sessions WHERE user_id=$1 AND game_key=$2 AND ${localDate('started_at')} = $3::date`,
    [userId, game, today()]);
  return x.n;
}

r.get('/games', ah(async (req, res) => {
  const games = (await many('SELECT key, title, description, config, i18n FROM games WHERE is_active ORDER BY sort')).map((x) => loc(x));
  const rules = Object.fromEntries((await many('SELECT key, config FROM reward_rules')).map((x) => [x.key, x.config]));
  let plays = {};
  let daily = {};
  if (req.user) {
    plays = Object.fromEntries((await many(
      `SELECT game_key, count(*)::int AS n FROM game_sessions WHERE user_id=$1 AND ${localDate('started_at')} = $2::date GROUP BY game_key`,
      [req.user.id, today()])).map((x) => [x.game_key, x.n]));
    daily = Object.fromEntries((await many(
      `SELECT source FROM reward_grants WHERE user_id=$1 AND source IN ('wheel','mystery') AND source_ref=$2`, [req.user.id, today()])).map((x) => [x.source, true]));
  }
  res.json({
    games: games.map((g) => {
      const rule = rules[`game:${g.key}`] ?? {};
      const limit = rule.plays_per_day ?? rule.spins_per_day ?? rule.opens_per_day ?? null;
      const used = g.key === 'wheel' || g.key === 'mystery' ? (daily[g.key] ? 1 : 0) : plays[g.key] ?? 0;
      return { key: g.key, title: g.title, description: g.description, playsPerDay: limit, playsToday: used };
    }),
  });
}));

// ───────── Session games: catch, tree ─────────
const SESSION_GAMES = ['catch', 'tree'];

r.post('/games/:game(catch|tree)/start', requireAuth, gameLimiter, ah(async (req, res) => {
  const game = req.params.game;
  if (!SESSION_GAMES.includes(game)) throw notFound();
  const rule = await getRule(pool, `game:${game}`);
  if (!rule) throw notFound('This game is resting today.');
  const session = await withTransaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${req.user.id}:${game}`]);
    if ((await playsToday(db, req.user.id, game)) >= (rule.plays_per_day ?? 5)) {
      throw conflict('You have played all your rounds for today. Come back tomorrow!', 'daily_limit');
    }
    const { rows: [s] } = await db.query(
      'INSERT INTO game_sessions (user_id, game_key, seed) VALUES ($1,$2,$3) RETURNING id, seed, started_at',
      [req.user.id, game, crypto.randomInt(1, 2 ** 31 - 1)]);
    return s;
  });
  res.status(201).json({ sessionId: session.id, seed: session.seed, rules: { durationSeconds: game === 'catch' ? 45 : null } });
}));

const finishSchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().min(0).max(100000).default(0),
  state: z.object({ ornaments: z.array(z.object({ type: z.string().max(20), x: z.number(), y: z.number() })).max(80).optional(), catches: z.number().int().min(0).max(1000).optional() }).default({}),
});

r.post('/games/:game(catch|tree)/finish', requireAuth, gameLimiter, validate({ body: finishSchema }), ah(async (req, res) => {
  const game = req.params.game;
  if (!SESSION_GAMES.includes(game)) throw notFound();
  const rule = await getRule(pool, `game:${game}`);
  const out = await withTransaction(async (db) => {
    const { rows: [s] } = await db.query('SELECT * FROM game_sessions WHERE id=$1 AND user_id=$2 AND game_key=$3 FOR UPDATE', [req.body.sessionId, req.user.id, game]);
    if (!s) throw notFound('Game session not found.');
    if (s.finished_at) throw conflict('This round is already finished.', 'already_finished');
    const duration = (Date.now() - new Date(s.started_at).getTime()) / 1000;
    let accepted = 0;
    let flag = null;
    let points = 0;
    if (game === 'catch') {
      const maxScore = Math.floor(Math.min(duration, rule.max_duration_s) * rule.max_score_per_second);
      if (duration < rule.min_duration_s) flag = 'round too short';
      else if (duration > rule.max_duration_s + 30) flag = 'round too long';
      else if (req.body.score > maxScore) flag = `score ${req.body.score} exceeds plausible ${maxScore}`;
      accepted = flag ? 0 : req.body.score;
      const { rows: [earned] } = await db.query(
        `SELECT COALESCE(SUM(points),0)::int AS p FROM reward_grants WHERE user_id=$1 AND source='game:catch' AND ${localDate('created_at')} = $2::date`,
        [req.user.id, today()]);
      points = Math.min(Math.floor(accepted / 10) * rule.points_per_10_score, rule.max_points_per_play, Math.max(0, rule.max_points_per_day - earned.p));
    } else if (game === 'tree') {
      const count = req.body.state.ornaments?.length ?? 0;
      if (duration < rule.min_duration_s) flag = 'decorated too fast';
      else if (count < 5) flag = 'not enough decorations';
      accepted = flag ? 0 : count;
      const { rows: [already] } = await db.query(
        `SELECT 1 FROM reward_grants WHERE user_id=$1 AND source='game:tree' AND source_ref=$2`, [req.user.id, today()]);
      points = flag || already ? 0 : rule.points;
    }
    await db.query('UPDATE game_sessions SET finished_at=now(), score=$2, accepted_score=$3, state=$4, flagged=$5, flag_reason=$6 WHERE id=$1',
      [s.id, req.body.score, accepted, req.body.state, !!flag, flag]);
    let grant = null;
    if (points > 0) {
      ({ grant } = await grantReward(db, req.user.id, {
        source: `game:${game}`, sourceRef: game === 'tree' ? today() : s.id, kind: 'points', points,
        title: game === 'catch' ? `Caught ${Math.floor(accepted / 10)} gifts` : 'Decorated a Christmas tree',
        titleHy: game === 'catch' ? `Բռնեցիր ${Math.floor(accepted / 10)} նվեր` : 'Զարդարեցիր տոնածառը',
      }));
    }
    const achievement = game === 'catch' && accepted >= 150 ? await awardAchievement(db, req.user.id, 'catch_master') : null;
    return { accepted, flagged: !!flag, reward: publicGrant(grant), achievement };
  });
  sync(req.user.id, out.reward);
  res.json({ acceptedScore: out.accepted, flagged: out.flagged, reward: out.reward, achievement: out.achievement,
    message: out.flagged ? tr('The elves could not verify this round, so no points this time.') : out.reward ? null : tr('Great round! Today’s points are already in your pocket.') });
}));

// ───────── Quiz ─────────
r.post('/games/quiz/start', requireAuth, gameLimiter, ah(async (req, res) => {
  const rule = await getRule(pool, 'game:quiz');
  const s = await withTransaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${req.user.id}:quiz`]);
    if ((await playsToday(db, req.user.id, 'quiz')) >= rule.plays_per_day) throw conflict('You have already taken today’s quiz. New questions tomorrow!', 'daily_limit');
    const { rows: qs } = await db.query('SELECT id FROM quiz_questions WHERE is_active ORDER BY random() LIMIT $1', [rule.questions]);
    if (qs.length === 0) throw notFound('The quiz master is still writing questions.');
    const { rows: [row] } = await db.query(
      `INSERT INTO game_sessions (user_id, game_key, seed, state) VALUES ($1,'quiz',0,$2) RETURNING id`,
      [req.user.id, { questionIds: qs.map((q) => q.id), answered: [], correct: 0 }]);
    return { id: row.id, ids: qs.map((q) => q.id) };
  });
  const questions = (await many('SELECT id, question, options, i18n FROM quiz_questions WHERE id = ANY($1)', [s.ids])).map((x) => loc(x));
  const byId = new Map(questions.map((q) => [q.id, q]));
  res.status(201).json({ sessionId: s.id, questions: s.ids.map((id) => ({ id, question: byId.get(id).question, options: byId.get(id).options })) });
}));

r.post('/games/quiz/answer', requireAuth, gameLimiter,
  validate({ body: z.object({ sessionId: z.string().uuid(), questionId: z.number().int(), answer: z.number().int().min(0).max(5) }) }),
  ah(async (req, res) => {
    const rule = await getRule(pool, 'game:quiz');
    const out = await withTransaction(async (db) => {
      const { rows: [s] } = await db.query(`SELECT * FROM game_sessions WHERE id=$1 AND user_id=$2 AND game_key='quiz' FOR UPDATE`, [req.body.sessionId, req.user.id]);
      if (!s || s.finished_at) throw notFound('Quiz session not found or finished.');
      const st = s.state;
      const expected = st.questionIds[st.answered.length];
      if (expected !== req.body.questionId) throw badRequest('Please answer the questions in order.');
      const { rows: [qRaw] } = await db.query('SELECT answer_index, fun_fact, i18n FROM quiz_questions WHERE id=$1', [expected]);
      const q = loc(qRaw);
      const correct = q.answer_index === req.body.answer;
      st.answered.push(req.body.answer);
      if (correct) st.correct += 1;
      const done = st.answered.length === st.questionIds.length;
      let grant = null;
      let bonus = null;
      let achievement = null;
      if (done) {
        await db.query('UPDATE game_sessions SET state=$2, finished_at=now(), score=$3, accepted_score=$3 WHERE id=$1', [s.id, st, st.correct]);
        if (st.correct > 0) {
          ({ grant } = await grantReward(db, req.user.id, { source: 'game:quiz', sourceRef: s.id, kind: 'points', points: st.correct * rule.points_per_correct, title: `Winter Quiz: ${st.correct}/${st.questionIds.length}`, titleHy: `Ձմեռային վիկտորինա՝ ${st.correct}/${st.questionIds.length}` }));
        }
        if (st.correct === st.questionIds.length && rule.perfect_coupon) {
          ({ grant: bonus } = await grantReward(db, req.user.id, { source: 'game:quiz-perfect', sourceRef: s.id, kind: 'coupon', coupon: rule.perfect_coupon, title: 'Perfect quiz: a scholar’s discount', titleHy: 'Անթերի վիկտորինա․ գիտնականի զեղչ' }));
          achievement = await awardAchievement(db, req.user.id, 'quiz_perfect');
        }
      } else {
        await db.query('UPDATE game_sessions SET state=$2 WHERE id=$1', [s.id, st]);
      }
      return { correct, correctIndex: q.answer_index, funFact: q.fun_fact, done, score: st.correct, total: st.questionIds.length, reward: publicGrant(grant), bonus: publicGrant(bonus), achievement };
    });
    sync(req.user.id, out.reward);
    res.json(out);
  }));

// ───────── Wheel & mystery box (server picks the outcome) ─────────
async function drawDaily(req, { source, table, title }) {
  const items = await many(`SELECT * FROM ${table} WHERE is_active ORDER BY id`);
  if (!items.length) throw notFound('Nothing to win today — check back soon.');
  return withTransaction(async (db) => {
    const { rows: [existing] } = await db.query('SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id=g.coupon_id WHERE g.user_id=$1 AND g.source=$2 AND g.source_ref=$3', [req.user.id, source, today()]);
    if (existing) throw conflict(source === 'wheel' ? 'You have already spun the wheel. Come back tomorrow!' : 'You have already opened today’s box. Come back tomorrow!', 'daily_limit');
    const item = weightedPick(items);
    const hyItem = item.i18n?.hy ?? {};
    const reward = { source, sourceRef: today(), title: `${title}: ${item.label}`, titleHy: `${source === 'wheel' ? 'Ամանորյա անիվ' : 'Խորհրդավոր արկղ'}՝ ${hyItem.label ?? item.label}`, payload: { label: item.label, itemId: item.id, rarity: item.rarity } };
    if (item.kind === 'points') Object.assign(reward, { kind: 'points', points: item.payload.points });
    else if (item.kind === 'coupon') Object.assign(reward, { kind: 'coupon', coupon: item.payload });
    else Object.assign(reward, { kind: 'message', payload: { ...reward.payload, text: item.payload.text, i18n: { hy: { title: reward.titleHy, text: hyItem.text } } } });
    const { grant } = await grantReward(db, req.user.id, reward);
    return { item, grant, index: items.findIndex((x) => x.id === item.id) };
  });
}

r.get('/games/wheel', ah(async (req, res) => {
  const segments = (await many('SELECT id, label, color, i18n FROM wheel_segments WHERE is_active ORDER BY id')).map((x) => loc(x)).map(({ i18n, ...s }) => s);
  const spun = req.user ? await one(`SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id=g.coupon_id WHERE g.user_id=$1 AND g.source='wheel' AND g.source_ref=$2`, [req.user.id, today()]) : null;
  res.json({ segments, spunToday: !!spun, lastReward: publicGrant(spun) });
}));

r.post('/games/wheel/spin', requireAuth, gameLimiter, ah(async (req, res) => {
  const { grant, index } = await drawDaily(req, { source: 'wheel', table: 'wheel_segments', title: 'Christmas Wheel' });
  sync(req.user.id, grant);
  res.json({ segmentIndex: index, reward: publicGrant(grant) });
}));

r.get('/games/mystery', ah(async (req, res) => {
  const opened = req.user ? await one(`SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id=g.coupon_id WHERE g.user_id=$1 AND g.source='mystery' AND g.source_ref=$2`, [req.user.id, today()]) : null;
  res.json({ openedToday: !!opened, lastReward: publicGrant(opened) });
}));

r.post('/games/mystery/open', requireAuth, gameLimiter, ah(async (req, res) => {
  const { grant, item } = await drawDaily(req, { source: 'mystery', table: 'mystery_rewards', title: 'Mystery Box' });
  sync(req.user.id, grant);
  res.json({ rarity: item.rarity, reward: publicGrant(grant) });
}));

// ───────── Hidden objects ─────────
r.get('/hidden', ah(async (req, res) => {
  const objects = (await many('SELECT key, name, hint, location, points, i18n FROM hidden_objects WHERE is_active ORDER BY key')).map((x) => loc(x)).map(({ i18n, ...o }) => o);
  const found = req.user ? new Set((await many('SELECT object_key FROM hidden_finds WHERE user_id=$1', [req.user.id])).map((x) => x.object_key)) : new Set();
  res.json({ objects: objects.map((o) => ({ ...o, found: found.has(o.key) })) });
}));

r.post('/hidden/:key/find', requireAuth, gameLimiter, validate({ params: z.object({ key: z.string().max(40) }) }), ah(async (req, res) => {
  const obj = await one('SELECT * FROM hidden_objects WHERE key=$1 AND is_active', [req.params.key]);
  if (!obj) throw notFound();
  const out = await withTransaction(async (db) => {
    const { rowCount } = await db.query('INSERT INTO hidden_finds (user_id, object_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, obj.key]);
    if (!rowCount) return { alreadyFound: true };
    const { grant } = await grantReward(db, req.user.id, { source: 'hidden', sourceRef: obj.key, kind: 'points', points: obj.points, title: `Found ${obj.name}`, titleHy: `Գտար՝ ${obj.i18n?.hy?.name ?? obj.name}` });
    const { rows: [c] } = await db.query(
      'SELECT (SELECT count(*) FROM hidden_finds WHERE user_id=$1)::int AS found, (SELECT count(*) FROM hidden_objects WHERE is_active)::int AS total', [req.user.id]);
    const achievement = c.found >= c.total ? await awardAchievement(db, req.user.id, 'hidden_all') : null;
    return { alreadyFound: false, reward: publicGrant(grant), found: c.found, total: c.total, achievement };
  });
  sync(req.user.id, out.reward);
  res.json({ name: loc(obj).name, ...out });
}));

// ───────── Daily challenges ─────────
async function challengeProgress(db, userId, ch) {
  const t = today();
  const q = async (sql, params) => (await db.query(sql, params)).rows[0];
  switch (ch.kind) {
    case 'open_advent': return !!(await q(`SELECT 1 FROM advent_openings WHERE user_id=$1 AND ${localDate('opened_at')} = $2::date`, [userId, t]));
    case 'play_game': return !!(await q(`SELECT 1 FROM game_sessions WHERE user_id=$1 AND game_key=$2 AND finished_at IS NOT NULL AND NOT flagged AND ${localDate('started_at')} = $3::date`, [userId, ch.target.game ?? 'catch', t]));
    case 'wishlist_count': return (await q('SELECT count(*)::int AS n FROM wishlists WHERE user_id=$1', [userId])).n >= (ch.target.count ?? 3);
    case 'quiz_score': return !!(await q(`SELECT 1 FROM game_sessions WHERE user_id=$1 AND game_key='quiz' AND accepted_score >= $2 AND ${localDate('started_at')} = $3::date`, [userId, ch.target.min ?? 5, t]));
    case 'find_hidden': return (await q('SELECT count(*)::int AS n FROM hidden_finds WHERE user_id=$1', [userId])).n >= (ch.target.count ?? 1);
    case 'visit_academy': return !!(await q('SELECT 1 FROM user_profiles WHERE user_id=$1 AND house_id IS NOT NULL', [userId]));
    default: return false;
  }
}

r.get('/challenges/today', ah(async (req, res) => {
  const list = (await many('SELECT * FROM challenges WHERE date=$1::date AND is_active ORDER BY id', [today()])).map((x) => loc(x));
  const out = await Promise.all(list.map(async (c) => {
    const claimed = req.user ? !!(await one('SELECT 1 FROM challenge_completions WHERE user_id=$1 AND challenge_id=$2', [req.user.id, c.id])) : false;
    const complete = req.user && !claimed ? await challengeProgress(pool, req.user.id, c) : claimed;
    return { id: c.id, title: c.title, description: c.description, kind: c.kind, target: c.target, rewardPoints: c.reward_points, complete, claimed };
  }));
  res.json({ date: today(), challenges: out });
}));

r.post('/challenges/:id/claim', requireAuth, gameLimiter, validate({ params: z.object({ id: z.coerce.number().int() }) }), ah(async (req, res) => {
  const out = await withTransaction(async (db) => {
    const { rows: [c] } = await db.query('SELECT * FROM challenges WHERE id=$1 AND date=$2::date AND is_active', [req.params.id, today()]);
    if (!c) throw notFound('This challenge is not active today.');
    if (!(await challengeProgress(db, req.user.id, c))) throw badRequest('Not quite yet — complete the challenge first!', 'not_complete');
    const { rowCount } = await db.query('INSERT INTO challenge_completions (user_id, challenge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, c.id]);
    if (!rowCount) throw conflict('Already claimed.', 'already_claimed');
    let grant = null;
    if (c.reward_points > 0) ({ grant } = await grantReward(db, req.user.id, { source: 'challenge', sourceRef: String(c.id), kind: 'points', points: c.reward_points, title: `Challenge: ${c.title}`, titleHy: `Մարտահրավեր՝ ${c.i18n?.hy?.title ?? c.title}` }));
    if (c.reward_coupon) await grantReward(db, req.user.id, { source: 'challenge-coupon', sourceRef: String(c.id), kind: 'coupon', coupon: c.reward_coupon, title: `Challenge reward: ${c.title}` });
    return publicGrant(grant);
  });
  sync(req.user.id, out);
  res.json({ ok: true, reward: out });
}));

export default r;
