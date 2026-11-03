// Reference data required by the application in every environment (idempotent).
// Demo catalog/customers live in seed-demo.js and are flagged is_demo.
import { pool, withTransaction } from '../src/db.js';
import { achievementsHy, categoriesHy, contentHy, gamesHy, hiddenHy, housesHy, zonesHy } from './translations-hy.js';

export const houses = [
  {
    slug: 'emberwyn', name: 'Emberwyn', motto: 'Kindle what is kind.', animal: 'Fox', element: 'Hearthfire',
    color: '#c8102e', accent: '#f2c46d', virtues: ['courage', 'warmth', 'spontaneity'],
    description: 'Emberwyn foxes are the first to the bonfire and the last to leave it. They carry the warmth of the hearth into the coldest night and turn strangers into friends before the cocoa cools.',
  },
  {
    slug: 'pinehollow', name: 'Pinehollow', motto: 'Root deep, reach high.', animal: 'Stag', element: 'Evergreen',
    color: '#0f6b4f', accent: '#cfe8c9', virtues: ['loyalty', 'patience', 'care'],
    description: 'Pinehollow stags keep the old traditions alive. They remember every birthday, bake for the whole street and stand by you through the longest winter.',
  },
  {
    slug: 'starloom', name: 'Starloom', motto: 'We weave the light we find.', animal: 'Luna Moth', element: 'Starlight',
    color: '#2a4fa8', accent: '#a9c7ff', virtues: ['curiosity', 'imagination', 'wisdom'],
    description: 'Starloom moths are drawn to every glimmer of wonder. They map constellations, invent new carols and always know which book you secretly need.',
  },
  {
    slug: 'aurelith', name: 'Aurelith', motto: 'Shine, and let others shine.', animal: 'Snow Lynx', element: 'Aurora',
    color: '#b8860b', accent: '#fff1c9', virtues: ['ambition', 'generosity', 'grace'],
    description: 'Aurelith lynxes move quietly and dream loudly. They plan the most dazzling celebrations and make sure everyone at the table leaves with a gift.',
  },
];

export const categories = [
  ['christmas-trees', 'Christmas Trees', 'Evergreens that hold the whole season', 'tree', '#0f6b4f'],
  ['decorations', 'Decorations', 'Garlands, wreaths and winter scenes', 'wreath', '#c8102e'],
  ['lights', 'Christmas Lights', 'Strings of warm, captured starlight', 'lights', '#f2c46d'],
  ['ornaments', 'Ornaments', 'Hand-finished glass and wood keepsakes', 'ornament', '#c8102e'],
  ['gift-boxes', 'Gift Boxes', 'Curated boxes, wrapped with a bow', 'giftbox', '#c8102e'],
  ['gifts-children', 'Gifts for Children', 'Wonder-sized presents', 'teddy', '#2a4fa8'],
  ['gifts-parents', 'Gifts for Parents', 'Thank-you in a wrapped box', 'mug', '#0f6b4f'],
  ['gifts-friends', 'Gifts for Friends', 'For the people who feel like home', 'candle', '#f2c46d'],
  ['personalized', 'Personalized Gifts', 'Engraved, embroidered, entirely theirs', 'scroll', '#b8860b'],
  ['magical-gifts', 'Magical Gifts', 'Snowglobes, lanterns and small wonders', 'snowglobe', '#2a4fa8'],
  ['academy', 'Frostspire Academy', 'Original wizarding-school merchandise', 'wand', '#2a4fa8'],
  ['clothing', 'Christmas Clothing', 'Knits for snowy evenings', 'sweater', '#c8102e'],
  ['accessories', 'Accessories', 'Scarves, mittens and festive little things', 'scarf', '#0f6b4f'],
  ['limited', 'Limited Collections', 'Made once, for this Christmas only', 'star', '#f2c46d'],
];

const shippingZones = [
  ['yerevan', 'Yerevan courier', 'Delivered by our elves across Yerevan', 1500, 30000, '1–2 days', true, 1],
  ['yerevan_express', 'Yerevan express', 'Same-day delivery when ordered before 14:00', 3500, null, 'Same day', true, 2],
  ['armenia', 'Regions of Armenia', 'Haypost / courier to every marz', 3000, 60000, '2–4 days', true, 3],
  ['pickup', 'Pickup from the Market', 'Collect from our Christmas pavilion', 0, null, 'From tomorrow', false, 4],
];

