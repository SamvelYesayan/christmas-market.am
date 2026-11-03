// DEMO DATA — for development and staging only. Every row is flagged is_demo = true.
//   npm run seed:demo            → insert demo catalog, content and a demo customer
//   npm run seed:demo -- --clean → remove all demo rows
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/db.js';
import { applyHy, seedBase } from './seed-base.js';
import * as HY from './translations-hy.js';

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to seed demo data in production (pass --force if you really mean it).');
  process.exit(1);
}

const A = (recipients, ages, interests, personalities, occasions, atmospheres) =>
  ({ recipients, ages, interests, personalities, occasions, atmospheres });
const std = (stock = 40) => [{ name: 'Standard', options: {}, stock }];
const sizes = (stock = 12) => ['S', 'M', 'L', 'XL'].map((s) => ({ name: `Size ${s}`, options: { size: s }, stock }));
const colors = (list, stock = 25) => list.map(([n, hex]) => ({ name: n, options: { color: n, hex }, stock }));

// [slug, name, category, price, sale, subtitle, art, attributes, variants, flags, tags, description, story]
const products = [
  // Trees
  ['nordmann-fir-grand', 'Grand Nordmann Fir', 'christmas-trees', 89000, 79000, 'A full, soft-needled giant for high ceilings',
    { type: 'tree', c1: '#0f6b4f', c2: '#f2c46d' }, A(['self', 'parent'], ['adults'], ['decor'], ['classic', 'elegant'], ['christmas', 'family'], ['grand', 'nordic']),
    [{ name: '180 cm', options: { height: '180 cm' }, stock: 14 }, { name: '210 cm', options: { height: '210 cm' }, price_delta: 18000, stock: 9 }, { name: '240 cm', options: { height: '240 cm' }, price_delta: 36000, stock: 4 }],
    { featured: true }, ['bestseller', 'real-tree'],
    'Hand-selected Nordmann fir with symmetrical, layered branches that hold heavy ornaments without bowing. Delivered with a fresh cut and a water-reservoir stand.',
    'Every grand fir is chosen by our head elf on a frosty morning, tied with red twine, and tagged with the name of the family it will belong to.'],
  ['tabletop-spruce', 'Little Lantern Spruce', 'christmas-trees', 18500, null, 'A potted dwarf spruce for windowsills',
    { type: 'tree', c1: '#1d7a5a', c2: '#c8102e', small: true }, A(['friend', 'colleague', 'self'], ['adults', 'seniors'], ['decor', 'cozy'], ['cozy', 'classic'], ['christmas', 'secret_santa'], ['cozy', 'nordic']),
    std(35), {}, ['small-space'], 'A living dwarf spruce in a hand-glazed ceramic pot, pre-decorated with a tiny warm-light string.', 'It grows a little every year — plant it in spring and it remembers every Christmas.'],
  ['frosted-pine-artificial', 'Frosted Silver Pine', 'christmas-trees', 64000, null, 'Pre-lit artificial pine with hand-flocked snow',
    { type: 'tree', c1: '#5f8f83', c2: '#ffffff', frosted: true }, A(['self', 'parent'], ['adults'], ['decor'], ['elegant', 'dreamer'], ['christmas'], ['nordic', 'enchanted']),
    [{ name: '150 cm', options: { height: '150 cm' }, stock: 12 }, { name: '210 cm', options: { height: '210 cm' }, price_delta: 22000, stock: 8 }],
    {}, ['pre-lit', 'reusable'], 'A reusable pine flocked with soft artificial snow and 400 warm-white micro-lights.', 'It looks as if it has just come in from a snowstorm — and it will, every year, for a decade.'],

  // Decorations
  ['ararat-dawn-wreath', 'Ararat Dawn Wreath', 'decorations', 24000, 21000, 'Pine, dried pomegranate and cinnamon',
    { type: 'wreath', c1: '#0f6b4f', c2: '#c8102e' }, A(['parent', 'grandparent', 'self'], ['adults', 'seniors'], ['decor', 'cozy'], ['classic', 'cozy'], ['christmas', 'family', 'new_year'], ['cozy', 'grand']),
    std(20), { featured: true }, ['handmade', 'armenian'], 'A door wreath of fresh pine bound with dried pomegranate slices, cinnamon sticks and gold-dipped pinecones.', 'Pomegranates have meant abundance in Armenia for millennia. Hang one on your door and the new year knows where to find you.'],
  ['village-snow-scene', 'Midnight Village Scene', 'decorations', 32000, null, 'Light-up porcelain village with falling snow',
    { type: 'snowglobe', c1: '#0b1430', c2: '#f2c46d', scene: 'village' }, A(['parent', 'grandparent', 'child'], ['kids', 'adults', 'seniors'], ['decor', 'magic'], ['dreamer', 'cozy'], ['christmas', 'family'], ['enchanted', 'cozy']),
    std(15), {}, ['light-up'], 'Five porcelain cottages that glow from within, with a gentle snowfall mechanism.', 'Look closely: one window always has someone wrapping a present.'],
  ['velvet-ribbon-garland', 'Velvet Ribbon Garland', 'decorations', 9500, null, '3 m of red velvet, brass bells and pine',
    { type: 'garland', c1: '#c8102e', c2: '#f2c46d' }, A(['self', 'friend'], ['adults'], ['decor'], ['elegant', 'classic'], ['christmas'], ['grand', 'cozy']),
    std(40), {}, [], 'Artificial pine garland wrapped with crushed red velvet ribbon and tiny brass bells that chime when the door opens.', null],

  // Lights
  ['starlight-string-200', 'Captured Starlight · 200', 'lights', 12500, 9900, '200 warm micro-LEDs on copper wire',
    { type: 'lights', c1: '#f2c46d', c2: '#c8102e' }, A(['self', 'friend', 'teen'], ['teens', 'adults'], ['decor', 'cozy'], ['dreamer', 'cozy'], ['christmas', 'secret_santa'], ['cozy', 'enchanted']),
    [{ name: '10 m', options: { length: '10 m' }, stock: 60 }, { name: '20 m', options: { length: '20 m' }, price_delta: 6000, stock: 40 }],
    { featured: true }, ['bestseller'], 'Ultra-fine copper wire with 200 warm micro-LEDs, eight twinkle modes and a timer.', 'Each string is tested in our workshop window on the darkest night of the month.'],
  ['aurora-curtain', 'Aurora Curtain Lights', 'lights', 21000, null, 'Colour-shifting curtain of 300 LEDs',
    { type: 'lights', c1: '#7fe0c4', c2: '#a98bff', curtain: true }, A(['teen', 'self', 'friend'], ['teens', 'adults'], ['decor', 'music'], ['playful', 'dreamer'], ['christmas', 'new_year'], ['enchanted', 'nordic']),
    std(25), {}, ['app-controlled'], 'A 2×2 m window curtain that drifts through northern-light colours, with music-sync mode.', null],
  ['vintage-bulb-festoon', 'Old Square Festoon', 'lights', 16000, null, 'Big amber bulbs for balconies',
    { type: 'lights', c1: '#ffb347', c2: '#0b1430', festoon: true }, A(['parent', 'self'], ['adults'], ['decor', 'outdoors'], ['classic'], ['christmas', 'family'], ['cozy', 'grand']),
    std(30), {}, ['outdoor'], 'Weatherproof festoon with 15 shatterproof amber bulbs — the glow of an old town square.', null],

  // Ornaments
  ['glass-pomegranate', 'Glass Pomegranate', 'ornaments', 6500, null, 'Mouth-blown, hand-painted in Yerevan',
    { type: 'ornament', c1: '#a3122a', c2: '#f2c46d', shape: 'pomegranate' }, A(['parent', 'grandparent', 'friend', 'colleague'], ['adults', 'seniors'], ['decor'], ['elegant', 'classic'], ['christmas', 'thank_you', 'secret_santa'], ['grand', 'cozy']),
    colors([['Ruby', '#a3122a'], ['Gold', '#d4a537'], ['Midnight', '#1b2a5c']], 30), { featured: true }, ['handmade', 'armenian', 'bestseller'],
    'A mouth-blown glass pomegranate, painted by hand with 24-carat gold leaf seeds.', 'Our glassblower makes only twelve a day. She says the thirteenth always cracks.'],
  ['star-of-the-north', 'Star of the North Topper', 'ornaments', 14500, null, 'Brass star with a glowing heart',
    { type: 'star', c1: '#f2c46d', c2: '#fff1c9' }, A(['self', 'parent'], ['adults'], ['decor'], ['classic', 'elegant'], ['christmas', 'family'], ['grand', 'nordic']),
    std(20), {}, ['tree-topper'], 'An eight-pointed brushed-brass tree topper with a warm LED core.', null],
  ['snowflake-set-12', 'Twelve Snowflakes Set', 'ornaments', 8900, 7500, 'Laser-cut birch, each one different',
    { type: 'snowflake', c1: '#f6f8ff', c2: '#a9c7ff' }, A(['friend', 'colleague', 'child'], ['kids', 'adults'], ['decor', 'crafts'], ['dreamer', 'cozy'], ['christmas', 'secret_santa'], ['nordic', 'cozy']),
    std(50), {}, ['wooden', 'eco'], 'Twelve laser-cut birch snowflakes — no two alike, just like the real thing.', null],
  ['family-bauble-set', 'Heirloom Bauble Set', 'ornaments', 19500, null, 'Six velvet-matte glass baubles in a keepsake box',
    { type: 'ornament', c1: '#0f6b4f', c2: '#c8102e', shape: 'bauble' }, A(['parent', 'grandparent', 'partner'], ['adults', 'seniors'], ['decor'], ['classic', 'elegant'], ['christmas', 'family', 'thank_you'], ['grand', 'cozy']),
    colors([['Emerald & Ruby', '#0f6b4f'], ['Midnight & Gold', '#0b1430'], ['Snow & Silver', '#dfe6f5']], 18), {}, ['gift-ready'],
    'Six velvet-finish glass baubles nestled in a ribbon-tied keepsake box.', null],

  // Gift boxes
  ['cozy-night-box', 'The Cozy Night Box', 'gift-boxes', 27500, 24900, 'Candle, cocoa, socks and a story',
    { type: 'giftbox', c1: '#c8102e', c2: '#f2c46d' }, A(['friend', 'partner', 'parent', 'colleague'], ['teens', 'adults', 'seniors'], ['cozy', 'reading'], ['cozy', 'dreamer'], ['christmas', 'secret_santa', 'thank_you'], ['cozy']),
    std(35), { featured: true }, ['bestseller', 'gift-ready'], 'A pine-scented candle, rich Armenian cocoa, wool socks and a short winter tale, wrapped in red.', 'We packed the first Cozy Night Box for a grandmother who said she wanted "nothing at all". She cried, then asked for another.'],
  ['armenian-sweets-box', 'Sweet Yerevan Box', 'gift-boxes', 19000, null, 'Gata, sujukh, dried fruits and tea',
    { type: 'giftbox', c1: '#0f6b4f', c2: '#f2c46d' }, A(['parent', 'grandparent', 'colleague', 'friend'], ['adults', 'seniors'], ['cooking', 'cozy'], ['classic', 'cozy'], ['new_year', 'thank_you', 'family'], ['cozy', 'grand']),
    std(45), {}, ['armenian', 'edible'], 'Traditional gata, walnut sujukh, apricots and mountain thyme tea — the taste of an Armenian New Year table.', null],
  ['spark-of-wonder-box', 'Spark of Wonder Box', 'gift-boxes', 23000, null, 'A box of small magical surprises for kids',
    { type: 'giftbox', c1: '#2a4fa8', c2: '#a9c7ff' }, A(['child'], ['kids'], ['magic', 'games', 'crafts'], ['playful', 'dreamer'], ['christmas', 'family'], ['enchanted']),
    std(30), {}, ['kids'], 'A glow-in-the-dark star kit, a tiny snowglobe, a craft set and a letter from the North.', null],

  // Children
  ['patch-the-reindeer', 'Patch the Reindeer', 'gifts-children', 13500, null, 'A huggable reindeer with a stitched heart',
    { type: 'teddy', c1: '#8a5a3c', c2: '#c8102e' }, A(['child'], ['kids'], ['games', 'cozy'], ['playful', 'cozy'], ['christmas', 'family'], ['cozy', 'enchanted']),
    std(40), { featured: true }, ['bestseller', 'kids'], 'A super-soft plush reindeer with a scarf that comes off and a heart patch stitched by hand.', 'Patch was the reindeer who was too small to pull the sleigh, so he rides in the front and reads the map.'],
  ['star-projector', 'Bedtime Sky Projector', 'gifts-children', 17500, 15500, 'Turns any ceiling into a winter sky',
    { type: 'lantern', c1: '#0b1430', c2: '#a9c7ff', projector: true }, A(['child', 'teen'], ['kids', 'teens'], ['magic', 'reading'], ['dreamer'], ['christmas', 'family'], ['enchanted', 'nordic']),
    std(28), {}, ['kids', 'light-up'], 'A soft-glow lantern that projects slowly turning constellations and falling snow, with lullaby mode.', null],
  ['north-pole-workshop-kit', 'Little Workshop Kit', 'gifts-children', 15000, null, 'Build-your-own wooden sleigh',
    { type: 'sleigh', c1: '#c8102e', c2: '#f2c46d' }, A(['child'], ['kids'], ['crafts', 'games'], ['playful', 'adventurous'], ['christmas'], ['cozy']),
    std(25), {}, ['kids', 'wooden'], 'A beginner wooden kit to assemble and paint a sleigh, with non-toxic paints and a reindeer team.', null],

  // Parents
  ['hearthside-mug-set', 'Hearthside Mug Set', 'gifts-parents', 14000, null, 'Two stoneware mugs with ember glaze',
    { type: 'mug', c1: '#7a2a1e', c2: '#f2c46d' }, A(['parent', 'grandparent', 'partner'], ['adults', 'seniors'], ['cozy', 'cooking'], ['cozy', 'classic'], ['christmas', 'thank_you'], ['cozy']),
    std(30), {}, ['handmade'], 'A pair of hand-thrown stoneware mugs in a deep ember glaze that pools gold at the rim.', null],
  ['family-recipe-book', 'Family Recipe Keepsake', 'gifts-parents', 16500, null, 'Linen-bound book for handed-down recipes',
    { type: 'book', c1: '#0f6b4f', c2: '#f2c46d' }, A(['parent', 'grandparent'], ['adults', 'seniors'], ['cooking', 'reading'], ['classic', 'cozy'], ['christmas', 'family', 'thank_you'], ['cozy', 'grand']),
    std(25), { personalizable: true }, ['personalizable'], 'A linen-bound book with illustrated pages for the recipes your family never wrote down — until now.', null],
  ['cashmere-throw', 'Snowfield Cashmere Throw', 'gifts-parents', 54000, 48000, 'Cashmere-blend throw with frost pattern',
    { type: 'scarf', c1: '#dfe6f5', c2: '#2a4fa8', throw: true }, A(['parent', 'partner', 'grandparent'], ['adults', 'seniors'], ['cozy', 'reading'], ['elegant', 'cozy'], ['christmas', 'thank_you'], ['nordic', 'cozy']),
    std(12), {}, ['luxury'], 'A generous cashmere-blend throw woven with a subtle frost-crystal pattern.', null],

  // Friends
  ['pine-and-ember-candle', 'Pine & Ember Candle', 'gifts-friends', 8500, null, 'Soy candle, 50 hours of fireside',
    { type: 'candle', c1: '#0f6b4f', c2: '#f2c46d' }, A(['friend', 'colleague', 'partner', 'self'], ['teens', 'adults', 'seniors'], ['cozy'], ['cozy', 'dreamer'], ['christmas', 'secret_santa', 'thank_you'], ['cozy', 'nordic']),
    colors([['Pine & Ember', '#0f6b4f'], ['Cinnamon Snow', '#a0522d'], ['Pomegranate Night', '#a3122a']], 50), { featured: true }, ['bestseller'],
    'A wooden-wick soy candle that crackles like a fireplace — notes of pine resin, smoke and orange peel.', null],
  ['secret-santa-surprise', 'Secret Santa Surprise', 'gifts-friends', 6000, null, 'A mystery gift under 6,000 ֏',
    { type: 'giftbox', c1: '#f2c46d', c2: '#c8102e', mystery: true }, A(['friend', 'colleague'], ['teens', 'adults'], ['cozy', 'games'], ['playful'], ['secret_santa'], ['cozy', 'enchanted']),
    std(80), {}, ['mystery'], 'Our elves pick a delightful surprise and wrap it. You get to look innocent.', null],
  ['hot-cocoa-bombs', 'Snowball Cocoa Bombs', 'gifts-friends', 7500, null, 'Six chocolate spheres that bloom in hot milk',
    { type: 'cookie', c1: '#5a3524', c2: '#f6f8ff' }, A(['friend', 'child', 'teen', 'colleague'], ['kids', 'teens', 'adults'], ['cooking', 'cozy'], ['playful', 'cozy'], ['christmas', 'secret_santa'], ['cozy']),
    std(60), {}, ['edible'], 'Six Belgian-chocolate spheres filled with cocoa and marshmallow snow.', null],

  // Personalized
  ['engraved-name-ornament', 'Engraved Name Ornament', 'personalized', 7900, null, 'Brass ornament engraved with any name',
    { type: 'ornament', c1: '#d4a537', c2: '#0b1430', shape: 'disc' }, A(['child', 'partner', 'parent', 'friend', 'grandparent'], ['kids', 'adults', 'seniors'], ['decor'], ['classic', 'cozy'], ['christmas', 'family'], ['grand', 'cozy']),
    std(100), { personalizable: true }, ['personalizable', 'bestseller'], 'A brushed brass disc engraved with a name and the year, on a red velvet ribbon.', 'Hang one for every member of the family and watch the tree turn into a family tree.'],
  ['embroidered-stocking', 'Embroidered Stocking', 'personalized', 12000, null, 'Wool stocking with a hand-stitched name',
    { type: 'stocking', c1: '#c8102e', c2: '#f6f8ff' }, A(['child', 'partner', 'self'], ['kids', 'adults'], ['decor', 'cozy'], ['classic', 'playful'], ['christmas', 'family'], ['cozy']),
    colors([['Ember Red', '#c8102e'], ['Pine Green', '#0f6b4f'], ['Snow White', '#f6f8ff']], 30), { personalizable: true }, ['personalizable'],
    'A knitted wool stocking with your name embroidered in gold thread across the cuff.', null],
  ['letter-from-the-north', 'Letter from the North', 'personalized', 5500, null, 'A personal letter, sealed with wax',
    { type: 'scroll', c1: '#f3e6c8', c2: '#c8102e' }, A(['child'], ['kids'], ['magic', 'reading'], ['dreamer', 'playful'], ['christmas'], ['enchanted', 'cozy']),
    std(500), { personalizable: true }, ['personalizable', 'kids'], 'A hand-calligraphed letter addressed to your child, on aged paper, sealed with red wax and a snowflake stamp.', null],

  // Magical gifts
  ['wishing-snowglobe', 'The Wishing Snowglobe', 'magical-gifts', 22000, null, 'Shake it, make a wish, watch it glow',
    { type: 'snowglobe', c1: '#2a4fa8', c2: '#f2c46d', scene: 'tree' }, A(['child', 'partner', 'friend', 'teen'], ['kids', 'teens', 'adults'], ['magic', 'decor'], ['dreamer'], ['christmas', 'family'], ['enchanted']),
    std(30), { featured: true, magic: true }, ['bestseller', 'light-up'], 'A hand-blown glass globe with a tiny glowing tree; the snow swirls on its own for a minute after you shake it.', 'Legend says if the light flickers three times, your wish has been received.'],
  ['northern-lantern', 'Lantern of Lost Paths', 'magical-gifts', 26000, 23000, 'Wrought lantern with an everlasting flame',
    { type: 'lantern', c1: '#1b2a5c', c2: '#f2c46d' }, A(['partner', 'friend', 'self'], ['adults'], ['magic', 'decor', 'outdoors'], ['adventurous', 'dreamer'], ['christmas', 'new_year'], ['enchanted', 'nordic']),
    std(18), { magic: true }, [], 'An iron lantern with a flickering flameless candle that "breathes" in the dark.', null],
  ['constellation-music-box', 'Constellation Music Box', 'magical-gifts', 18500, null, 'Plays a winter waltz under turning stars',
    { type: 'musicbox', c1: '#0b1430', c2: '#f2c46d' }, A(['child', 'partner', 'grandparent'], ['kids', 'adults', 'seniors'], ['music', 'magic'], ['dreamer', 'elegant'], ['christmas', 'family'], ['enchanted', 'grand']),
    std(22), { magic: true }, [], 'A walnut music box; as it plays, a brass constellation turns and casts stars on the wall.', null],

  // Academy (original designs)
  ['frostspire-wand-birch', 'Frostspire Birch Wand', 'academy', 15500, null, 'Hand-turned birch with a frost-crystal tip',
    { type: 'wand', c1: '#e8dcc4', c2: '#a9c7ff' }, A(['child', 'teen', 'friend'], ['kids', 'teens', 'adults'], ['magic', 'reading'], ['dreamer', 'adventurous'], ['christmas'], ['enchanted']),
    [{ name: 'Birch & Frost', options: { core: 'Frost crystal' }, stock: 30 }, { name: 'Walnut & Ember', options: { core: 'Ember glass' }, stock: 20 }],
    { magic: true }, ['academy'], 'An original Frostspire Academy wand, hand-turned and finished with a resin frost-crystal tip that catches light.', null],
  ['house-scarf', 'Frostspire House Scarf', 'academy', 13000, null, 'Knitted in your house colours',
    { type: 'scarf', c1: '#c8102e', c2: '#f2c46d' }, A(['teen', 'child', 'friend', 'self'], ['kids', 'teens', 'adults'], ['magic', 'fashion'], ['playful', 'dreamer'], ['christmas'], ['enchanted']),
    [{ name: 'Emberwyn', options: { house: 'emberwyn', hex: '#c8102e' }, stock: 25 }, { name: 'Pinehollow', options: { house: 'pinehollow', hex: '#0f6b4f' }, stock: 25 },
     { name: 'Starloom', options: { house: 'starloom', hex: '#2a4fa8' }, stock: 25 }, { name: 'Aurelith', options: { house: 'aurelith', hex: '#b8860b' }, stock: 25 }],
    { magic: true }, ['academy'], 'A long, double-knit scarf striped in the colours of your Frostspire house.', null],
  ['spellbook-journal', 'Book of Small Spells', 'academy', 11000, null, 'Leather-bound journal with a moving-ink cover',
    { type: 'book', c1: '#3b2a5c', c2: '#f2c46d' }, A(['teen', 'friend', 'self'], ['teens', 'adults'], ['magic', 'reading', 'crafts'], ['dreamer'], ['christmas', 'secret_santa'], ['enchanted']),
    std(40), { magic: true, personalizable: true }, ['academy', 'personalizable'], 'A leather-bound journal whose heat-reactive cover reveals a hidden constellation when held.', null],
  ['academy-acceptance-letter', 'Academy Acceptance Letter', 'academy', 6500, null, 'Personalised Frostspire admission letter',
    { type: 'scroll', c1: '#efe2c2', c2: '#2a4fa8' }, A(['child', 'teen'], ['kids', 'teens'], ['magic', 'reading'], ['dreamer', 'playful'], ['christmas'], ['enchanted']),
    std(500), { magic: true, personalizable: true }, ['academy', 'personalizable'], 'A personalised letter of admission to Frostspire Academy with house crest, wax seal and supplies list.', null],

  // Clothing
  ['fair-isle-sweater', 'Hearth Fair-Isle Sweater', 'clothing', 29000, 25000, 'Merino blend with a reindeer yoke',
    { type: 'sweater', c1: '#c8102e', c2: '#f6f8ff' }, A(['partner', 'self', 'friend', 'parent'], ['teens', 'adults'], ['fashion', 'cozy'], ['classic', 'cozy'], ['christmas', 'family'], ['cozy', 'nordic']),
    sizes(14), { featured: true }, ['bestseller'], 'A soft merino-blend jumper with a traditional yoke of reindeer, stars and pines.', null],
  ['family-pajamas', 'Matching Family Pajamas', 'clothing', 15500, null, 'Flannel pajamas in midnight tartan',
    { type: 'sweater', c1: '#0b1430', c2: '#c8102e', tartan: true }, A(['partner', 'child', 'parent'], ['kids', 'adults'], ['cozy', 'fashion'], ['playful', 'cozy'], ['christmas', 'family'], ['cozy']),
    [...['Kids 4–6', 'Kids 7–10'].map((s) => ({ name: s, options: { size: s }, stock: 15 })), ...sizes(12)], {}, [], 'Brushed-flannel pajamas in midnight tartan, sized for the whole family.', null],

  // Accessories
  ['ember-mittens', 'Ember Mittens', 'accessories', 8500, null, 'Lined wool mittens with snowflake knit',
    { type: 'mittens', c1: '#c8102e', c2: '#f6f8ff' }, A(['friend', 'child', 'partner', 'colleague'], ['kids', 'teens', 'adults'], ['fashion', 'outdoors'], ['cozy', 'playful'], ['christmas', 'secret_santa'], ['cozy', 'nordic']),
    colors([['Ember', '#c8102e'], ['Pine', '#0f6b4f'], ['Snow', '#f6f8ff']], 30), {}, [], 'Fleece-lined wool mittens with a snowflake knit pattern.', null],
  ['jingle-earrings', 'Silver Bell Earrings', 'accessories', 14500, null, 'Sterling silver bells that really chime',
    { type: 'bell', c1: '#cfd6e6', c2: '#c8102e' }, A(['partner', 'friend', 'teen'], ['teens', 'adults'], ['fashion'], ['elegant', 'playful'], ['christmas', 'new_year'], ['grand', 'enchanted']),
    std(25), {}, [], 'Tiny sterling silver bells with a real, delicate chime.', null],
  ['knit-santa-hat', 'Woolly Night Hat', 'accessories', 7000, null, 'Chunky knit hat with a pom-pom',
    { type: 'hat', c1: '#c8102e', c2: '#f6f8ff' }, A(['child', 'teen', 'friend'], ['kids', 'teens', 'adults'], ['fashion', 'outdoors'], ['playful'], ['christmas', 'secret_santa'], ['cozy']),
    std(45), {}, [], 'A chunky knit winter hat with a faux-fur pom-pom and a tiny embroidered star.', null],

  // Limited
  ['aurora-limited-globe', 'Aurora Edition Snowglobe', 'limited', 48000, null, 'Numbered edition of 100',
    { type: 'snowglobe', c1: '#0b1430', c2: '#7fe0c4', scene: 'aurora' }, A(['partner', 'self', 'parent'], ['adults'], ['magic', 'decor'], ['elegant', 'dreamer'], ['christmas'], ['enchanted', 'nordic', 'grand']),
    std(9), { limited: true, featured: true, magic: true }, ['limited', 'numbered'], 'A numbered, hand-signed snowglobe with an aurora that drifts across a miniature Mount Ararat.', 'Only one hundred were made. Number one stays in our shop window, forever.'],
  ['midnight-collection-set', 'The Midnight Collection', 'limited', 39000, 34000, 'Five midnight-blue glass ornaments with gold stars',
    { type: 'ornament', c1: '#0b1430', c2: '#f2c46d', shape: 'bauble' }, A(['partner', 'parent', 'self'], ['adults'], ['decor'], ['elegant'], ['christmas'], ['grand', 'nordic']),
    std(14), { limited: true }, ['limited'], 'Five deep-midnight glass ornaments, each painted with a different winter constellation in gold.', null],
];

