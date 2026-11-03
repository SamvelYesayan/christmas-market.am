// Shared product queries / serializers (localized through the request locale).
import { loc } from '../i18n/index.js';

export const PRODUCT_CARD_SQL = `
  SELECT p.id, p.slug, p.name, p.subtitle, p.price, p.sale_price, p.is_featured, p.is_limited, p.is_magic,
         p.is_personalizable, p.tags, p.attributes, p.art, p.sold_count, p.category_id, p.i18n,
         c.slug AS category_slug, c.name AS category_name, c.i18n AS category_i18n,
         (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort LIMIT 1) AS image,
         (SELECT COALESCE(SUM(stock),0)::int FROM product_variants v WHERE v.product_id = p.id AND v.is_active) AS stock,
         (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews r WHERE r.product_id = p.id AND r.is_approved) AS rating
    FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

export const productCard = (raw) => {
  if (!raw) return raw;
  const p = loc(raw);
  const cat = raw.category_slug ? loc({ name: raw.category_name, i18n: raw.category_i18n }) : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    price: p.price,
    salePrice: p.sale_price,
    isFeatured: p.is_featured,
    isLimited: p.is_limited,
    isMagic: p.is_magic,
    isPersonalizable: p.is_personalizable,
    tags: p.tags,
    art: p.art,
    image: p.image,
    stock: p.stock,
    rating: p.rating,
    category: cat ? { slug: raw.category_slug, name: cat.name } : null,
    ...(p.match != null ? { match: p.match, reasons: p.reasons, inBudget: p.inBudget, isTopPick: p.isTopPick } : {}),
    ...(p.reasons && p.match == null ? { reasons: p.reasons } : {}),
  };
};
