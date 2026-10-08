// Checks the welcome-bonus math (from index.html): days left, dollars left, status, the "did it post?" rule,
// which program a card's bonus posts to, and that bonuses survive saving, backups, and removing a card.
// Usage: node tests/run-bonus-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// Everything up to `const state = load();` (so a helper used while loading but declared later fails here too),
// plus the date helpers.
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const slice = (from, to) => js.slice(js.indexOf(from), js.indexOf(to));
const dates = slice('  function parseISODate', '  function expiryLine');

const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: () => null, createElement: () => ({}) };
`;
const context = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}\n${dates}\nconst state = load();
  globalThis.api = { bonusProgramFor, cleanBonus, bonusDaysLeft, bonusLeft, bonusStatus, bonusPerWeek, bonusLanded,
    pickLandedBonus, bonusComingUp, bonusDueText, normalize, load, removeCard, restoreCard, clone, CARDS, CATALOG_BY_ID,
    BONUS_SOON_DAYS, BONUS_LAND_DAYS };`, context);
const { api } = context;

// UI pieces that aren't pure, run against a small fake app: the text summary's Coming up lines, and marking a
// bonus earned (from "function x" or a comment line up to the next given line).
const piece = (from, to) => { const at = js.indexOf(from); return js.slice(at, js.indexOf(to, at)); };
const ui = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}\n${dates}
  let state = normalize({ programs: [], cards: ['amex-gold', 'sapphire-preferred'], bonuses: {} });
  const bonuses = () => state.bonuses;
  const creditMoney = (n) => money(n);
  const todayISO = () => '2026-10-08';
  const game = () => state.game;
  const levelOf = (xp) => ({ index: Math.floor(xp / 100) });
  const BADGE_XP = 50;
  const BADGES = [{ id: 'bonus', test: () => Object.values(state.bonuses).some((b) => b.landed) }];
  let bonusEditing = null;
  const cardsSheet = { open: false };
  const shown = { toasts: [], achievements: [] };
  const saveNow = () => {}; const renderAll = () => {}; const renderRenewals = () => {}; const focusBonus = () => {};
  const queueAchievements = (r) => shown.achievements.push(r);
  const showToast = (message, action) => shown.toasts.push({ message, action });
  ${piece('  const bonusFilled', '\n')}
  ${piece('  // One "Coming up" item as a line', '  // A plain-text summary')}
  ${piece('  // The bonus posted: a', '  // A balance that just jumped')}
  globalThis.ui = { comingUpLine, markBonusEarned, shown, getState: () => state, setState: (s) => { state = s; } };`, ui);

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

const today = new Date(2026, 9, 8); // Thu Oct 8, 2026
const bonus = (fields) => ({ points: 80000, program: 'amex', spend: 6000, spent: 0, by: '', landed: '', ...fields });

// Where a card's bonus posts
const programs = (ids) => ids.map((id) => api.bonusProgramFor(id));
check('Amex cards (and Schwab, Morgan Stanley) → Membership Rewards',
  programs(['amex-gold', 'amex-platinum', 'amex-business-platinum', 'schwab-platinum', 'morgan-stanley-platinum', 'amex-green']),
  ['amex', 'amex', 'amex', 'amex', 'amex', 'amex']);
check('Chase Sapphire, Ink, Freedom → Ultimate Rewards',
  programs(['sapphire-preferred', 'sapphire-reserve', 'sapphire-reserve-business', 'ink-preferred', 'freedom-flex', 'freedom-unlimited']),
  ['chase', 'chase', 'chase', 'chase', 'chase', 'chase']);
check('Delta cards → SkyMiles', programs(['delta-blue', 'delta-gold', 'delta-reserve-business']), ['delta', 'delta', 'delta']);
check('Hilton cards → Hilton Honors', programs(['hilton-aspire', 'hilton-surpass', 'hilton-business', 'hilton-amex']), ['hilton', 'hilton', 'hilton', 'hilton']);
check('Marriott cards (Bonvoy, Ritz-Carlton) → Bonvoy', programs(['bonvoy-brilliant', 'bonvoy-boundless', 'ritz-carlton']), ['marriott', 'marriott', 'marriott']);
check('other co-brands go to their airline or hotel',
  programs(['ihg-premier', 'hyatt-card', 'united-quest', 'united-club-business', 'southwest-plus', 'chase-aeroplan', 'aadvantage-executive', 'wyndham-earner', 'atmos-summit', 'bilt-palladium']),
  ['ihg', 'hyatt', 'united', 'united', 'southwest', 'aeroplan', 'american', 'wyndham', 'alaska', 'bilt']);
check('bank cards → the bank’s points', programs(['venture-x', 'savor', 'strata-premier', 'double-cash', 'premium-rewards', 'autograph-journey']),
  ['capitalone', 'capitalone', 'citi', 'citi', 'bofa', 'wellsfargo']);
check('every card has a default program with a balance', api.CARDS.filter((c) => !(api.CATALOG_BY_ID[api.bonusProgramFor(c.id)] || {}).unit).map((c) => c.id), []);
check('an unknown card has no default', api.bonusProgramFor('not-a-card'), '');

// Days left
check('deadline Oct 31 from Oct 8: 23 days', api.bonusDaysLeft(bonus({ by: '2026-10-31' }), today), 23);
check('deadline today: 0', api.bonusDaysLeft(bonus({ by: '2026-10-08' }), today), 0);
check('deadline yesterday: −1', api.bonusDaysLeft(bonus({ by: '2026-10-07' }), today), -1);
check('across the November clock change: whole days', api.bonusDaysLeft(bonus({ by: '2026-11-15' }), new Date(2026, 9, 8, 23, 30)), 38);
check('no deadline: null', api.bonusDaysLeft(bonus({ by: '' }), today), null);

// Dollars left
check('$6,000 required, $4,200 spent: $1,800 left', api.bonusLeft(bonus({ spent: 4200 })), 1800);
check('spent more than required: $0 left', api.bonusLeft(bonus({ spent: 7500 })), 0);
check('spend required not entered: unknown', api.bonusLeft(bonus({ spend: 0, spent: 300 })), null);

// Status
const status = (fields) => api.bonusStatus(bonus(fields), today);
check('more than 30 days to go: on track', [status({ by: '2026-11-08' }), status({ by: '2027-01-31' })], ['on-track', 'on-track']);
check('the last 30 days: due soon', [status({ by: '2026-11-07' }), status({ by: '2026-10-08' })], ['due-soon', 'due-soon']);
check('past the deadline and short: overdue', status({ by: '2026-10-07', spent: 5999 }), 'overdue');
check('spend done: met, even after the deadline', [status({ by: '2026-10-31', spent: 6000 }), status({ by: '2026-09-01', spent: 6000 })], ['met', 'met']);
check('marked earned wins over everything', [status({ by: '2026-09-01', landed: '2026-09-20' }), status({ by: '2026-12-01', spent: 10, landed: '2026-10-01' })], ['earned', 'earned']);
check('no deadline yet: on track', status({ by: '' }), 'on-track');
check('no spend required entered: goes by the deadline', [status({ spend: 0, by: '2026-10-20' }), status({ spend: 0, by: '2026-10-01' })], ['due-soon', 'overdue']);
check('due soon is the last 30 days', api.BONUS_SOON_DAYS, 30);

// Pace
check('$1,800 left with 23 days: about $548 a week', api.bonusPerWeek(bonus({ spent: 4200, by: '2026-10-31' }), today), 548);
check('under a week left: all of it', api.bonusPerWeek(bonus({ spent: 4200, by: '2026-10-12' }), today), 1800);
check('no pace when done, overdue, or undated',
  [api.bonusPerWeek(bonus({ spent: 6000, by: '2026-10-31' }), today), api.bonusPerWeek(bonus({ by: '2026-10-01' }), today), api.bonusPerWeek(bonus({ by: '' }), today)],
  [null, null, null]);

// Did it post? A jump of at least 90% of the bonus while it's open, up to 120 days past the deadline. (These have
// half the spend in; the transfer checks below cover less.)
const landed = (fields, before, after, when = today) => api.bonusLanded(bonus({ spent: 3000, ...fields }), before, after, when);
check('80,000 bonus: +72,000 counts (90%)', landed({ by: '2026-12-01' }, 10000, 82000), true);
check('…+71,999 doesn’t', landed({ by: '2026-12-01' }, 10000, 81999), false);
check('…bonus plus the spend’s own points counts', landed({ by: '2026-12-01' }, 10000, 96000), true);
check('a 75,000 bonus: exactly 67,500 counts', landed({ points: 75000, by: '2026-12-01' }, 0, 67500), true);
check('already marked earned: no offer', landed({ by: '2026-12-01', landed: '2026-10-01' }, 10000, 90000), false);
check('a first balance (nothing before) isn’t a jump', landed({ by: '2026-12-01' }, null, 90000), false);
check('a balance going down isn’t a bonus', landed({ by: '2026-12-01' }, 90000, 10000), false);
check('120 days after the deadline still counts', landed({ by: '2026-06-10' }, 0, 80000), true);
check('121 days after doesn’t', landed({ by: '2026-06-09' }, 0, 80000), false);
check('no deadline entered: still offered', landed({ by: '' }, 0, 80000), true);
// A points transfer into the program (finding: World of Hyatt, $0 of $3,000 spent, 60k moved in from Chase)
const hyatt = (fields) => bonus({ points: 30000, program: 'hyatt', spend: 3000, spent: 0, by: '2026-12-27', ...fields });
check('no spend made yet: a jump is a transfer, not the bonus', api.bonusLanded(hyatt({}), 5000, 65000, today), false);
check('…under half the spend in: still not offered', api.bonusLanded(hyatt({ spent: 1499 }), 5000, 35000, today), false);
check('…half the spend in: offered', api.bonusLanded(hyatt({ spent: 1500 }), 5000, 35000, today), true);
check('…past the deadline it may still post, whatever was typed', api.bonusLanded(hyatt({ by: '2026-10-01' }), 5000, 35000, today), true);
check('…no deadline and no spend in: not offered', api.bonusLanded(hyatt({ by: '' }), 5000, 35000, today), false);
check('a jump of over 1.5× the bonus is a transfer', [api.bonusLanded(hyatt({ spent: 3000 }), 5000, 50000, today), api.bonusLanded(hyatt({ spent: 3000 }), 5000, 50001, today)], [true, false]);
check('no bonus size entered: never offered', landed({ points: 0, by: '2026-12-01' }, 0, 80000), false);
check('the window is 120 days', api.BONUS_LAND_DAYS, 120);

// Saved data
const raw = {
  programs: [{ id: 'amex', name: 'Amex Membership Rewards', unit: 'points', status: [] }],
  cards: ['amex-gold', 'delta-gold', 'sapphire-preferred', 'hilton-surpass'],
  bonuses: {
    'amex-gold': { points: 60000, program: 'amex', spend: 6000, spent: 1234.6, by: '2026-12-01', landed: '' },
    'delta-gold': { points: '80000', spend: -5, spent: 'lots', by: '2026-12-31', landed: 'yesterday' }, // junk values
    'sapphire-preferred': { points: 75000, program: 'avis', spend: 5000, spent: 0, by: '2026-11-01' }, // no balance there
    'hilton-surpass': { points: 0, spend: 0, spent: 0, by: '', landed: '' }, // nothing in it
    'venture-x': { points: 75000, program: 'capitalone', spend: 4000, spent: 0, by: '2026-12-01', landed: '' }, // card not held
  },
};
// As a saved file has it: a "__proto__" key is an ordinary key once parsed.
const rawText = JSON.stringify(raw).replace('"bonuses":{', '"bonuses":{"__proto__":{"points":1,"by":"2026-12-01"},"constructor":{"points":1},');
const s = api.normalize(JSON.parse(rawText));
check('a held card’s bonus is kept, spend rounded to dollars', s.bonuses['amex-gold'], { points: 60000, program: 'amex', spend: 6000, spent: 1235, by: '2026-12-01', landed: '' });
check('junk values become empty; the card’s program fills in', s.bonuses['delta-gold'], { points: 0, program: 'delta', spend: 0, spent: 0, by: '2026-12-31', landed: '' });
check('a bonus with nothing in it is dropped', s.bonuses['hilton-surpass'] ?? null, null);
check('a program with no balance falls back to the card’s', s.bonuses['sapphire-preferred'].program, 'chase');
check('only cards you hold keep a bonus', Object.keys(s.bonuses).sort(), ['amex-gold', 'delta-gold', 'sapphire-preferred']);
check('stray "__proto__" and "constructor" keys change nothing', [s.bonuses.points ?? null, Object.hasOwn(s.bonuses, 'constructor')], [null, false]);
const partial = api.normalize({ programs: [], cards: ['delta-gold'], bonuses: { 'delta-gold': { points: 50000, spend: 2000, by: '2026-12-31' } } });
check('a bonus saved without a program gets the card’s', partial.bonuses['delta-gold'], { points: 50000, program: 'delta', spend: 2000, spent: 0, by: '2026-12-31', landed: '' });
check('a tracker saved before bonuses existed starts with none', api.normalize({ programs: [], cards: ['amex-gold'] }).bonuses, {});
check('a brand-new tracker starts with none', api.load().bonuses, {});
check('backups, links, and Undo (JSON round trips) keep bonuses exactly', api.normalize(JSON.parse(JSON.stringify(s))).bonuses, s.bonuses);

// Removing a card drops its bonus (Undo puts the whole tracker back)
const r = api.normalize(JSON.parse(rawText));
api.removeCard(r, 'amex-gold');
check('removing a card drops its bonus and keeps the others', [r.cards.includes('amex-gold'), Object.keys(r.bonuses).sort()], [false, ['delta-gold', 'sapphire-preferred']]);
const noBonuses = { programs: [], cards: ['amex-gold'], balances: {} };
api.removeCard(noBonuses, 'amex-gold');
check('…and works on a tracker with no bonuses at all', noBonuses.cards, []);

// Which bonus a jump is, when several post to the same program
const cand = (id, fields, before, after) => ({ id, b: bonus({ program: 'chase', ...fields }), before, after });
const csp = (fields) => cand('sapphire-preferred', { points: 60000, spend: 4000, spent: 1000, by: '2026-12-31', ...fields }, 20000, 110000);
const ink = (fields) => cand('ink-preferred', { points: 90000, spend: 8000, spent: 8000, by: '2026-12-31', ...fields }, 20000, 110000);
check('Sapphire Preferred (open, 25% spent) and Ink (spend done), +90,000: the Ink', api.pickLandedBonus([csp(), ink()], today), 'ink-preferred');
check('…even with the Sapphire’s spend half in, the jump matches the Ink exactly', api.pickLandedBonus([csp({ spent: 2000 }), ink()], today), 'ink-preferred');
check('…and with both spends done', api.pickLandedBonus([csp({ spent: 4000 }), ink()], today), 'ink-preferred');
check('a jump that matches neither exactly: the one with its spend done',
  api.pickLandedBonus([cand('a', { points: 60000, spend: 4000, spent: 2500 }, 0, 80000), cand('b', { points: 70000, spend: 4000, spent: 4000 }, 0, 80000)], today), 'b');
check('two bonuses alike in every way: neither (no guessing)',
  api.pickLandedBonus([cand('a', { points: 60000, spent: 6000 }, 0, 60000), cand('b', { points: 60000, spent: 6000 }, 0, 60000)], today), null);
check('one bonus that fits: that one', api.pickLandedBonus([ink()], today), 'ink-preferred');
check('nothing that fits: none', api.pickLandedBonus([csp({ spent: 0 })], today), null);
check('no bonuses: none', api.pickLandedBonus([], today), null);

// Coming up: open bonuses, until 120 days past a missed deadline
const listed = (fields, days, future) => api.bonusComingUp(bonus(fields), days, future, today);
check('an open bonus is listed however far off', listed({ by: '2027-06-01' }, 236), true);
check('a missed one stays 31 days later (it can still post)', listed({ by: '2026-09-07', spent: 5000 }, -31), true);
check('…and 120 days later', listed({ by: '2026-06-10', spent: 5000 }, -120), true);
check('…but not 121', listed({ by: '2026-06-09', spent: 5000 }, -121), false);
check('the calendar takes only ones still ahead', [listed({ by: '2026-10-08' }, 0, true), listed({ by: '2026-10-07' }, -1, true)], [true, false]);
check('spend done or earned: not listed', [listed({ by: '2026-10-31', spent: 6000 }, 23), listed({ by: '2026-10-31', landed: '2026-10-01' }, 23)], [false, false]);

// The headline: says what's owed, or what to enter
check('headline: left to spend', api.bonusDueText(bonus({ spent: 4200 }), 23), '$1,800 left to spend');
check('headline: short after the deadline', api.bonusDueText(bonus({ spent: 5000 }), -3), '$1,000 short');
check('headline: no spend entered asks for it', [api.bonusDueText(bonus({ spend: 0 }), 23), api.bonusDueText(bonus({ spend: 0 }), -3)],
  ['add the spend required', 'spend deadline passed']);

// The text summary's Coming up lines (it used to crash on a bonus)
const gold = { id: 'amex-gold', name: 'Amex Gold' };
check('text summary: a bonus due', ui.ui.comingUpLine({ kind: 'bonus', card: gold, b: bonus({ points: 60000, spent: 4200 }), date: new Date(2026, 9, 31), days: 23 }),
  '- Amex Gold bonus: $1,800 left to spend by Oct 31, 2026, in 23 days');
check('text summary: a bonus overdue', ui.ui.comingUpLine({ kind: 'bonus', card: gold, b: bonus({ spent: 5000 }), date: new Date(2026, 8, 7), days: -31 }),
  '- Amex Gold bonus: $1,000 short, spend deadline was Sep 7, 2026, 31 days ago');
check('text summary: a bonus with no spend entered', ui.ui.comingUpLine({ kind: 'bonus', card: gold, b: bonus({ spend: 0 }), date: new Date(2026, 8, 7), days: -31 }),
  '- Amex Gold bonus: spend deadline was Sep 7, 2026, 31 days ago');
check('text summary: keeping a status still reads as before',
  ui.ui.comingUpLine({ kind: 'keep', name: 'Gold', p: { name: 'Delta SkyMiles' }, text: '$2,000 MQDs to go', date: new Date(2026, 11, 31), days: 84 }),
  '- Keep Gold (Delta SkyMiles): $2,000 MQDs to go by Dec 31, 2026');
check('text summary: a kind it doesn’t know gets a plain line, not a crash', ui.ui.comingUpLine({ kind: 'new-kind', date: new Date(2026, 9, 9), days: 1 }), '- Due Oct 9, 2026, in 1 day');

// Marking earned, then "Not earned yet": spent so far is untouched, so the reminders come back as they were
const app = ui.ui;
app.setState(api.normalize({ programs: [], cards: ['sapphire-preferred'],
  bonuses: { 'sapphire-preferred': { points: 60000, program: 'chase', spend: 4000, spent: 1000, by: '2026-10-31' } } }));
const csb = () => app.getState().bonuses['sapphire-preferred'];
const before = [api.bonusStatus(csb(), today), csb().spent, api.bonusComingUp(csb(), 23, true, today)];
app.markBonusEarned('sapphire-preferred');
check('marking earned sets the date and leaves spent so far alone', [csb().landed, csb().spent, api.bonusStatus(csb(), today)], ['2026-10-08', 1000, 'earned']);
check('…celebrates, with the badge the first time', [app.shown.achievements.length, app.getState().game.badges.bonus], [1, '2026-10-08']);
csb().landed = ''; // what "Not earned yet" does
check('“Not earned yet” puts status, spent, and the calendar reminder back', [api.bonusStatus(csb(), today), csb().spent, api.bonusComingUp(csb(), 23, true, today)], before);
app.shown.toasts.length = 0;
app.setState(api.normalize({ programs: [], cards: ['amex-gold'], bonuses: { 'amex-gold': { by: '2026-12-01' } } }));
app.markBonusEarned('amex-gold');
check('an empty bonus (no size, no spend) can’t be marked earned', [app.getState().bonuses['amex-gold'].landed, app.shown.toasts.length], ['', 0]);

// Undo after removing a card puts back just that card (another card added since stays)
const t = api.normalize({ programs: [], cards: ['amex-platinum', 'sapphire-preferred'],
  bonuses: { 'sapphire-preferred': { points: 60000, spend: 4000, spent: 1000, by: '2026-12-31' } } });
const prev = api.clone(t);
const statusesOf = (st, id) => st.programs.map((p) => [p.id, p.status.filter((l) => l.card === id).map((l) => l.tier)]).filter(([, x]) => x.length);
api.removeCard(t, 'sapphire-preferred');
t.cards.push('venture-x');
api.restoreCard(t, prev, 'sapphire-preferred');
check('the card and its bonus come back; the card added since stays', [t.cards, t.bonuses['sapphire-preferred']],
  [['amex-platinum', 'sapphire-preferred', 'venture-x'], prev.bonuses['sapphire-preferred']]);
check('…with its statuses where they were', statusesOf(t, 'sapphire-preferred'), statusesOf(prev, 'sapphire-preferred'));
check('…and the programs in the same order', t.programs.map((p) => p.id), prev.programs.map((p) => p.id));
const again = api.clone(prev);
api.removeCard(again, 'sapphire-preferred');
again.cards.push('sapphire-preferred'); // picked again before Undo
api.restoreCard(again, prev, 'sapphire-preferred');
check('picked again before Undo: just its bonus comes back', [again.cards.filter((id) => id === 'sapphire-preferred').length, !!again.bonuses['sapphire-preferred']], [1, true]);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