const adventPlan = [
  ['story', 'The First Snowflake', 'A story to begin the season', { story: 'On the first of December, a single snowflake landed on the market roof and refused to melt. It has been waiting for you.' }, 'snowflake'],
  ['coupon', '10% for early elves', 'A small key to the market', { type: 'percent', value: 10, min_subtotal: 15000, valid_days: 3 }, 'key'],
  ['points', 'Pocketful of stars', 'Points for your Pioneer Card', { points: 20 }, 'star'],
  ['challenge', 'Wishlist wonder', 'A little task', { text: 'Add three gifts to your wishlist today to complete today’s challenge.' }, 'heart'],
  ['minigame', 'Catch the gifts', 'Play a round', { game: 'catch' }, 'gift'],
  ['product', 'Featured: Glass Pomegranate', 'A treasure from our glassblower', { product_slug: 'glass-pomegranate' }, 'ornament'],
  ['coupon', 'Free delivery day', 'Your sleigh rides free', { type: 'free_shipping', value: 0, min_subtotal: 10000, valid_days: 2 }, 'sleigh'],
  ['points', 'Moonlit points', 'More points for your card', { points: 25 }, 'moon'],
  ['story', 'The Lantern Keeper', 'A story for a long night', { story: 'Every night the lantern keeper lights one lantern more than the night before, so that nobody walking home ever walks in the dark.' }, 'lantern'],
  ['gift', 'A gift with any order', 'Free Snowball Cocoa Bomb', { text: 'Use the code below for a free cocoa bomb with any order over 20,000 ֏.', coupon: { type: 'fixed', value: 1250, min_subtotal: 20000, valid_days: 4 } }, 'gift'],
  ['minigame', 'Winter Quiz', 'Test your Christmas knowledge', { game: 'quiz' }, 'book'],
  ['coupon', 'Halfway there: 12%', 'Celebrate halfway to Christmas', { type: 'percent', value: 12, min_subtotal: 20000, valid_days: 3 }, 'bell'],
  ['points', 'Double sparkle', 'Bonus points', { points: 30 }, 'star'],
  ['product', 'Featured: Wishing Snowglobe', 'Make a wish', { product_slug: 'wishing-snowglobe' }, 'snowglobe'],
  ['challenge', 'Visit the Academy', 'The gates are open', { text: 'Visit Frostspire Academy and be sorted into a house.' }, 'wand'],
  ['story', 'The Pomegranate Tree', 'An old Armenian winter tale', { story: 'In the oldest courtyard of the city there is a pomegranate tree that blossoms in December, just for one night.' }, 'ornament'],
  ['coupon', '1,500 ֏ off', 'A little something', { type: 'fixed', value: 1500, min_subtotal: 12000, valid_days: 3 }, 'key'],
  ['minigame', 'Spin the wheel', 'One spin, one surprise', { game: 'wheel' }, 'wheel'],
  ['points', 'Frosty forty', 'Points for your card', { points: 40 }, 'snowflake'],
  ['product', 'Featured: Aurora Edition', 'Only a few left', { product_slug: 'aurora-limited-globe' }, 'snowglobe'],
  ['coupon', 'Last-minute 15%', 'For the final wrapping', { type: 'percent', value: 15, min_subtotal: 25000, valid_days: 2 }, 'gift'],
  ['minigame', 'Mystery box', 'Open today’s mystery box', { game: 'mystery' }, 'gift'],
  ['story', 'The Night Before', 'Almost there', { story: 'Tomorrow the market closes early, the lanterns burn late and the sleigh bells are polished one last time.' }, 'bell'],
  ['points', 'Christmas Eve gift', 'A big handful of points', { points: 60 }, 'star'],
];

