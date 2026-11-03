// Server-side localisation. Armenian (hy) is the default locale; English (en) is secondary.
//  • req.locale is resolved from X-Locale header → mc_lang cookie → Accept-Language → 'hy'.
//  • Translatable rows carry an `i18n` JSONB column: { hy: { name, subtitle, … }, en: { … } }.
//    Base columns hold the English text; loc() overlays the requested locale.
//  • User-facing server messages are written in English in code and translated here (exact + patterns).
import { AsyncLocalStorage } from 'node:async_hooks';

export const LOCALES = ['hy', 'en'];
export const DEFAULT_LOCALE = 'hy';
const als = new AsyncLocalStorage();
/** Locale of the request currently being handled (Armenian outside of a request). */
export const currentLocale = () => als.getStore()?.locale ?? DEFAULT_LOCALE;

export function localeMiddleware(req, _res, next) {
  const pick = (v) => (v && LOCALES.includes(v) ? v : null);
  const header = pick(String(req.get('x-locale') ?? '').slice(0, 2));
  const cookie = pick(req.cookies?.mc_lang);
  // Armenian is the default for everyone; English only when explicitly chosen.
  req.locale = header ?? cookie ?? DEFAULT_LOCALE;
  als.run({ locale: req.locale }, next);
}

/** Overlay row.i18n[locale] onto the row's own fields (only for keys present in the overlay). */
export function loc(row, locale = currentLocale(), i18nKey = 'i18n') {
  if (!row) return row;
  const over = row[i18nKey]?.[locale];
  if (!over || typeof over !== 'object') return row;
  const out = { ...row };
  for (const [k, v] of Object.entries(over)) if (v != null && v !== '') out[k] = v;
  return out;
}

