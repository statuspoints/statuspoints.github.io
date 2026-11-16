// Checks plain wording (from index.html and README.md): status levels and perks without insider shorthand (MQDs and
// PQP spelled out once, before and after Jan 1, 2027), every "N% bonus" chip saying bonus what, one name for each
// action ("update", "Type balances", "welcome bonus", "Level"), clearer credit and transfer notes (Amex's U.S.-airline
// fee note only on Delta and JetBlue), who does what in the site password sheet, curly apostrophes, a README that
// matches the app, and a long unbroken program name or "whose account" wrapping instead of pushing the program sheet
// sideways.
// Usage: node tests/run-fixes-wording-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(process.env.HTML_PATH || `${root}index.html`, 'utf8');
const readme = readFileSync(`${root}README.md`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

// The data tables, with a clock the checks set.
let now = new Date(2026, 10, 15, 12).getTime();
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now; }
}
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const fakeEl = (tag) => ({ tag, attrs: {}, dataset: {}, kids: [], hidden: false, textContent: '', value: '', content: { firstChild: null },
    setAttribute(k, v) { this.attrs[k] = v; }, append(...k) { this.kids.push(...k); }, replaceChildren(...k) { this.kids = k; }, addEventListener() {} });
  const els = {};
  const document = { querySelector: (sel) => els[sel] || (els[sel] = fakeEl(sel)), createElement: fakeEl };
`;
const context = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, URL });
vm.runInContext(`${stubs}\n${head}\nglobalThis.api = { CATALOG_BY_ID, CATALOG_ITEMS, benefitsFor, trackFor, TRANSFERS, CREDITS };`, context);
const { api } = context;
const tiers = (id) => api.benefitsFor(api.CATALOG_BY_ID[id]);
const tier = (id, name) => tiers(id).find((t) => t.name === name);
const allText = () => Object.keys(api.CATALOG_BY_ID).flatMap((id) => (tiers(id) || []).flatMap((t) => [t.earn, ...t.short, ...t.perks])).join('\n');

/* ---------- Status levels and perks: no insider shorthand ---------- */

const jargon = (text) => ['F&B', '(EDQ)', 'SAF purchases', 'piece-concept', 'weight-concept', 'Y fare', 'Space-available', 'clearing ', ' pts'].filter((w) => text.includes(w));
check('levels and perks: no F&B, EDQ, SAF, piece/weight-concept, Y fare, space-available, "clearing … out" or "pts"', jargon(allText()), []);
check('Hilton Gold and Diamond chips: "Breakfast or food credit"', [tier('hilton', 'Gold').short[0], tier('hilton', 'Diamond').short[0]], ['Breakfast or food credit', 'Breakfast or food credit']);
check('Delta Silver spells out MQDs once', tier('delta', 'Silver Medallion').earn, '$5,000 in Medallion Qualifying Dollars (MQDs) in a calendar year');
check('…and the higher levels keep it short', tier('delta', 'Gold Medallion').earn, '$10,000 MQDs in a calendar year');
check('Delta upgrades: "as early as N days before the flight"', tiers('delta').map((t) => t.perks.find((p) => /upgrade/i.test(p))),
  ['Complimentary upgrades as early as 1 day before the flight', 'Upgrades as early as 3 days before the flight', 'Upgrades as early as 5 days before the flight', 'Top upgrade priority, as early as 5 days before the flight']);
check('Aeromexico upgrades: "as early as … before the flight"', ['Gold', 'Platinum', 'Titanium'].map((n) => /as early as \d+ hours (\(5 days\) )?before the flight/.test(tier('aeromexico', n).perks.join(' '))), [true, true, true]);
check('the editor’s Medallion toggle spells out MQDs', markup.includes('Show Delta Medallion progress (Medallion Qualifying Dollars, or MQDs)'), true);
check('Cathay Green chip: "Lounge pass at 200 Status Points"', tier('cathay', 'Green').short.includes('Lounge pass at 200 Status Points'), true);
check('Emirates baggage in plain words', /routes with a bag-count allowance, like the US/.test(tier('emirates', 'Gold').perks.join(' ')), true);

now = new Date(2026, 11, 31, 23, 59).getTime();
check('2026: United Silver spells out PQP once', tier('united', 'Premier Silver').earn, '6,000 Premier qualifying points (PQP), or 5,000 PQP + 15 flights');
check('2026: the United progress note spells out PQP', /^Premier qualifying points \(PQP\) alone/.test(api.trackFor(api.CATALOG_BY_ID.united).note), true);
now = new Date(2027, 0, 1, 0, 0).getTime();
check('2027: United Silver spells out PQP once, 1K stays short', [tier('united', 'Premier Silver').earn, tier('united', 'Premier 1K').earn],
  ['6,000 Premier qualifying points (PQP) a year, with at least 4 flights on United or United Express', '32,000 PQP a year, with at least 4 flights on United or United Express']);
check('2027: the United progress note spells out PQP', /^Premier qualifying points \(PQP\) only/.test(api.trackFor(api.CATALOG_BY_ID.united).note), true);
check('2027: still no shorthand anywhere', jargon(allText()), []);
now = new Date(2026, 10, 15, 12).getTime();

/* ---------- "N% bonus" says bonus what ---------- */

const bare = Object.keys(api.CATALOG_BY_ID).flatMap((id) => (tiers(id) || []).flatMap((t) => t.short.filter((s) => /^\d+% bonus$/.test(s)).map((s) => `${id}: ${s}`)));
check('no bare "N% bonus" chip', bare, []);
check('Hilton Gold: "80% bonus points"; Avianca uses miles', [tier('hilton', 'Gold').short[2], tiers('avianca').some((t) => t.short.some((s) => /^\d+% bonus miles$/.test(s)))], ['80% bonus points', true]);
check('chips that already named a unit are left alone', tier('emirates', 'Silver').short[0], '30% bonus Miles');

/* ---------- One name for each action ---------- */

const visible = markup + js;
check('no "collect" wording on screen', ['then collect your points', 'scan &amp; collect', 'Auto-collect', 'screenshot you collect', "'Collect ", 'screenshots collected', 'screenshot collected'].filter((w) => visible.includes(w)), []);
check('the auto toggle says what it does', [markup.includes('>Auto-update after a scan: on<'), js.includes('`Auto-update after a scan: ${autoCollect ? \'on\' : \'off\'}`')], [true, true]);
check('badges: "Update from a screenshot"', ['Update from a screenshot', 'Update from 5 screenshots', 'Update from 20 screenshots', 'Update from 5 screenshots in a row'].map((w) => js.includes(`how: '${w}'`)), [true, true, true, true]);
check('Your progress: "screenshots used"', js.includes("'screenshot used' : 'screenshots used'"), true);
check('the Type balances button opens "Type balances"', /<h2 id="quick-title"[^>]*>Type balances<\/h2>/.test(markup), true);
check('Bilt Gold from the Palladium: "welcome bonus"', [js.includes("via: 'Bilt Palladium welcome bonus'"), js.includes('welcome offer\', exp')], [true, false]);
check('level-up banner: "Level", not "Lv"', [js.includes('`Level ${reward.levelUp.n} · ${reward.levelUp.name}`'), js.includes('`Lv ${')], [true, false]);

