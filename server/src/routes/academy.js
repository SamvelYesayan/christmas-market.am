// Frostspire Academy — original wizarding-school experience: sorting ceremony and magical identity.
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { one, many, withTransaction } from '../db.js';
import { ah } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { awardAchievement, getRule, grantReward, publicGrant, syncPioneerPoints } from '../services/rewards.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { currentLocale, loc } from '../i18n/index.js';

const r = Router();

// Each answer adds weight to houses in order [emberwyn, pinehollow, starloom, aurelith].
// Texts are [English, Armenian].
const QUESTIONS = [
  { q: ['The castle gate creaks open on a snowy night. You…', 'Ձյունառատ գիշերով դղյակի դարպասը ճռռալով բացվում է։ Դուք…'], a: [
    [['Stride straight in — adventure is waiting', 'Համարձակ ներս եք մտնում․ արկածն սպասում է'], [3, 0, 1, 1]],
    [['Wait for your friends so nobody walks in alone', 'Սպասում եք ընկերներին, որ ոչ ոք մենակ չմտնի'], [0, 3, 0, 1]],
    [['Study the runes carved into the archway first', 'Նախ ուսումնասիրում եք կամարին փորագրված ռունաները'], [0, 0, 3, 1]],
    [['Straighten your scarf — first impressions matter', 'Ուղղում եք շարֆը․ առաջին տպավորությունը կարևոր է'], [1, 0, 0, 3]]] },
  { q: ['Which winter sound makes your heart glow?', 'Ձմեռային ո՞ր ձայնն է ջերմացնում ձեր սիրտը'], a: [
    [['A crackling bonfire', 'Ճտճտացող խարույկը'], [3, 1, 0, 0]],
    [['A kettle singing in grandmother’s kitchen', 'Տատիկի խոհանոցում եռացող թեյնիկը'], [0, 3, 1, 0]],
    [['Silence, and snow falling on snow', 'Լռությունը և ձյան վրա իջնող ձյունը'], [0, 0, 3, 1]],
    [['A hall full of music and laughter', 'Երաժշտությամբ ու ծիծաղով լի դահլիճը'], [1, 0, 0, 3]]] },
  { q: ['You may enchant one Christmas object. You choose…', 'Կարող եք կախարդել տոնական մեկ առարկա։ Ընտրում եք…'], a: [
    [['A sled that never stops at the bottom of the hill', 'Սահնակ, որը երբեք կանգ չի առնում բլրի ստորոտում'], [3, 0, 1, 0]],
    [['A table that always has room for one more guest', 'Սեղան, որի շուրջ միշտ տեղ կա ևս մեկ հյուրի համար'], [0, 3, 0, 1]],
    [['A map of the stars that shows where wishes go', 'Աստղային քարտեզ, որը ցույց է տալիս՝ ուր են գնում երազանքները'], [0, 1, 3, 0]],
    [['A mirror that shows everyone their best self', 'Հայելի, որ յուրաքանչյուրին ցույց է տալիս իր լավագույն կողմը'], [0, 0, 1, 3]]] },
  { q: ['A friend is sad on Christmas Eve. You…', 'Սուրբ Ծննդյան նախօրեին ընկերդ տխուր է։ Դուք…'], a: [
    [['Drag them outside for a snowball fight', 'Դուրս եք հանում նրան ձնագնդի խաղալու'], [3, 1, 0, 0]],
    [['Bake their favourite cake and sit with them', 'Թխում եք նրա սիրելի տորթը և նստում կողքին'], [0, 3, 0, 1]],
    [['Write them a story where they are the hero', 'Գրում եք պատմություն, որտեղ նա է գլխավոր հերոսը'], [0, 0, 3, 1]],
    [['Throw them a surprise party by midnight', 'Մինչև կեսգիշեր անակնկալ երեկույթ եք կազմակերպում'], [1, 0, 0, 3]]] },
  { q: ['Pick a lantern to carry through the dark forest.', 'Ընտրեք լապտեր՝ մութ անտառով անցնելու համար։'], a: [
    [['Red glass, flickering like a fox’s tail', 'Կարմիր ապակի, որ առկայծում է աղվեսի պոչի պես'], [3, 0, 0, 1]],
    [['Old pine wood, warm and steady', 'Հին սոճու փայտ՝ ջերմ ու հուսալի'], [0, 3, 1, 0]],
    [['Blue crystal that hums with starlight', 'Կապույտ բյուրեղ, որ աստղալույսով է բզզում'], [0, 0, 3, 1]],
    [['Gold filigree that throws patterns on the snow', 'Ոսկե ժանյակ, որ նախշեր է գծում ձյան վրա'], [0, 1, 0, 3]]] },
  { q: ['Your favourite part of Christmas morning is…', 'Սուրբ Ծննդյան առավոտի ձեր սիրելի պահը…'], a: [
    [['Running downstairs first', 'Առաջինը աստիճաններով ներքև վազելն է'], [3, 0, 0, 1]],
    [['Everyone together in pyjamas', 'Բոլորը միասին՝ գիշերազգեստներով'], [1, 3, 0, 0]],
    [['The quiet hour before anyone wakes', 'Խաղաղ ժամը, մինչ բոլորը կարթնանան'], [0, 1, 3, 0]],
    [['Watching someone open the gift you chose', 'Տեսնել, թե ինչպես են բացում ձեր ընտրած նվերը'], [0, 0, 1, 3]]] },
  { q: ['The sorting stone asks: what do you want to become?', 'Բաշխող քարը հարցնում է․ ի՞նչ եք ուզում դառնալ'], a: [
    [['Brave', 'Քաջ'], [3, 0, 0, 0]],
    [['Kind', 'Բարի'], [0, 3, 0, 0]],
    [['Wise', 'Իմաստուն'], [0, 0, 3, 0]],
    [['Remarkable', 'Արտասովոր'], [0, 0, 0, 3]]] },
];
const ORDER = ['emberwyn', 'pinehollow', 'starloom', 'aurelith'];

