// Development safety: a non-production server whose Magical URL is NOT on this machine must never send, retry or
// change a points operation. Runs the real services in this process, configured like a development server pointed
// at a remote Magical. The URL uses the reserved .invalid domain, so no request could ever leave this machine.
// Creates one test user and one test operation; both are removed afterwards. Real data is only read.
process.env.NODE_ENV = 'development';
process.env.MAGICAL_POINTS = 'auto';
process.env.MAGICAL_PIONEER_API_URL = 'https://magical-points-guard.invalid/api/integration/v1';
process.env.MAGICAL_PIONEER_API_KEY = 'mgpc_test_mock_key_0123456789abcdefghijklmnopqrstu';

const { test, after } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { pool } = await import('../src/db.js');
const { pointsAllowed, pointsPolicyNow, hasScope, pioneerHealth, pioneer } = await import('../src/integrations/pioneer/index.js');
const points = await import('../src/services/pioneerPoints.js');

const TAG = `grd${Date.now().toString(36)}`;
let userId;
let opId;

after(async () => {
  if (opId) await pool.query('DELETE FROM pioneer_point_operations WHERE id=$1', [opId]);
  if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  await pool.end();
});

test('a development server with a remote Magical has points blocked', () => {
  assert.equal(pointsAllowed, false);
  assert.equal(pointsPolicyNow.reason, 'non_production_remote');
  assert.equal(pioneer.allowPoints, false);
  pioneerHealth.scopes = ['cards:verify', 'cards:link', 'cards:read', 'rewards:read', 'points:credit', 'points:debit']; // as if Magical granted everything
  assert.equal(hasScope('points:credit'), false, 'granted scopes do not unlock points here');
  assert.equal(hasScope('points:debit'), false);
  assert.equal(hasScope('cards:read'), true, 'card reads are unaffected');
});

test('queued operations are never sent, retried or modified; nothing new is queued', async () => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name) VALUES ($1, 'x-not-a-real-hash', $2) RETURNING id`, [`${TAG}@christmas-market.test`, `Guard ${TAG}`]);
  userId = u.id;
  const { rows: [op] } = await pool.query(
    `INSERT INTO pioneer_point_operations (user_id, customer_id, kind, points, reference, idempotency_key, reason, source, status, next_attempt_at)
     VALUES ($1, $4, 'credit', 15, $2, $3, 'game_reward', 'game_reward', 'pending', now() - interval '1 hour') RETURNING *`,
    [userId, `guard-${TAG}`, `christmas-store:credit:guard-${TAG}`, String(userId)]);
  opId = op.id;
  const snapshot = async () => (await pool.query('SELECT status, attempts, updated_at, next_attempt_at, lease_until, last_error_code FROM pioneer_point_operations WHERE id=$1', [opId])).rows[0];
  const before = await snapshot();

  assert.deepEqual(await points.reconcilePointOperations(), { checked: 0, blocked: true }, 'the background job does nothing');
  await points.sendQueuedCredits(userId);
  const after1 = await points.runOperation(opId);
  assert.equal(after1.status, 'pending');
  assert.deepEqual(await snapshot(), before, 'not claimed, not retried, not changed');

  assert.equal(await points.queueGameCredit(pool, userId, { id: '00000000-0000-0000-0000-000000000000', points: 10, title: 'x' }), null);
  await assert.rejects(points.redeemOffer(userId, '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111'), (e) => e.code === 'redeem_not_enabled' || e.code === 'pioneer_unavailable');
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM pioneer_point_operations WHERE user_id=$1', [userId]);
  assert.equal(rows[0].n, 1, 'no new operation was created');
});