const games = [
  ['catch', 'Catch the Falling Gifts', 'Steer the sleigh and catch presents before they hit the snow.', 1],
  ['tree', 'Decorate Your Tree', 'Hang ornaments, string lights and crown it with a star.', 2],
  ['mystery', 'Mystery Gift Box', 'One enchanted box a day. What will it hold?', 3],
  ['quiz', 'The Winter Quiz', 'Seven questions about Christmas across the world.', 4],
  ['hidden', 'Hidden Wonders', 'Seven magical objects are hidden around the village.', 5],
  ['wheel', 'The Christmas Wheel', 'Spin once a day for points and surprises.', 6],
];

const rewardRules = {
  'game:catch': { min_duration_s: 20, max_duration_s: 75, max_score_per_second: 5, points_per_10_score: 1, max_points_per_play: 30, max_points_per_day: 60, plays_per_day: 6 },
  'game:tree': { points: 15, plays_per_day: 1, min_duration_s: 15 },
  'game:quiz': { questions: 7, points_per_correct: 5, plays_per_day: 1, perfect_coupon: { type: 'percent', value: 10, min_subtotal: 15000, valid_days: 7 } },
  'game:wheel': { spins_per_day: 1 },
  'game:mystery': { opens_per_day: 1 },
  sorting: { points: 25 },
};

const achievements = [
  ['first_snow', 'First Snow', 'Stepped through the Lantern Gate.', 'snowflake'],
  ['sorted', 'Sorted!', 'Joined a house at Frostspire Academy.', 'crest'],
  ['first_order', 'Sleigh Loaded', 'Placed your first order.', 'sleigh'],
  ['advent_5', 'Five Doors', 'Opened five Advent doors.', 'door'],
  ['advent_12', 'Halfway to Christmas', 'Opened twelve Advent doors.', 'door'],
  ['advent_24', 'Every Door Opened', 'Opened all 24 Advent doors.', 'star'],
  ['catch_master', 'Sleigh Master', 'Scored 150+ in Catch the Falling Gifts.', 'gift'],
  ['quiz_perfect', 'Snow Scholar', 'Answered every quiz question correctly.', 'book'],
  ['hidden_all', 'Keen Eyes', 'Found every hidden wonder.', 'eye'],
  ['pioneer_linked', 'Pioneer', 'Linked a Magical Pioneer Card.', 'card'],
  ['wish_maker', 'Wish Maker', 'Added five wishes to your wishlist.', 'heart'],
];

const hiddenObjects = [
  ['golden-acorn', 'The Golden Acorn', 'Somewhere in the village square, under the tallest tree.', '/', 10],
  ['silver-key', 'The Silver Key', 'A market stall keeper dropped it near the awnings.', '/shop', 10],
  ['moon-feather', 'The Moon Feather', 'It drifted through the academy gates.', '/academy', 15],
  ['lost-mitten', 'The Lost Mitten', 'Left behind on the clocktower.', '/advent', 10],
  ['tiny-reindeer', 'The Tiny Reindeer', 'It loves following the compass of wishes.', '/gift-finder', 10],
  ['compass-star', 'The Compass Star', 'Kept in the Pioneer Lodge.', '/pioneer', 10],
  ['sugar-quill', 'The Sugar Quill', 'Someone at the Frost Fair was writing with it.', '/games', 10],
];