// [English, Armenian] pairs; the same hash index picks the same meaning in both languages.
const EPITHETS = {
  emberwyn: [['of the Bright Hearth', 'Պայծառ Օջախից'], ['Foxfire', 'Աղվեսակրակ'], ['the Unafraid', 'Աներկյուղ'], ['Kindlewalker', 'Կայծաքայլ']],
  pinehollow: [['of the Deep Roots', 'Խոր Արմատներից'], ['Evergreen', 'Մշտադալար'], ['the Steadfast', 'Անսասան'], ['Hollowheart', 'Անտառասիրտ']],
  starloom: [['of the Silver Thread', 'Արծաթե Թելից'], ['Moonweaver', 'Լուսնագործ'], ['the Wondering', 'Հետաքրքրասեր'], ['Starreader', 'Աստղընթերց']],
  aurelith: [['of the Northern Lights', 'Հյուսիսափայլից'], ['Goldenstep', 'Ոսկեքայլ'], ['the Radiant', 'Լուսավոր'], ['Aurorae', 'Արշալույս']],
};
const WOODS = [['birch', 'կեչի'], ['walnut', 'ընկուզենի'], ['pine', 'սոճի'], ['cherry', 'բալենի'], ['juniper', 'գիհի'], ['apricot', 'ծիրանենի'], ['holly', 'փշատերև'], ['rowan', 'արոսենի']];
const CORES = [['frost crystal', 'ցրտաբյուրեղ'], ['ember glass', 'կայծապակի'], ['starlight thread', 'աստղալույսի թել'], ['aurora feather', 'հյուսիսափայլի փետուր'], ['pomegranate seed', 'նռան հատիկ'], ['snow-owl down', 'բևեռային բվի աղվափետուր']];
const FAMILIARS = {
  emberwyn: [['red fox kit', 'կարմիր աղվեսի ձագ'], ['fire salamander', 'կրակե սալամանդր']],
  pinehollow: [['snow hare', 'ձյունե նապաստակ'], ['young stag', 'երիտասարդ եղնիկ']],
  starloom: [['luna moth', 'լուսնաթիթեռ'], ['night owl', 'գիշերային բու']],
  aurelith: [['snow lynx cub', 'ձյունե լուսանի ձագ'], ['silver swan', 'արծաթե կարապ']],
};
const CONSTELLATIONS = [['the Lantern', 'Լապտեր'], ['the Sleigh', 'Սահնակ'], ['the Wandering Star', 'Թափառող Աստղ'], ['the Silver Stag', 'Արծաթե Եղնիկ'], ['the Pomegranate', 'Նուռ'], ['the Snow Fox', 'Ձյունե Աղվես'], ['the Bell', 'Զանգակ']];
const SPELLS = {
  emberwyn: ['Kindlaris — warms cold hands and colder hearts', 'Կինդլարիս․ տաքացնում է սառը ձեռքերն ու առավել սառը սրտերը'],
  pinehollow: ['Radicora — makes any room feel like home', 'Ռադիկորա․ ցանկացած սենյակ դարձնում է տուն'],
  starloom: ['Lumentexo — reveals the path to what you seek', 'Լումենտեքսո․ ցույց է տալիս ճանապարհը դեպի փնտրածդ'],
  aurelith: ['Aurifex — makes ordinary things shine', 'Աուրիֆեքս․ սովորական բաները դարձնում է փայլուն'],
};