const quiz = [
  ['In which country did the tradition of the decorated Christmas tree become popular first?', ['Germany', 'Armenia', 'Italy', 'Japan'], 0, 'Decorated evergreens in homes are recorded in German lands from the 16th century.'],
  ['On which date does the Armenian Apostolic Church celebrate Christmas?', ['25 December', '1 January', '6 January', '13 January'], 2, 'Armenians celebrate Christmas and Theophany together on 6 January.'],
  ['What is a traditional Armenian New Year pastry?', ['Gata', 'Stollen', 'Panettone', 'Mince pie'], 0, 'Gata is a sweet, buttery bread — sometimes baked with a lucky coin inside.'],
  ['How many points does a typical snowflake have?', ['Four', 'Five', 'Six', 'Eight'], 2, 'Water molecules freeze into hexagonal crystals, so snowflakes have six arms.'],
  ['What is the name of the Armenian winter gift-bringer?', ['Ded Moroz', 'Dzmer Papik', 'Père Noël', 'Julenissen'], 1, 'Dzmer Papik — "Winter Grandfather" — brings gifts on New Year’s Eve.'],
  ['Which plant is traditionally hung for a kiss underneath?', ['Holly', 'Ivy', 'Mistletoe', 'Pine'], 2, null],
  ['Which nut-and-grape-juice sweet is a favourite on Armenian holiday tables?', ['Sujukh', 'Turron', 'Marzipan', 'Halva'], 0, 'Sujukh are walnuts threaded on a string and dipped in thickened grape juice.'],
  ['Which planet is often called the "evening star" in winter skies?', ['Mars', 'Venus', 'Jupiter', 'Saturn'], 1, null],
  ['In the carol, what do the bells do “all the way”?', ['Ring', 'Jingle', 'Chime', 'Toll'], 1, null],
  ['What colour is a traditional poinsettia?', ['Blue', 'Red', 'Orange', 'Purple'], 1, null],
];