const HY = {
  // auth & account
  'Please sign in to continue.': 'Խնդրում ենք մուտք գործել՝ շարունակելու համար։',
  'You do not have access to this.': 'Դուք մուտքի իրավունք չունեք։',
  'Not found.': 'Չի գտնվել։',
  'An account with this email already exists.': 'Այս էլ. հասցեով հաշիվ արդեն գոյություն ունի։',
  'That email and password do not match.': 'Էլ. հասցեն կամ գաղտնաբառը սխալ է։',
  'This account has been disabled. Please contact us.': 'Այս հաշիվն ապաակտիվացված է։ Խնդրում ենք կապվել մեզ հետ։',
  'Current password is incorrect.': 'Ընթացիկ գաղտնաբառը սխալ է։',
  'Request origin not allowed.': 'Հարցման աղբյուրը թույլատրված չէ։',
  'Too many requests — the elves need a short break.': 'Չափազանց շատ հարցումներ․ թզուկներին մի փոքր հանգիստ է պետք։',
  'Too many sign-in attempts. Please wait a few minutes.': 'Չափազանց շատ մուտքի փորձեր։ Խնդրում ենք սպասել մի քանի րոպե։',
  'Slow down, snow champion.': 'Մի փոքր դանդաղ, ձյան չեմպիոն։',
  'Too many card attempts. Please wait before trying again.': 'Չափազանց շատ փորձեր քարտով։ Խնդրում ենք սպասել և նորից փորձել։',
  'Too many submissions. Please try again shortly.': 'Չափազանց շատ հայտեր։ Խնդրում ենք փորձել քիչ անց։',
  'Something went wrong in the workshop.': 'Արհեստանոցում ինչ-որ բան սխալ գնաց։',
  'Request too large.': 'Հարցումը չափազանց մեծ է։',
  'File too large (max 5 MB).': 'Ֆայլը չափազանց մեծ է (առավելագույնը՝ 5 ՄԲ)։',
  'That already exists.': 'Սա արդեն գոյություն ունի։',
  'This item is referenced elsewhere.': 'Այս տարրն օգտագործվում է այլ տեղում։',
  'Invalid input': 'Սխալ տվյալներ',
  // catalog
  'This gift has wandered off.': 'Այս նվերը մոլորվել է։',
  'This gift is no longer available.': 'Այս նվերն այլևս հասանելի չէ։',
  'This gift cannot be personalised.': 'Այս նվերը հնարավոր չէ անհատականացնել։',
  'Sold out — the elves are making more.': 'Վաճառված է․ թզուկները նորերն են պատրաստում։',
  'Please sign in to leave a review.': 'Կարծիք թողնելու համար խնդրում ենք մուտք գործել։',
  'Thank you! Your review will appear after our elves read it.': 'Շնորհակալություն։ Ձեր կարծիքը կհայտնվի, երբ թզուկները կարդան այն։',
  // cart, coupons, checkout
  'Your sleigh is empty.': 'Ձեր սահնակը դատարկ է։',
  'This code does not exist or is no longer active.': 'Այս կոդը գոյություն չունի կամ այլևս ակտիվ չէ։',
  'This code is not active yet.': 'Այս կոդը դեռ ակտիվ չէ։',
  'This code has expired.': 'Այս կոդի ժամկետն անցել է։',
  'This code belongs to another account.': 'Այս կոդը պատկանում է այլ հաշվի։',
  'This code is reserved for Magical Pioneer Card holders.': 'Այս կոդը նախատեսված է միայն Կախարդական Պիոներ քարտի անդամների համար։',
  'This code has been fully used.': 'Այս կոդն ամբողջությամբ օգտագործված է։',
  'You have already used this code.': 'Դուք արդեն օգտագործել եք այս կոդը։',
  'This payment method is not available.': 'Վճարման այս եղանակը հասանելի չէ։',
  'This payment method is no longer available.': 'Վճարման այս եղանակն այլևս հասանելի չէ։',
  'Please choose a delivery option.': 'Խնդրում ենք ընտրել առաքման եղանակը։',
  'Please enter a delivery address.': 'Խնդրում ենք նշել առաքման հասցեն։',
  'Please accept the terms of sale': 'Խնդրում ենք ընդունել վաճառքի պայմանները',
  'Please enter a valid phone number': 'Խնդրում ենք նշել ճիշտ հեռախոսահամար',
  'This order is already paid.': 'Այս պատվերն արդեն վճարված է։',
  'This order can no longer be paid.': 'Այս պատվերն այլևս հնարավոր չէ վճարել։',
  'We could not reach the payment provider. Please try again or choose another method.': 'Չհաջողվեց կապ հաստատել վճարային համակարգի հետ։ Փորձեք կրկին կամ ընտրեք այլ եղանակ։',
  'We could not find that order. Check the number and email.': 'Պատվերը չգտնվեց։ Ստուգեք համարը և էլ. հասցեն։',
  'Payment not found.': 'Վճարումը չի գտնվել։',
  'Test payments are disabled.': 'Փորձնական վճարումներն անջատված են։',
  'This test payment was already approved.': 'Այս փորձնական վճարումն արդեն հաստատված է։',
  // pioneer
  'The Magical Pioneer Card connection is not available yet.': 'Կախարդական Պիոներ քարտի կապը դեռ հասանելի չէ։',
  'Card code or verification code is incorrect.': 'Քարտի կոդը կամ ստուգման կոդը սխալ է։',
  'Card could not be verified.': 'Քարտը հնարավոր չեղավ ստուգել։',
  'Not enough Pioneer points.': 'Պիոներ միավորները բավարար չեն։',
  'Sandbox: use a 12-digit card starting with 9999 and verification code 1225.': 'Sandbox․ օգտագործեք 9999-ով սկսվող 12-նիշանոց քարտ և 1225 ստուգման կոդը։',
  'The Pioneer Lodge is not answering right now. Please try again shortly.': 'Պիոներների օթյակն այս պահին չի պատասխանում։ Խնդրում ենք փորձել քիչ անց։',
  'A Pioneer Card is already linked to your account.': 'Ձեր հաշվին արդեն կցված է Պիոներ քարտ։',
  'This card is already linked to another account.': 'Այս քարտն արդեն կցված է այլ հաշվի։',
  'Link your Magical Pioneer Card first.': 'Նախ կցեք ձեր Կախարդական Պիոներ քարտը։',
  'This offer is no longer available.': 'Այս առաջարկն այլևս հասանելի չէ։',
  'This offer is not redeemable with points.': 'Այս առաջարկը հնարավոր չէ ստանալ միավորներով։',
  'This reward has been fully claimed.': 'Այս պարգևն արդեն սպառված է։',
  'Add the gift to your sleigh and use this code at checkout — it covers the gift in full.': 'Ավելացրեք նվերը սահնակ և վճարման ժամանակ օգտագործեք այս կոդը․ այն ամբողջությամբ ծածկում է նվերի արժեքը։',
  'Your Pioneer discount code is ready for checkout.': 'Ձեր Պիոներ զեղչի կոդը պատրաստ է վճարման համար։',
  // advent & games
  'The Clocktower opens on the 1st of December.': 'Ժամացույցի աշտարակը բացվում է դեկտեմբերի 1-ին։',
  'This door has not been prepared yet.': 'Այս դուռը դեռ պատրաստված չէ։',
  'This game is resting today.': 'Այս խաղն այսօր հանգստանում է։',
  'You have played all your rounds for today. Come back tomorrow!': 'Այսօրվա բոլոր փուլերն արդեն խաղացել եք։ Վերադարձեք վաղը։',
  'Game session not found.': 'Խաղի նիստը չի գտնվել։',
  'This round is already finished.': 'Այս փուլն արդեն ավարտված է։',
  'The elves could not verify this round, so no points this time.': 'Թզուկները չկարողացան ստուգել այս փուլը, ուստի այս անգամ միավորներ չկան։',
  'Great round! Today’s points are already in your pocket.': 'Հիանալի փուլ։ Այսօրվա միավորներն արդեն ձեր գրպանում են։',
  'You have already taken today’s quiz. New questions tomorrow!': 'Այսօրվա վիկտորինան արդեն անցել եք։ Նոր հարցերը՝ վաղը։',
  'The quiz master is still writing questions.': 'Վիկտորինայի վարպետը դեռ հարցեր է գրում։',
  'Quiz session not found or finished.': 'Վիկտորինայի նիստը չի գտնվել կամ ավարտված է։',
  'Please answer the questions in order.': 'Խնդրում ենք պատասխանել հարցերին հերթականությամբ։',
  'Nothing to win today — check back soon.': 'Այսօր շահելու բան չկա․ վերադարձեք շուտով։',
  'You have already spun the wheel. Come back tomorrow!': 'Անիվն այսօր արդեն պտտել եք։ Վերադարձեք վաղը։',
  'You have already opened today’s box. Come back tomorrow!': 'Այսօրվա արկղն արդեն բացել եք։ Վերադարձեք վաղը։',
  'This challenge is not active today.': 'Այս մարտահրավերն այսօր ակտիվ չէ։',
  'Not quite yet — complete the challenge first!': 'Դեռ ոչ․ նախ կատարեք մարտահրավերը։',
  'Already claimed.': 'Արդեն ստացված է։',
  // admin
  'Sale price must be lower than the regular price.': 'Զեղչված գինը պետք է ցածր լինի սովորական գնից։',
  'This product has orders, so it was archived (hidden) instead of deleted.': 'Այս ապրանքն ունի պատվերներ, ուստի այն արխիվացվեց (թաքցվեց)՝ ջնջելու փոխարեն։',
  'Choose at least one image.': 'Ընտրեք առնվազն մեկ նկար։',
  'Shipped or closed orders cannot be cancelled.': 'Առաքված կամ փակված պատվերները հնարավոր չէ չեղարկել։',
  'Cancelled orders cannot be reopened.': 'Չեղարկված պատվերները հնարավոր չէ վերաբացել։',
  'This order is not paid yet. Mark it paid (e.g. bank transfer received) or wait for the payment provider.': 'Այս պատվերը դեռ վճարված չէ։ Նշեք որպես վճարված (օր․՝ բանկային փոխանցում) կամ սպասեք վճարային համակարգին։',
  'You cannot disable or demote your own account.': 'Դուք չեք կարող ապաակտիվացնել կամ զրկել իրավունքներից ձեր սեփական հաշիվը։',
};

