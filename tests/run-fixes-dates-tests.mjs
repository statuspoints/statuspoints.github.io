// Checks date fixes (from index.html): points kept safe by an elite status that ends get a warning before it ends
// (and land in Coming up), a savings goal says "reached" and 100% only once the balance covers it, and the
// Autograph Journey credit year starts the 1st of the month after the annual fee posts (ticks saved the old way move).
// Usage: node tests/run-fixes-dates-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// The app's constants and helpers up to load(), plus named pieces from after it: a whole top-level function or
// const (its first line, the more-indented lines under it, and a closing "  }" / "  };").
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const defines = (name) => new RegExp(`^  (?:async )?function ${name}\\(|^  (?:const|let) ${name} = `);
const top = (name) => {
  const at = lines.findIndex((l) => defines(name).test(l));
  if (at < 0) throw new Error(`not found in index.html: ${name}`);
  let end = at + 1;
  while (end < lines.length && (/^ {4}/.test(lines[end]) || (lines[end] === '' && /^ {4}/.test(lines[end + 1] || '')))) end++;
  if (/^ {2}[}\])]/.test(lines[end] || '')) end++;
  return lines.slice(at, end).join('\n');
};
const inHead = (name) => lines.slice(0, loadAt).some((l) => defines(name).test(l));
const pieces = ['parseISODate', 'daysUntil', 'isoOf', 'todayISO', 'mergedLines', 'daysLeft', 'lineExpired', 'medallionProgram',
  'entryOnly', 'hasStatus', 'mqdYear', 'medallionThrough', 'effectiveMedallion', 'medallionFor', 'relativeDay', 'bonuses',
  'bonusText', 'statusItem', 'upcomingItems', 'nextRenewal', 'pointsExpiry', 'expiryVerdict', 'goalPct', 'goalMini', 'renderGoal',
  'sortVouchers', 'MONTH_NAMES', 'creditId', 'CREDIT_LAST_DAY', 'creditMoney', 'cents', 'creditPeriod', 'cardCreditDefs', 'heldCredits',
  'CREDIT_USE_MONTHS', 'BILT_SWITCH_CARD', 'biltSwitch', 'dayBefore', 'creditLastDay', 'creditFirstDay', 'biltCreditNote', 'fitCreditPeriod', 'creditPeriodNow', 'CREDIT_FIRST_DAY']
  .filter((name) => !inHead(name) && lines.some((l) => defines(name).test(l)));

// A small fake page: elements remember what's set on them, and $ finds them by selector.
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const textOf = (n) => (n == null || n === false ? '' : typeof n === 'object' ? n.text : String(n));
  const fakeEl = (tag) => ({ tag, attrs: {}, kids: [], hidden: false, className: '', dataset: {}, content: { firstChild: null },
    setAttribute(k, v) { this.attrs[k] = v; }, append(...k) { this.kids.push(...k); }, replaceChildren(...k) { this.kids = k; },
    addEventListener() {}, get text() { return this.kids.flat(Infinity).map(textOf).join(''); }, set textContent(t) { this.kids = [t]; } });
  const els = {};
  const document = { querySelector: (sel) => els[sel] || (els[sel] = fakeEl(sel)), createElement: fakeEl };