const wheel = [
  ['10 points', 'points', { points: 10 }, 30, '#0f6b4f'],
  ['25 points', 'points', { points: 25 }, 15, '#c8102e'],
  ['5% off', 'coupon', { type: 'percent', value: 5, min_subtotal: 10000, valid_days: 5 }, 20, '#f2c46d'],
  ['Free delivery', 'coupon', { type: 'free_shipping', value: 0, min_subtotal: 8000, valid_days: 5 }, 12, '#2a4fa8'],
  ['Warm wishes', 'message', { text: 'The wheel says: you are on the nice list. Try again tomorrow!' }, 18, '#7a2a1e'],
  ['50 points', 'points', { points: 50 }, 4, '#b8860b'],
  ['10% off', 'coupon', { type: 'percent', value: 10, min_subtotal: 20000, valid_days: 3 }, 6, '#0b1430'],
];

const mystery = [
  ['A handful of stardust', 'points', { points: 15 }, 40, 'common'],
  ['A pouch of starlight', 'points', { points: 35 }, 15, 'rare'],
  ['Sleigh ride on us', 'coupon', { type: 'free_shipping', value: 0, min_subtotal: 8000, valid_days: 4 }, 20, 'uncommon'],
  ['Golden key: 15% off', 'coupon', { type: 'percent', value: 15, min_subtotal: 25000, valid_days: 3 }, 5, 'legendary'],
  ['A warm note', 'message', { text: 'Inside the box: a note that says “Someone is thinking about you.”' }, 20, 'common'],
];