const contentBlocks = {
  'home.hero': {
    eyebrow: 'Christmas Market · Yerevan · Since the first snow',
    title: 'Step inside the snowglobe',
    subtitle: 'A winter village where every lantern leads to a gift, every door hides a surprise, and the magic knows your name.',
    cta: 'Wander into the market',
  },
  'home.chapters': {
    tree: { title: 'The Wishing Tree', body: 'Touch an ornament and make a wish. Some of them come true at checkout.' },
    stalls: { title: 'The Market Stalls', body: 'Fourteen stalls, each kept by a different elf with a very particular taste.' },
    academy: { title: 'Beyond the frozen gate', body: 'Frostspire Academy opens its doors once a year. The sorting stone is waiting.' },
    pioneer: { title: 'The Pioneer Lodge', body: 'Holders of the Magical Pioneer Card gather by a fire that never goes out.' },
    finder: { title: 'The Compass of Wishes', body: 'Tell it who you love. It will point to the right gift.' },
    advent: { title: 'The Clocktower', body: 'Twenty-four doors. One opens each morning.' },
  },
  'home.newsletter': { title: 'Letters from the North', body: 'One warm letter a week until Christmas: new collections, Advent hints and Pioneer-only evenings.' },
  'site.footer': { tagline: 'Made with snow, starlight and a little Armenian hospitality.', address: 'Christmas Market pavilion, Yerevan', phone: '+374 00 000 000', email: 'hello@christmas-market.am' },
};

/** Merge Armenian overlays into i18n.hy (keeps any edits to other locales). */
export async function applyHy(client, table, keyCol, map) {
  for (const [key, hy] of Object.entries(map)) {
    await client.query(`UPDATE ${table} SET i18n = i18n || jsonb_build_object('hy', $2::jsonb) WHERE ${keyCol} = $1`, [key, JSON.stringify(hy)]);
  }
}

export async function seedBase(client) {
  for (const h of houses) {
    await client.query(
      `INSERT INTO houses (slug,name,motto,animal,element,color,accent,virtues,description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, motto=EXCLUDED.motto, animal=EXCLUDED.animal,
         element=EXCLUDED.element, color=EXCLUDED.color, accent=EXCLUDED.accent, virtues=EXCLUDED.virtues, description=EXCLUDED.description`,
      [h.slug, h.name, h.motto, h.animal, h.element, h.color, h.accent, h.virtues, h.description],
    );
  }
  let i = 0;
  for (const [slug, name, tagline, art, color] of categories) {
    await client.query(
      `INSERT INTO categories (slug,name,tagline,art,color,sort) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO NOTHING`, [slug, name, tagline, art, color, i++],
    );
  }
  for (const [code, name, description, price, freeOver, eta, requiresAddress, sort] of shippingZones) {
    await client.query(
      `INSERT INTO shipping_zones (code,name,description,price,free_over,eta,requires_address,sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING`,
      [code, name, description, price, freeOver, eta, requiresAddress, sort],
    );
  }
  for (const [key, title, description, sort] of games) {
    await client.query(
      `INSERT INTO games (key,title,description,sort) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING`,
      [key, title, description, sort],
    );
  }
  for (const [key, cfg] of Object.entries(rewardRules)) {
    await client.query(`INSERT INTO reward_rules (key, config) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [key, cfg]);
  }
  for (const [key, title, description, icon] of achievements) {
    await client.query(
      `INSERT INTO achievements (key,title,description,icon) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, icon=EXCLUDED.icon`,
      [key, title, description, icon],
    );
  }
  for (const [key, name, hint, location, points] of hiddenObjects) {
    await client.query(
      `INSERT INTO hidden_objects (key,name,hint,location,points) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING`,
      [key, name, hint, location, points],
    );
  }
  for (const [key, data] of Object.entries(contentBlocks)) {
    await client.query(`INSERT INTO content_blocks (key, data) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [key, data]);
  }
  await applyHy(client, 'houses', 'slug', housesHy);
  await applyHy(client, 'categories', 'slug', categoriesHy);
  await applyHy(client, 'shipping_zones', 'code', zonesHy);
  await applyHy(client, 'games', 'key', gamesHy);
  await applyHy(client, 'achievements', 'key', achievementsHy);
  await applyHy(client, 'hidden_objects', 'key', hiddenHy);
  for (const [key, hy] of Object.entries(contentHy)) {
    await client.query(`UPDATE content_blocks SET i18n = i18n || jsonb_build_object('hy', $2::jsonb) WHERE key = $1 AND NOT (i18n ? 'hy')`, [key, JSON.stringify(hy)]);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('seed-base.js')) {
  await withTransaction(seedBase);
  console.log('✔ Base reference data seeded.');
  await pool.end();
}