/* ---------- Credit and transfer notes ---------- */

const creditNotes = JSON.stringify(api.CREDITS);
check('Delta Gold rideshare: one wording, no "first card renewal"', [creditNotes.includes('first card renewal'), creditNotes.includes('12 months after account opening'), creditNotes.split('starts once you’ve had the card a year; enroll').length - 1], [false, false, 2]);
check('no SLH or "AA domestic inflight" shorthand', [creditNotes.includes('Small Luxury Hotels (SLH)'), creditNotes.includes('AA domestic inflight'), creditNotes.includes('Food and drink on American Airlines domestic flights')], [true, false, true]);
check('Amex’s U.S.-airline fee note is only for Delta and JetBlue', JSON.stringify(api.TRANSFERS.amex.noteFor), '["delta","jetblue"]');
check('…and a partner page shows a bank’s note only where it applies', js.includes('if (t.note && (!t.noteFor || t.noteFor.includes(c.id)))'), true);
check('"award space" said plainly', [js.includes('confirm award space'), js.includes('first check that the flight or room you want can be booked with points')], [false, true]);

/* ---------- Site password: who does what ---------- */

check('lock: says who adds and removes the code', [js.includes('send the lock code it makes (not the password) to whoever looks after this site'), js.includes('ask whoever looks after the site to remove the code'), js.includes('to be put on the site')], [true, true, false]);
check('lock fine print: plain warning', [markup.includes('Anyone can see the lock code and try guessing passwords against it'), markup.includes('The site is public, so')], [true, false]);

/* ---------- Curly apostrophes ---------- */

check('curly apostrophes', [markup.includes('everyone’s tracker'), markup.includes('Each person’s data'), js.includes('MQDs — you’d keep')], [true, true, true]);

/* ---------- README matches the app ---------- */

check('README: names its one outside download', [readme.includes('no frameworks or external requests'), /only outside download is the screenshot reader/.test(readme)], [false, true]);
const scanPara = readme.split('\n').find((l) => l.startsWith('**Scan & update')) || '';
check('README: no Collect button, scan-card confetti, loot chimes or "New status!"', [...['**Collect**', 'New status!', 'Small chimes', 'Collects within', '**Recent** collects'].filter((w) => readme.includes(w)), ...['confetti', 'fly into'].filter((w) => scanPara.includes(w)), ...['Scan & collect', 'The loot', 'Small chimes'].filter((w) => readme.includes(w))], []);
check('README: level-ups play the fanfare too', readme.includes('A short fanfare plays when you level up'), true);
check('README: Flying Blue and Bilt where they belong', [readme.includes('Choice, and Flying Blue points alive'), /Frontier Miles, Bilt Rewards, /.test(readme), readme.includes('"✓ Breakfast or food credit · Room upgrades · 80% bonus points"')], [true, true, true]);
const section = (title) => readme.split(/\n## /).find((s) => s.startsWith(title)) || '';
check('README: site password under Your data, not Card credits', [section('Card credits').includes('Site password'), section('Your data').includes('Site password')], [false, true]);

/* ---------- A long program name or "whose account" wraps ---------- */

const rule = (sel) => { const m = new RegExp(`(?:^|[}\\s])${sel.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(css); return m ? m[1] : ''; };
check('program sheet title wraps a long word', /overflow-wrap:\s*anywhere/.test(rule('#d-name')), true);
check('the "whose account" tag wraps when it can’t fit', [/white-space:\s*nowrap/.test(rule('.acct')), /overflow-wrap:\s*anywhere/.test(rule('.acct'))], [false, true]);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