const campaigns = [
  ['Early Snow', 'Early Snow: 10% across the market', 'The first snow has fallen. Use EARLYSNOW for 10% off orders over 20,000 ֏ until 10 December.', 'EARLYSNOW', false, 'snowflake', '#2a4fa8'],
  ['Pioneer Evenings', 'Pioneer Evenings', 'Magical Pioneer Card holders get an extra 5% on everything every Friday evening in December.', null, true, 'card', '#b8860b'],
];

const banners = [
  ['home_ribbon', 'Free delivery in Yerevan over 30,000 ֏', 'Our elves are already warming up the sleigh.', 'Shop gifts', '/shop', 'sleigh'],
  ['home_ribbon', 'The Advent Clocktower is open', 'A new door every morning until Christmas Eve.', 'Open today’s door', '/advent', 'clock'],
];

const events = [
  ['Lighting of the Market Tree', 'The great tree in the market square lights up to live music and hot cocoa.', 'Christmas Market pavilion, Yerevan', '2026-12-05T18:00:00+04:00'],
  ['Frostspire Night', 'Sorting ceremony, wand workshop and a lantern parade for young wizards.', 'Christmas Market pavilion, Yerevan', '2026-12-12T17:00:00+04:00'],
  ['Pioneer Fireside Evening', 'An invitation-only evening for Magical Pioneer Card holders.', 'The Pioneer Lodge', '2026-12-19T19:00:00+04:00'],
];