function buildIdentity(name, house) {
  const h = crypto.createHash('sha256').update(`${name}:${house}`).digest();
  const pick = (arr, i) => arr[h[i] % arr.length];
  const ep = pick(EPITHETS[house], 0);
  const wood = pick(WOODS, 1);
  const core = pick(CORES, 2);
  const fam = pick(FAMILIARS[house], 4);
  const con = pick(CONSTELLATIONS, 5);
  const len = 24 + (h[3] % 12);
  const build = (k) => ({
    magicalName: k === 0 ? `${name} ${ep[0]}` : `${name} ${ep[1]}`,
    wand: { wood: wood[k], core: core[k], length: k === 0 ? `${len} cm` : `${len} սմ` },
    familiar: fam[k],
    constellation: con[k],
    signatureSpell: SPELLS[house][k],
  });
  return { ...build(0), sigil: h.readUInt16BE(6) % 1000, i18n: { hy: build(1) } };
}

const houseDto = (raw) => {
  const h = loc(raw);
  return { slug: h.slug, name: h.name, motto: h.motto, animal: h.animal, element: h.element, color: h.color, accent: h.accent, virtues: h.virtues, description: h.description };
};
const ix = () => (currentLocale() === 'hy' ? 1 : 0);

r.get('/houses', ah(async (_req, res) => {
  const houses = await many('SELECT h.*, (SELECT count(*)::int FROM user_profiles p WHERE p.house_id = h.id) AS members FROM houses h ORDER BY id');
  res.json({ houses: houses.map((h) => ({ ...houseDto(h), members: h.members })) });
}));

r.get('/sorting', (_req, res) => {
  res.json({ questions: QUESTIONS.map((x, i) => ({ id: i, question: x.q[ix()], answers: x.a.map(([text]) => text[ix()]) })) });
});

const sortSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)).length(QUESTIONS.length),
  name: z.string().trim().min(1).max(40).optional(),
});

r.post('/sort', validate({ body: sortSchema }), ah(async (req, res) => {
  const totals = [0, 0, 0, 0];
  req.body.answers.forEach((ai, qi) => QUESTIONS[qi].a[ai][1].forEach((w, hi) => { totals[hi] += w; }));
  const best = Math.max(...totals);
  const tied = ORDER.filter((_, i) => totals[i] === best);
  let houseSlug = tied[crypto.randomInt(tied.length)];

  const name = req.body.name ?? req.user?.name?.split(' ')[0] ?? 'Traveller';
  if (!req.user) {
    // Guests receive their result but nothing is stored server-side.
    const house = await one('SELECT * FROM houses WHERE slug=$1', [houseSlug]);
    return res.json({ house: houseDto(house), identity: loc(buildIdentity(name, houseSlug)), saved: false, totals });
  }

  const result = await withTransaction(async (db) => {
    const { rows: [profile] } = await db.query('SELECT p.*, h.slug AS house_slug FROM user_profiles p LEFT JOIN houses h ON h.id=p.house_id WHERE user_id=$1 FOR UPDATE OF p', [req.user.id]);
    if (profile?.house_slug) houseSlug = profile.house_slug; // the stone remembers — sorting happens once
    const { rows: [house] } = await db.query('SELECT * FROM houses WHERE slug=$1', [houseSlug]);
    const identity = profile?.identity ?? buildIdentity(profile?.display_name?.split(' ')[0] ?? name, houseSlug);
    await db.query(
      `INSERT INTO user_profiles (user_id, display_name, house_id, identity, sorted_at) VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (user_id) DO UPDATE SET house_id=$3, identity=$4, sorted_at=COALESCE(user_profiles.sorted_at, now())`,
      [req.user.id, name, house.id, identity]);
    const rule = await getRule(db, 'sorting');
    const { grant, created } = await grantReward(db, req.user.id, {
      source: 'sorting', sourceRef: 'house', kind: 'points', title: `Welcome to ${house.name}`, titleHy: `Բարի գալուստ ${house.i18n?.hy?.name ?? house.name}`, points: rule?.points ?? 25,
    });
    const achievement = await awardAchievement(db, req.user.id, 'sorted');
    return { house, identity, grant: created ? grant : null, achievement, alreadySorted: !!profile?.house_slug };
  });
  if (result.grant) syncPioneerPoints(req.user.id).catch(() => {});
  res.json({ house: houseDto(result.house), identity: loc(result.identity), saved: true, alreadySorted: result.alreadySorted, reward: publicGrant(result.grant), achievement: result.achievement });
}));

r.get('/me', ah(async (req, res) => {
  if (!req.user) return res.json({ sorted: false });
  const p = await one('SELECT p.identity, p.sorted_at, h.* FROM user_profiles p JOIN houses h ON h.id=p.house_id WHERE p.user_id=$1', [req.user.id]);
  if (!p) return res.json({ sorted: false });
  res.json({ sorted: true, house: houseDto(p), identity: loc(p.identity), sortedAt: p.sorted_at });
}));

r.get('/shop', ah(async (_req, res) => {
  const rows = await many(`${PRODUCT_CARD_SQL} WHERE p.is_active AND (p.is_magic OR c.slug = 'academy') ORDER BY c.slug = 'academy' DESC, p.sold_count DESC LIMIT 16`);
  res.json({ products: rows.map(productCard) });
}));

export default r;
