import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { crudRouter } from './crud.js';
import products from './products.js';
import orders from './orders.js';
import customers from './customers.js';
import analytics from './analytics.js';

const r = Router();
r.use(requireRole('admin'));

const ts = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable();
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const couponSpec = z.object({ type: z.enum(['percent', 'fixed', 'free_shipping']), value: z.number().int().min(0), min_subtotal: z.number().int().min(0).default(0), valid_days: z.number().int().min(1).max(365).default(7) });

r.use('/products', products);
r.use('/orders', orders);
r.use('/customers', customers);
r.use('/analytics', analytics);

r.use('/categories', crudRouter('categories', {
  pkType: 'int', orderBy: 'sort, name', search: ['name', 'slug'],
  schema: z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).max(60), name: z.string().min(1).max(80), tagline: z.string().max(200).nullable().optional(), description: z.string().max(2000).nullable().optional(), art: z.string().max(30), color: hex, sort: z.number().int(), is_active: z.boolean() }),
}));

r.use('/coupons', crudRouter('coupons', {
  orderBy: 'created_at DESC', search: ['code', 'description', 'source'],
  schema: z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/), description: z.string().max(200).nullable().optional(),
    type: z.enum(['percent', 'fixed', 'free_shipping']), value: z.number().int().min(0), min_subtotal: z.number().int().min(0),
    max_discount: z.number().int().min(0).nullable().optional(), max_uses: z.number().int().min(1).nullable().optional(),
    per_user_limit: z.number().int().min(1), pioneer_only: z.boolean(), starts_at: ts.optional(), ends_at: ts.optional(), is_active: z.boolean(),
  }), // percent values are capped at 100 in pricing.couponDiscount
}));

r.use('/campaigns', crudRouter('campaigns', {
  orderBy: 'created_at DESC', search: ['name', 'headline'],
  schema: z.object({ name: z.string().min(1).max(100), headline: z.string().min(1).max(200), body: z.string().max(2000).nullable().optional(), coupon_code: z.string().max(40).nullable().optional(), pioneer_only: z.boolean(), starts_at: ts.optional(), ends_at: ts.optional(), art: z.string().max(30), color: hex, is_active: z.boolean() }),
}));

r.use('/banners', crudRouter('banners', {
  orderBy: 'placement, sort',
  schema: z.object({ placement: z.string().max(40), title: z.string().min(1).max(200), subtitle: z.string().max(300).nullable().optional(), cta_label: z.string().max(60).nullable().optional(), cta_link: z.string().max(300).regex(/^\/|^https:\/\//).nullable().optional(), image_url: z.string().max(500).nullable().optional(), art: z.string().max(30).nullable().optional(), sort: z.number().int(), is_active: z.boolean() }),
}));

r.use('/events', crudRouter('christmas_events', {
  orderBy: 'starts_at',
  schema: z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).nullable().optional(), location: z.string().max(200).nullable().optional(), starts_at: ts, ends_at: ts.optional(), is_active: z.boolean() }),
}));

r.use('/advent', crudRouter('advent_doors', {
  pkType: 'int', orderBy: 'year DESC, day', jsonCols: ['payload'],
  schema: z.object({ year: z.number().int().min(2024).max(2100), day: z.number().int().min(1).max(24), title: z.string().min(1).max(120), teaser: z.string().max(200).nullable().optional(), kind: z.enum(['coupon', 'points', 'product', 'gift', 'minigame', 'challenge', 'story']), payload: z.record(z.any()), art: z.string().max(30) }),
}));

r.use('/challenges', crudRouter('challenges', {
  pkType: 'int', orderBy: 'date DESC', jsonCols: ['target', 'reward_coupon'],
  schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(1).max(120), description: z.string().min(1).max(500), kind: z.enum(['open_advent', 'play_game', 'wishlist_count', 'quiz_score', 'find_hidden', 'visit_academy']), target: z.record(z.any()), reward_points: z.number().int().min(0).max(1000), reward_coupon: couponSpec.nullable().optional(), is_active: z.boolean() }),
}));