async function clean(client) {
  const tables = ['orders', 'reviews', 'advent_doors', 'quiz_questions', 'challenges', 'campaigns', 'banners', 'christmas_events', 'pioneer_offers', 'coupons', 'products', 'users'];
  for (const t of tables) {
    const { rowCount } = await client.query(`DELETE FROM ${t} WHERE is_demo = true`);
    console.log(`  removed ${rowCount} demo row(s) from ${t}`);
  }
  await client.query(`DELETE FROM wheel_segments`);
  await client.query(`DELETE FROM mystery_rewards`);
}

async function seed(client) {
  await seedBase(client);
  const cats = Object.fromEntries((await client.query('SELECT slug, id FROM categories')).rows.map((r) => [r.slug, r.id]));
  const ids = {};
  let sold = 140;
  for (const [slug, name, cat, price, sale, subtitle, art, attributes, variants, flags, tags, description, story] of products) {
    const { rows } = await client.query(
      `INSERT INTO products (slug,name,subtitle,description,story,category_id,price,sale_price,is_featured,is_limited,is_magic,is_personalizable,tags,attributes,art,sold_count,is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [slug, name, subtitle, description, story, cats[cat], price, sale, !!flags.featured, !!flags.limited, !!flags.magic,
        !!flags.personalizable, tags, attributes, art, (sold = (sold * 7 + 13) % 230)],
    );
    ids[slug] = rows[0].id;
    let i = 0;
    for (const v of variants) {
      const sku = `${slug.toUpperCase().replace(/-/g, '').slice(0, 10)}-${String(++i).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO product_variants (product_id,sku,name,options,price_delta,stock,sort) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (sku) DO NOTHING`,
        [rows[0].id, sku, v.name, v.options, v.price_delta ?? 0, v.stock, i],
      );
    }
  }
  for (const [author, city, rating, body, slug] of HY.reviewsHy) {
    await client.query(`INSERT INTO reviews (product_id,author_name,city,rating,body,is_approved,is_demo) VALUES ($1,$2,$3,$4,$5,true,true)`,
      [ids[slug], author, city, rating, body]);
  }
  const year = 2026;
  for (const [i, [kind, title, teaser, payload, art]] of adventPlan.entries()) {
    await client.query(`INSERT INTO advent_doors (year,day,title,teaser,kind,payload,art,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,true)
      ON CONFLICT (year,day) DO NOTHING`, [year, i + 1, title, teaser, kind, payload, art]);
  }
  for (const [q, opts, ans, fact] of quiz) {
    await client.query(`INSERT INTO quiz_questions (question,options,answer_index,fun_fact,is_demo) VALUES ($1,$2,$3,$4,true)`, [q, JSON.stringify(opts), ans, fact]);
  }
  for (const [label, kind, payload, weight, color] of wheel) {
    await client.query(`INSERT INTO wheel_segments (label,kind,payload,weight,color) VALUES ($1,$2,$3,$4,$5)`, [label, kind, payload, weight, color]);
  }
  for (const [label, kind, payload, weight, rarity] of mystery) {
    await client.query(`INSERT INTO mystery_rewards (label,kind,payload,weight,rarity) VALUES ($1,$2,$3,$4,$5)`, [label, kind, payload, weight, rarity]);
  }
  // Daily challenges for all of December + the rest of November (for development).
  const kinds = [
    ['open_advent', 'Open today’s Advent door', 'Visit the Clocktower and open today’s door.', {}, 10],
    ['play_game', 'Play Catch the Falling Gifts', 'Play one round of Catch the Falling Gifts.', { game: 'catch' }, 10],
    ['wishlist_count', 'Make three wishes', 'Have at least three gifts on your wishlist.', { count: 3 }, 10],
    ['quiz_score', 'Score 5+ in the Winter Quiz', 'Answer at least five quiz questions correctly today.', { min: 5 }, 15],
    ['find_hidden', 'Find a hidden wonder', 'Discover at least one hidden magical object.', { count: 1 }, 10],
    ['visit_academy', 'Be sorted at Frostspire', 'Complete the sorting ceremony.', {}, 15],
  ];
  const start = new Date(Date.UTC(2026, 10, 1));
  for (let d = 0; d < 61; d++) {
    const date = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
    const [kind, title, description, target, points] = kinds[d % kinds.length];
    await client.query(`INSERT INTO challenges (date,title,description,kind,target,reward_points,is_demo) VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [date, title, description, kind, target, points]);
  }
  for (const [name, headline, body, code, pioneerOnly, art, color] of campaigns) {
    await client.query(`INSERT INTO campaigns (name,headline,body,coupon_code,pioneer_only,art,color,starts_at,ends_at,is_demo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-11-01','2026-12-31',true)`, [name, headline, body, code, pioneerOnly, art, color]);
  }
  await client.query(`INSERT INTO coupons (code,description,type,value,min_subtotal,per_user_limit,ends_at,is_demo,source)
    VALUES ('EARLYSNOW','Early Snow campaign','percent',10,20000,1,'2026-12-10',true,'campaign'),
           ('PIONEERFRIDAY','Pioneer Evenings extra 5%','percent',5,0,4,'2026-12-31',true,'campaign')
    ON CONFLICT (code) DO NOTHING`);
  await client.query(`UPDATE coupons SET pioneer_only = true WHERE code = 'PIONEERFRIDAY'`);
  for (const [i, [placement, title, subtitle, label, link, art]] of banners.entries()) {
    await client.query(`INSERT INTO banners (placement,title,subtitle,cta_label,cta_link,art,sort,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [placement, title, subtitle, label, link, art, i]);
  }
  for (const [title, description, location, starts] of events) {
    await client.query(`INSERT INTO christmas_events (title,description,location,starts_at,is_demo) VALUES ($1,$2,$3,$4,true)`, [title, description, location, starts]);
  }
  const offers = [
    ['Pioneer gift: Glass Pomegranate', 'Redeem points for our signature hand-painted ornament.', 'redeem_gift', 600, null, 'glass-pomegranate'],
    ['Pioneer gift: Cocoa Bombs', 'Six Snowball Cocoa Bombs, on the house.', 'redeem_gift', 450, null, 'hot-cocoa-bombs'],
    ['Pioneer 15% coupon', 'Exchange points for a 15% discount on your next order.', 'discount', 300, 15, null],
    ['Pioneer-only: Aurora Edition preview', 'Pioneer members can reserve the Aurora Edition first.', 'exclusive_product', null, null, 'aurora-limited-globe'],
  ];
  for (const [title, description, kind, cost, pct, slug] of offers) {
    await client.query(`INSERT INTO pioneer_offers (title,description,kind,points_cost,discount_percent,product_id,is_demo) VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [title, description, kind, cost, pct, slug ? ids[slug] : null]);
  }
  // Armenian content overlays
  await applyHy(client, 'products', 'slug', HY.productsHy);
  for (const [en, hy] of Object.entries(HY.variantsHy)) {
    await client.query(`UPDATE product_variants SET i18n = jsonb_build_object('hy', jsonb_build_object('name', $2::text)) WHERE name = $1`, [en, hy]);
  }
  for (const [i, hy] of HY.adventHy.entries()) {
    await client.query(`UPDATE advent_doors SET i18n = jsonb_build_object('hy', $2::jsonb) WHERE year = $3 AND day = $1`, [i + 1, JSON.stringify(hy), year]);
  }
  const qs = (await client.query('SELECT id FROM quiz_questions WHERE is_demo ORDER BY id')).rows;
  for (const [i, [question, options, funFact]] of HY.quizHy.entries()) {
    if (qs[i]) await client.query(`UPDATE quiz_questions SET i18n = jsonb_build_object('hy', $2::jsonb) WHERE id = $1`, [qs[i].id, JSON.stringify({ question, options, fun_fact: funFact })]);
  }
  await applyHy(client, 'wheel_segments', 'label', HY.wheelHy);
  await applyHy(client, 'mystery_rewards', 'label', HY.mysteryHy);
  await applyHy(client, 'challenges', 'kind', HY.challengesHy);
  await applyHy(client, 'campaigns', 'name', HY.campaignsHy);
  await applyHy(client, 'banners', 'title', HY.bannersHy);
  await applyHy(client, 'christmas_events', 'title', HY.eventsHy);
  await applyHy(client, 'pioneer_offers', 'title', HY.offersHy);
  await applyHy(client, 'coupons', 'code', HY.couponsHy);

  // Demo customer (password printed below — development only).
  const hash = await bcrypt.hash('snowflake-demo-2026', 12);
  const { rows: [u] } = await client.query(
    `INSERT INTO users (email,password_hash,name,personalization_consent,is_demo) VALUES ('demo@christmas-market.test',$1,'Samvel',true,true)
     ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [hash]);
  await client.query(`INSERT INTO user_profiles (user_id, display_name, atmosphere, preferences) VALUES ($1,'Samvel','cozy',$2) ON CONFLICT (user_id) DO NOTHING`,
    [u.id, { favorite: 'lights', tradition: 'baking', giftStyle: 'handmade', season: 'snowy-evening' }]);
  // Demo admin (development only — production admins are created with `npm run admin:create`).
  const adminHash = await bcrypt.hash('north-pole-office-2026', 12);
  const { rows: [a] } = await client.query(
    `INSERT INTO users (email,password_hash,name,role,personalization_consent,is_demo) VALUES ('elf@christmas-market.test',$1,'Head Elf','admin',true,true)
     ON CONFLICT (email) DO UPDATE SET role='admin' RETURNING id`, [adminHash]);
  await client.query(`INSERT INTO user_profiles (user_id, display_name) VALUES ($1,'Head Elf') ON CONFLICT (user_id) DO NOTHING`, [a.id]);
}

await withTransaction(async (client) => {
  if (process.argv.includes('--clean')) {
    await clean(client);
    console.log('✔ Demo data removed.');
  } else {
    await clean(client);
    await seed(client);
    console.log('✔ Demo data seeded. Demo customer: demo@christmas-market.test / snowflake-demo-2026 · Demo admin: elf@christmas-market.test / north-pole-office-2026');
  }
});
await pool.end();