const HY_PATTERNS = [
  [/^Sandbox opening balance$/, () => 'Sandbox-ի սկզբնական մնացորդ'],
  [/^Christmas Market: (.+)$/, (m) => `Christmas Market․ ${m[1]}`],
  [/^Order placed, awaiting payment$/, () => 'Պատվերը ձևակերպված է, սպասում է վճարման'],
  [/^Order placed — pay on delivery$/, () => 'Պատվերը ձևակերպված է․ վճարում՝ առաքման պահին'],
  [/^TEST payment approved (no real money)$/, () => 'ՓՈՐՁՆԱԿԱՆ վճարումը հաստատված է (առանց իրական գումարի)'],
  [/^Payment received via (.+)$/, (m) => `Վճարումը ստացված է (${m[1]})`],
  [/^Payment not completed in time — stock released$/, () => 'Վճարումը ժամանակին չավարտվեց․ ապրանքները վերադարձվեցին պահեստ'],
  [/^Payment marked as received by admin$/, () => 'Ադմինիստրատորը նշել է վճարումը որպես ստացված'],
  [/^Cancelled by admin$/, () => 'Չեղարկված է ադմինիստրատորի կողմից'],
  [/^Order cancelled$/, () => 'Պատվերը չեղարկված է'],
  [/^Only (\d+) left in stock\.$/, (m) => `Պահեստում մնացել է ընդամենը ${m[1]} հատ։`],
  [/^Only (\d+) × (.+) \((.+)\) left\.$/, (m) => `«${m[2]}» (${m[3]})՝ մնացել է ընդամենը ${m[1]} հատ։`],
  [/^(.+) is no longer available\.$/, (m) => `«${m[1]}»-ն այլևս հասանելի չէ։`],
  [/^Patience! Door (\d+) opens on \d+ December\.$/, (m) => `Համբերությո՛ւն։ ${m[1]}-րդ դուռը կբացվի դեկտեմբերի ${m[1]}-ին։`],
  [/^This code needs a subtotal of at least (.+)\.$/, (m) => `Այս կոդի համար պատվերի գումարը պետք է լինի առնվազն ${m[1]}։`],
  [/^Pioneer service error \((\d+)\)\.$/, () => HY['The Pioneer Lodge is not answering right now. Please try again shortly.']],
  [/^Pioneer service unreachable/, () => HY['The Pioneer Lodge is not answering right now. Please try again shortly.']],
  [/^Password must be at least 10 characters$/, () => 'Գաղտնաբառը պետք է պարունակի առնվազն 10 նիշ'],
  [/^Enter the code printed on your card$/, () => 'Մուտքագրեք ձեր քարտի վրա տպված կոդը'],
  [/^Enter the verification code$/, () => 'Մուտքագրեք ստուգման կոդը'],
  [/^Please confirm you want to receive our letters$/, () => 'Խնդրում ենք հաստատել, որ ցանկանում եք ստանալ մեր նամակները'],
  // zod / generic validation: "field: message"
  [/^([\w.]+): (.+)$/, (m) => `Խնդրում ենք ստուգել «${FIELD_HY[m[1].split('.').pop()] ?? m[1]}» դաշտը։`],
];

const FIELD_HY = { email: 'էլ. հասցե', password: 'գաղտնաբառ', name: 'անուն', phone: 'հեռախոս', address: 'հասցե', city: 'քաղաք', code: 'կոդ', body: 'տեքստ', rating: 'գնահատական', quantity: 'քանակ', cardCode: 'քարտի կոդ', verificationCode: 'ստուգման կոդ', acceptTerms: 'պայմաններ', consent: 'համաձայնություն', newPassword: 'նոր գաղտնաբառ', zone: 'առաքում' };

/** Translate a server-generated English message into the request's locale. */
export function tr(locale, message) {
  if (message === undefined) [locale, message] = [currentLocale(), locale];
  if (!message || locale !== 'hy') return message;
  if (HY[message]) return HY[message];
  for (const [re, fn] of HY_PATTERNS) {
    const m = re.exec(message);
    if (m) return fn(m);
  }
  return message;
}