r.use('/games', crudRouter('games', {
  pk: 'key', pkType: 'text', orderBy: 'sort', jsonCols: ['config'],
  schema: z.object({ key: z.string().max(20), title: z.string().min(1).max(120), description: z.string().max(500).nullable().optional(), is_active: z.boolean(), config: z.record(z.any()), sort: z.number().int() }),
}));

r.use('/quiz', crudRouter('quiz_questions', {
  pkType: 'int', orderBy: 'id', jsonCols: ['options'], search: ['question'],
  schema: z.object({ question: z.string().min(5).max(300), options: z.array(z.string().min(1).max(120)).min(2).max(6), answer_index: z.number().int().min(0).max(5), fun_fact: z.string().max(400).nullable().optional(), is_active: z.boolean() }),
}));

const drawSchema = z.object({ label: z.string().min(1).max(60), kind: z.enum(['points', 'coupon', 'message']), payload: z.record(z.any()), weight: z.number().int().min(0).max(1000), is_active: z.boolean() });
r.use('/wheel', crudRouter('wheel_segments', { pkType: 'int', orderBy: 'id', jsonCols: ['payload'], schema: drawSchema.extend({ color: hex }) }));
r.use('/mystery', crudRouter('mystery_rewards', { pkType: 'int', orderBy: 'id', jsonCols: ['payload'], schema: drawSchema.extend({ rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']) }) }));

r.use('/reward-rules', crudRouter('reward_rules', {
  i18n: false, pk: 'key', pkType: 'text', orderBy: 'key', jsonCols: ['config'],
  schema: z.object({ key: z.string().max(40), config: z.record(z.any()), is_active: z.boolean() }),
}));

r.use('/hidden-objects', crudRouter('hidden_objects', {
  pk: 'key', pkType: 'text', orderBy: 'key',
  schema: z.object({ key: z.string().regex(/^[a-z0-9-]+$/).max(40), name: z.string().max(80), hint: z.string().max(200), location: z.string().max(80), points: z.number().int().min(0).max(500), is_active: z.boolean() }),
}));

r.use('/shipping-zones', crudRouter('shipping_zones', {
  pkType: 'int', orderBy: 'sort',
  schema: z.object({ code: z.string().regex(/^[a-z0-9_]+$/).max(40), name: z.string().max(80), description: z.string().max(300).nullable().optional(), price: z.number().int().min(0), free_over: z.number().int().min(0).nullable().optional(), eta: z.string().max(40).nullable().optional(), requires_address: z.boolean(), sort: z.number().int(), is_active: z.boolean() }),
}));

r.use('/pioneer-offers', crudRouter('pioneer_offers', {
  orderBy: 'created_at DESC',
  schema: z.object({ title: z.string().min(1).max(120), description: z.string().max(500).nullable().optional(), kind: z.enum(['redeem_gift', 'discount', 'exclusive_product']), points_cost: z.number().int().min(1).nullable().optional(), discount_percent: z.number().int().min(1).max(100).nullable().optional(), product_id: z.string().uuid().nullable().optional(), min_tier: z.string().max(40).nullable().optional(), stock: z.number().int().min(0).nullable().optional(), starts_at: ts.optional(), ends_at: ts.optional(), is_active: z.boolean() }),
}));

r.use('/content', crudRouter('content_blocks', {
  pk: 'key', pkType: 'text', orderBy: 'key', jsonCols: ['data'],
  schema: z.object({ key: z.string().regex(/^[a-z0-9._-]+$/).max(60), data: z.record(z.any()) }),
}));

r.use('/reviews', crudRouter('reviews', {
  i18n: false,
  orderBy: 'is_approved, created_at DESC', search: ['author_name', 'body'],
  schema: z.object({ author_name: z.string().max(80), city: z.string().max(80).nullable().optional(), rating: z.number().int().min(1).max(5), body: z.string().max(1500), is_approved: z.boolean(), product_id: z.string().uuid().nullable().optional() }),
}));

r.use('/newsletter', crudRouter('newsletter_subscribers', { i18n: false, pk: 'email', pkType: 'text', orderBy: 'consent_at DESC', search: ['email', 'name'], schema: z.object({ email: z.string().email(), name: z.string().max(80).nullable().optional() }) }));

export default r;
