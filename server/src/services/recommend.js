// Gift Finder and personal recommendation scoring. Transparent, rule-based scoring so every
// recommendation can explain itself ("Because they love cozy evenings").
import { many } from '../db.js';
import { PRODUCT_CARD_SQL } from './catalog.js';
import { currentLocale } from '../i18n/index.js';

const LABELS_EN = {
  interests: { decor: 'decorating', cozy: 'cozy evenings', magic: 'magic', cooking: 'the kitchen', reading: 'stories', fashion: 'style', games: 'play', music: 'music', outdoors: 'the outdoors', crafts: 'making things' },
  personalities: { dreamer: 'dreamers', classic: 'classic souls', playful: 'playful spirits', elegant: 'elegant taste', adventurous: 'adventurers', cozy: 'homebodies' },
  occasions: { christmas: 'Christmas morning', new_year: 'New Year', secret_santa: 'Secret Santa', thank_you: 'saying thank you', family: 'family time' },
};
const LABELS_HY = {
  interests: { decor: 'զարդարելը', cozy: 'հարմարավետ երեկոները', magic: 'կախարդանքը', cooking: 'խոհանոցը', reading: 'պատմությունները', fashion: 'ոճը', games: 'խաղերը', music: 'երաժշտությունը', outdoors: 'բնությունը', crafts: 'ձեռքի աշխատանքը' },
  personalities: { dreamer: 'երազողների', classic: 'դասական ճաշակի տերերի', playful: 'խաղասերների', elegant: 'նրբաճաշակների', adventurous: 'արկածասերների', cozy: 'տնասերների' },
  occasions: { christmas: 'Սուրբ Ծննդյան առավոտի', new_year: 'Ամանորի', secret_santa: 'Գաղտնի Ձմեռ պապի', thank_you: 'շնորհակալություն հայտնելու', family: 'ընտանեկան հավաքի' },
};
const REASON = {
  en: { love: (x) => `Because they love ${x}`, made: (x) => `Made for ${x}`, perfect: (x) => `Perfect for ${x}` },
  hy: { love: (x) => `Քանի որ սիրում է ${x}`, made: (x) => `Ստեղծված է ${x} համար`, perfect: (x) => `Կատարյալ է ${x} համար` },
};

const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

export function scoreProduct(p, a) {
  const attrs = p.attributes ?? {};
  let score = 0;
  const reasons = [];
  const L = currentLocale() === 'hy' ? LABELS_HY : LABELS_EN;
  const R = REASON[currentLocale()] ?? REASON.en;
  if (a.recipient && has(attrs.recipients, a.recipient)) { score += 4; }
  if (a.age && has(attrs.ages, a.age)) { score += 2.5; }
  for (const i of a.interests ?? []) {
    if (has(attrs.interests, i)) { score += 2.5; reasons.push(R.love(L.interests[i] ?? i)); }
  }
  if (a.personality && has(attrs.personalities, a.personality)) {
    score += 2; reasons.push(R.made(L.personalities[a.personality] ?? a.personality));
  }
  if (a.occasion && has(attrs.occasions, a.occasion)) {
    score += 1.5; reasons.push(R.perfect(L.occasions[a.occasion] ?? a.occasion));
  }
  if (a.atmosphere && has(attrs.atmospheres, a.atmosphere)) score += 1.5;
  if (a.magic && p.is_magic) score += 2;
  if (p.is_featured) score += 0.5;
  score += Math.min(1, (p.sold_count ?? 0) / 200);
  return { score, reasons: reasons.slice(0, 2) };
}

export async function giftFinder(answers) {
  const products = await many(`${PRODUCT_CARD_SQL} WHERE p.is_active AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.stock>0 AND v.is_active)`);
  const max = answers.budget?.max ?? Infinity;
  const min = answers.budget?.min ?? 0;
  const ranked = products
    .map((p) => {
      const price = p.sale_price ?? p.price;
      const { score, reasons } = scoreProduct(p, answers);
      const inBudget = price <= max && price >= min * 0.6;
      return { p, score: inBudget ? score : score - 20, reasons, inBudget };
    })
    .filter((r) => r.score > 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, 9);
  return ranked.map((r, i) => ({ ...r.p, match: Math.min(99, Math.round(60 + r.score * 3)), reasons: r.reasons, inBudget: r.inBudget, isTopPick: i === 0 }));
}

/** Personal recommendations from profile, house, wishlist and order history. */
export async function personalRecommendations(userId, profile, limit = 8) {
  const prefs = profile?.preferences ?? {};
  const wished = await many(
    `SELECT DISTINCT p.category_id FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.user_id = $1
     UNION SELECT DISTINCT p.category_id FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE o.user_id = $1`,
    [userId],
  );
  const owned = new Set((await many(
    `SELECT product_id FROM wishlists WHERE user_id=$1 UNION SELECT oi.product_id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=$1`,
    [userId])).map((r) => r.product_id));
  const cats = new Set(wished.map((r) => r.category_id));
  const products = await many(`${PRODUCT_CARD_SQL} WHERE p.is_active`);
  const answers = {
    atmosphere: profile?.atmosphere,
    interests: prefs.interests ?? (prefs.favorite ? [{ lights: 'decor', baking: 'cooking', stories: 'reading', snow: 'outdoors', magic: 'magic' }[prefs.favorite] ?? prefs.favorite] : []),
    magic: !!profile?.house_id,
  };
  return products
    .filter((p) => !owned.has(p.id))
    .map((p) => {
      const { score, reasons } = scoreProduct(p, answers);
      return { ...p, score: score + (cats.has(p.category_id) ? 2 : 0), reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