`;
let now = new Date(2026, 10, 7, 12); // Sat Nov 7, 2026
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now.getTime(); }
}
const context = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}
  let state = normalize({ programs: [] });
  const scheduleSave = () => {}; const renderPrograms = () => {}; const showToast = () => {};
  const coverLine = () => null; const detailProgram = () => null;
  ${pieces.map(top).join('\n')}
  globalThis.api = { normalize, pointsExpiry, expiryVerdict, upcomingItems, goalMini, renderGoal, creditPeriod, heldCredits,
    els, isoOf, CATALOG_BY_ID, programFromCatalog, getState: () => state, setState: (s) => { state = s; } };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const attempt = (fn) => { try { return fn(); } catch (e) { return `threw ${e.message}`; } };
const at = (y, m, d) => { now = new Date(y, m - 1, d, 12); };
const iso = (d) => (d ? api.isoOf(d) : d);
const textOf = (n) => (n == null || n === false ? '' : typeof n === 'object' ? n.text : String(n));

/* ---------- Points shielded by an elite status that ends ---------- */
const ihg = (status, activity = '2025-10-15') => {
  const p = { ...api.programFromCatalog(api.CATALOG_BY_ID.ihg), status };
  api.setState(api.normalize({ programs: [p], cards: [], balances: { [p.id]: 80000 }, activity: { [p.id]: activity } }));
  return api.getState().programs[0];
};
const expiry = (p) => { const info = api.pointsExpiry(p); return info.exempt ? { exempt: info.exempt } : { date: iso(info.date), days: info.days }; };
const gold = [{ tier: 'Gold Elite', via: 'earned in 2025', exp: '2026-12-31' }];

at(2026, 11, 7);
let p = ihg(gold);
check('IHG Gold thru Dec 31, no activity since Oct 2025: expires the day after the status ends', attempt(() => expiry(p)), { date: '2027-01-01', days: 55 });
check('… and that shows in Coming up', attempt(() => api.upcomingItems().filter((x) => x.kind === 'points').map((x) => iso(x.date))), ['2027-01-01']);
check('… the verdict says the status keeps them safe until it ends', attempt(() => api.expiryVerdict(p).kids.join('')),
  'Your elite status keeps them safe through Dec 31, 2026. Expire Jan 1, 2027 · 55 days left — earn or redeem any amount to reset the clock');
at(2026, 12, 31);
check('Dec 31: one day left', attempt(() => expiry(p)), { date: '2027-01-01', days: 1 });
at(2027, 1, 1);
check('Jan 1, 2027 (status over): expire today, not backdated to Oct 15, 2026', attempt(() => expiry(p)), { date: '2027-01-01', days: 0 });
at(2027, 1, 2);
check('Jan 2, 2027: expired yesterday', attempt(() => expiry(p)), { date: '2027-01-01', days: -1 });
check('… the verdict says the status kept them safe until it ended', attempt(() => api.expiryVerdict(p).kids.join('')),
  'Your elite status kept them safe through Dec 31, 2026. Expired Jan 1, 2027 — contact the program; some reinstate points.');
at(2026, 11, 7);
p = ihg(gold, '2026-06-01');
check('Activity Jun 1, 2026: the normal 12 months (Jun 1, 2027) is after the status ends', attempt(() => expiry(p)), { date: '2027-06-01', days: 206 });
check('… and the verdict has no status note', attempt(() => api.expiryVerdict(p).kids.join('')), 'Safe until Jun 1, 2027 · 206 days left');
p = ihg(gold, '');
check('No last activity date: asks for one (so a reminder can be set) and says the status keeps them safe until it ends',
  attempt(() => api.expiryVerdict(p).kids.join('')), 'Your elite status keeps them safe through Dec 31, 2026. Add your last activity date for a reminder before they expire.');
p = ihg([{ tier: 'Gold Elite', via: 'lifetime', exp: '' }]);
check('A status with no end date still keeps them from expiring', attempt(() => expiry(p)), { exempt: 'your elite status' });
p = ihg([{ tier: 'Gold Elite', via: 'earned in 2025', exp: '2026-12-31' }, { tier: 'Platinum Elite', via: 'card', exp: '' }]);
check('Any status with no end date wins over a dated one', attempt(() => expiry(p)), { exempt: 'your elite status' });
p = ihg([]);
check('No status: the normal date (and already expired)', attempt(() => expiry(p)), { date: '2026-10-15', days: -23 });

/* ---------- Goals ---------- */
const withGoal = (balance, target) => {
  const prog = { ...api.programFromCatalog(api.CATALOG_BY_ID.ana || api.CATALOG_BY_ID.ihg) };
  api.setState(api.normalize({ programs: [prog], cards: [], balances: { [prog.id]: balance }, goals: { [prog.id]: { target, label: 'ANA First' } } }));
  return api.getState().programs[0];
};
const mini = (prog) => { const el = api.goalMini(prog); return [textOf(el.kids[0]), el.kids[1].kids[0].attrs.style]; };
const sheet = (prog) => {
  api.renderGoal(prog);
  const kids = api.els['#d-goal'].kids;
  const bar = kids.find((k) => k && k.attrs && k.attrs.role === 'progressbar');
  return [bar.attrs['aria-valuenow'], bar.kids[0].attrs.style, textOf(kids.find((k) => k && k.attrs && k.className === 'fine'))];
};
p = withGoal(109500, 110000);
check('109,500 of 110,000: the row says 99%, not reached', attempt(() => mini(p)), ['ANA First: 99%', 'width:99%']);
check('… and the sheet\'s bar isn\'t full', attempt(() => sheet(p)), ['99', 'width:99%', `109,500 of 110,000 ${p.unit} (99%)`]);
p = withGoal(99500, 100000);
check('99,500 of 100,000: 99%', attempt(() => mini(p)), ['ANA First: 99%', 'width:99%']);
p = withGoal(110000, 110000);
check('110,000 of 110,000: reached', attempt(() => mini(p)), ['ANA First: reached', 'width:100%']);
check('… and the sheet shows 100%', attempt(() => sheet(p)), ['100', 'width:100%', `110,000 of 110,000 ${p.unit} (100%)`]);
p = withGoal(150000, 110000);
check('Over the goal: reached, bar capped at 100%', attempt(() => mini(p)), ['ANA First: reached', 'width:100%']);
p = withGoal(54990, 110000);
check('Just under half: 49%', attempt(() => mini(p)), ['ANA First: 49%', 'width:49%']);

/* ---------- Autograph Journey's credit year ---------- */
const journey = (fee, extra = {}) => api.setState(api.normalize({ programs: [], cards: ['autograph-journey'], renewals: { 'autograph-journey': fee }, ...extra }));
const period = () => { const x = api.creditPeriod('autograph-journey', 'year', 'card'); return [x.key, x.label, iso(x.start), iso(x.end)]; };
at(2026, 3, 20);
journey('2026-03-15');
check('Fee Mar 15, 2026, on Mar 20, 2026: still the year that started Apr 1, 2025', attempt(period), ['A2025-04-01', 'card year to Mar 31, 2026', '2025-04-01', '2026-03-31']);
at(2027, 3, 20);
check('On Mar 20, 2027: the year Apr 1, 2026 – Mar 31, 2027', attempt(period), ['A2026-04-01', 'card year to Mar 31, 2027', '2026-04-01', '2027-03-31']);
at(2027, 4, 1);
check('On Apr 1, 2027: a new year starts', attempt(period), ['A2027-04-01', 'card year to Mar 31, 2028', '2027-04-01', '2028-03-31']);
at(2027, 1, 5);
journey('2026-12-20');
check('Fee Dec 20: the year starts Jan 1', attempt(period), ['A2027-01-01', 'card year to Dec 31, 2027', '2027-01-01', '2027-12-31']);
at(2026, 12, 31);
check('… so Dec 31 is the last day of the year before', attempt(period), ['A2026-01-01', 'card year to Dec 31, 2026', '2026-01-01', '2026-12-31']);
at(2026, 11, 7);
journey('2026-03-01');
check('Fee on the 1st (Mar 1): the year starts Apr 1', attempt(period), ['A2026-04-01', 'card year to Mar 31, 2027', '2026-04-01', '2027-03-31']);
// Other cards keep the fee date.
api.setState(api.normalize({ programs: [], cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2026-03-15' } }));
check('Other card-year credits still run from the fee date', attempt(() => api.creditPeriod('sapphire-reserve', 'year', 'card').key), 'A2026-03-15');

// Ticks saved under the old fee-date years move to the new year holding the day used.
at(2026, 11, 7);
journey('2026-03-15', { creditsUsed: { 'autograph-journey:airline': 'A2026-03-15' }, creditsUsedOn: { 'autograph-journey:airline': '2026-06-10' },
  creditsLog: { 'autograph-journey:airline': { 'A2026-03-15': true, 'A2025-03-15': true } } });
const s = api.getState();
check('An old tick for this year (used Jun 10) moves to the year from Apr 1, 2026', [s.creditsUsed['autograph-journey:airline'], s.creditsLog['autograph-journey:airline']],
  ['A2026-04-01', { 'A2026-04-01': true, 'A2025-04-01': true }]);
check('… so this year\'s credit still shows as used', attempt(() => api.heldCredits().map((x) => [x.period.key, x.used])), [['A2026-04-01', true]]);
check('… and loading it again leaves it alone', (() => { const again = api.normalize(JSON.parse(JSON.stringify(s))); return [again.creditsUsed['autograph-journey:airline'], again.creditsLog['autograph-journey:airline']]; })(),
  ['A2026-04-01', { 'A2026-04-01': true, 'A2025-04-01': true }]);
journey('2026-03-15', { creditsUsed: { 'autograph-journey:airline': 'A2026-03-15' } });
// Marks saved before the day was kept (before Oct 31, 2026) mean the card year that fee opened: Mar 15, 2026's
// fee opens the year from Apr 1, 2026, not the one before it.
check('A mark with no day kept goes to the year its fee opened (Apr 1, 2026), not the year before',
  [api.getState().creditsUsed['autograph-journey:airline'], api.getState().creditsLog['autograph-journey:airline']], ['A2026-04-01', { 'A2026-04-01': true }]);
check('… so this year\'s $50 still shows as used', attempt(() => api.heldCredits().map((x) => [x.period.key, x.used])), [['A2026-04-01', true]]);
at(2026, 3, 20);
journey('2026-03-15', { creditsUsed: { 'autograph-journey:airline': 'A2026-03-15' } });
check('… but on Mar 20, 2026, before that year starts, it stays in the year running now (from Apr 1, 2025)',
  api.getState().creditsUsed['autograph-journey:airline'], 'A2025-04-01');
at(2026, 11, 7);
journey('2025-12-20', { creditsUsed: { 'autograph-journey:airline': 'A2025-12-20' } });
check('A Dec 20 fee\'s old mark goes to the year from Jan 1 after it', api.getState().creditsUsed['autograph-journey:airline'], 'A2026-01-01');
journey('2026-03-15', { creditsLog: { 'autograph-journey:airline': { 'A2026-03-15': 20 } } });
check('A part-used amount moves too', api.getState().creditsLog['autograph-journey:airline'], { 'A2026-04-01': 20 });

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
