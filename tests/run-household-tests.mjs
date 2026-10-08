// Checks household totals (from index.html): reading every person's tracker, skipping unreadable ones, matching
// programs across people, and adding up balances and dollar values.
// Usage: node tests/run-household-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// The app's constants and helpers up to load(), which include normalize, the catalog, and the household helpers.
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const slice = (from, to) => js.slice(js.indexOf(from), js.indexOf(to));
const dates = slice('  function parseISODate', '  function daysUntil');

const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: () => null, createElement: () => ({}) };
`;
const context = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}\n${dates}\nlet state = null;
  globalThis.api = { householdTrackers, householdHoldings, householdTotal, householdName, householdWorth, trackerWorth, normalize, POOLING, POOLING_AS_OF,
    people, setState: (s) => { state = s; } };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

const tracker = (programs, balances, extra = {}) => ({ programs, balances, cards: [], ...extra });
const hilton = { id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] };
const marriott = { id: 'marriott', name: 'Marriott Bonvoy', unit: 'points', status: [] };
const custom = { id: 'p-x1', name: 'Hilton Honors', unit: 'points', status: [] }; // added by hand: its own id, a catalog name

const me = api.normalize(tracker([hilton, marriott], { hilton: 120000, marriott: 40000 }));
api.setState(me);
const saved = {
  alex: JSON.stringify(tracker([custom], { 'p-x1': 30500 })),
  sam: '{ not json',
  kim: JSON.stringify({ hello: 'world' }), // not tracker data
  lee: JSON.stringify(tracker([marriott], {}, { cpp: { marriott: 1 } })),
};
const read = (id) => saved[id] ?? null;
const list = [{ id: 'me', name: '' }, { id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }, { id: 'kim', name: 'Kim' },
  { id: 'lee', name: 'Lee' }, { id: 'new', name: 'New' }];
api.people.active = 'me';

// Reading trackers
const trackers = api.householdTrackers(list, read);
check('reads everyone it can and skips bad JSON, non-tracker data, and nobody-saved', trackers.map((t) => t.person.id), ['me', 'alex', 'lee']);
check('whoever is showing comes from live state', trackers[0].s === me, true);
check('a read that throws is skipped too', api.householdTrackers([{ id: 'x', name: '' }], () => { throw new Error('denied'); }).length, 0);

// Matching and combining one program
const hiltonRows = api.householdHoldings(trackers, hilton);
check('Hilton matches across a different program id by catalog', hiltonRows.map((r) => [r.person.id, r.balance]), [['me', 120000], ['alex', 30500]]);
check('Hilton combined', api.householdTotal(hiltonRows), 150500);
const marriottRows = api.householdHoldings(trackers, marriott);
check('someone with the program but no balance is listed as null', marriottRows.map((r) => [r.person.id, r.balance]), [['me', 40000], ['lee', null]]);
check('a missing balance adds nothing', api.householdTotal(marriottRows), 40000);
check('a program the catalog doesn’t know isn’t matched', api.householdHoldings(trackers, { id: 'p-z', name: 'Corner Café Club', unit: 'points' }).length, 0);
check('a status-only program isn’t combined', api.householdHoldings(trackers, { id: 'hilton', name: 'Hilton Honors', unit: '' }).length, 0);

// Two accounts in one program (a second "Hilton Honors" row gets its own id): every row counts, for each person
const hilton2 = { id: 'pabc12', name: 'Hilton Honors', unit: 'points', status: [] };
const twoMe = api.normalize(tracker([hilton, hilton2], { hilton: 120000, pabc12: 30000 }));
const twoAlex = tracker([hilton2, hilton], { pabc12: 5000, hilton: 70000 });
const twoSaved = { alex: JSON.stringify(twoAlex) };
api.setState(twoMe);
const twoTrackers = api.householdTrackers(list.slice(0, 2), (id) => twoSaved[id] ?? null);
for (const viewed of [hilton, hilton2]) {
  const rows = api.householdHoldings(twoTrackers, viewed);
  check(`two rows each, viewing ${viewed.id}: everyone's rows added up`, rows.map((r) => [r.person.id, r.balance, r.rows.length]), [['me', 150000, 2], ['alex', 75000, 2]]);
  check(`two rows each, viewing ${viewed.id}: total`, api.householdTotal(rows), 225000);
}
const oneOfTwo = api.normalize(tracker([hilton, hilton2], { hilton: 1000 }));
check('one balance among two rows is that balance', api.householdHoldings([{ person: list[0], s: oneOfTwo }], hilton)[0].balance, 1000);
check('no balance in any row stays null', api.householdHoldings([{ person: list[0], s: api.normalize(tracker([hilton, hilton2], {})) }], hilton)[0].balance, null);
api.setState(me);

// Names in household lists: named people by name, anyone unnamed by their place on the list
check('household names', list.slice(0, 3).map((person) => api.householdName(person, list)), ['Person 1', 'Alex', 'Sam']);
check('a second unnamed person is told apart', api.householdName({ id: 'zz', name: '' }, [...list, { id: 'zz', name: '' }]), 'Person 7');

// Dollar values, each at the person's own cents-per-point
check('worth at typical values (Hilton 0.4¢, Marriott 0.75¢)', api.trackerWorth(me), 120000 * 0.004 + 40000 * 0.0075);
const lee = api.normalize(tracker([marriott], { marriott: 10000 }, { cpp: { marriott: 1 } }));
check('worth uses the person’s own value', api.trackerWorth(lee), 100);

// Household dollar total: rounded per person so the parts add up; hidden values left out, by name only
const marriottOnly = (bal, extra) => api.normalize(tracker([marriott], { marriott: bal }, extra));
const split = api.householdWorth([{ person: list[0], s: marriottOnly(10066) }, { person: list[1], s: marriottOnly(10066) },
  { person: list[2], s: marriottOnly(50000, { hideValues: true }) }, { person: list[4], s: marriottOnly(0) }]);
check('each share rounded first (10,066 × 0.75¢ = $75.495 → $75 each, $150 together)', split.shown.map((t) => [t.person.id, t.worth]), [['me', 75], ['alex', 75]]);
check('someone who hid dollar values is left out and only named', split.hidden.map((person) => person.id), ['sam']);

// Pooling table
check('pooling rules are dated', api.POOLING_AS_OF, 'October 2026');
check('Hilton pooling is known; Wyndham isn\'t listed (its terms don\'t allow sharing)', [!!api.POOLING.hilton, 'wyndham' in api.POOLING], [true, false]);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
