// Checks the status levels table (from index.html): every program's levels line up with the names the screenshot
// reader knows, each has perks and an official page, free entry levels are marked, and level names match whole.
// Usage: node tests/run-levels-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// The app's constants and helpers up to load(), plus the level names the screenshot reader uses.
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const statusNames = js.match(/ {2}const STATUS_NAMES = \{[\s\S]*?\n {2}\};/)[0];

const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: () => null, createElement: () => ({}) };
`;
const context = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON, URL });
vm.runInContext(`${stubs}\n${head}\n${statusNames}\n
  globalThis.api = { BENEFITS, STATUS_NAMES, OFFICIAL, CHECKED_ON, BENEFITS_CHECKED, findTier };`, context);
const { BENEFITS, STATUS_NAMES, OFFICIAL, CHECKED_ON, BENEFITS_CHECKED, findTier } = context.api;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const index = (id, text) => findTier(BENEFITS[id], text);

// Every program's table
for (const [id, tiers] of Object.entries(BENEFITS)) {
  if (STATUS_NAMES[id]) check(`${id}: levels match the screenshot reader's names`, tiers.map((t) => t.name), STATUS_NAMES[id]);
  check(`${id}: every level says how to earn it and has perks`,
    tiers.filter((t) => !t.earn || !t.short.length || !t.perks.length).map((t) => t.name), []);
  check(`${id}: at most 3 short perks per level`, tiers.filter((t) => t.short.length > 3).map((t) => t.name), []);
  check(`${id}: links to an official https page`, /^https:\/\/[^/]+\.[a-z]+\//.test(OFFICIAL[id] || ''), true);
  check(`${id}: only the first level can be a free entry level`, tiers.slice(1).filter((t) => t.base).map((t) => t.name), []);
  check(`${id}: every level finds itself by name`, tiers.map((t) => index(id, t.name)), tiers.map((_, i) => i));
}
check('every status-names program with levels was checked on a date', Object.keys(BENEFITS).filter((id) => !(CHECKED_ON[id] || BENEFITS_CHECKED)), []);
check('later checks are dated', Object.keys(CHECKED_ON).every((id) => BENEFITS[id] && /^[A-Z][a-z]{2} \d{1,2}, 20\d\d$/.test(CHECKED_ON[id])), true);

// Free entry levels
const bases = Object.entries(BENEFITS).filter(([, tiers]) => tiers[0].base).map(([id, tiers]) => `${id}:${tiers[0].name}`).sort();
check('free entry levels', bases, ['accor:Classic', 'ba:Blue', 'emirates:Blue', 'flyingblue:Explorer', 'qatar:Burgundy', 'turkish:Classic', 'virgin:Red']);
check('an invitation-only top level isn’t an entry level', BENEFITS.accor.at(-1).base, false);

// Whole-name matching where "Elite" and "Plus" are levels of their own
check('Turkish: "Elite Plus"', index('turkish', 'Elite Plus'), 3);
check('Turkish: "Elite"', index('turkish', 'Elite'), 2);
check('Turkish: "Classic Plus"', index('turkish', 'Miles&Smiles Classic Plus'), 1);
check('Turkish: "Plus" alone isn’t a level', index('turkish', 'Plus'), -1);
check('Singapore: "Solitaire PPS Club" over "PPS Club"', index('singapore', 'Solitaire PPS Club'), 3);
check('Singapore: "KrisFlyer Elite Gold"', index('singapore', 'KrisFlyer Elite Gold'), 1);
check('Singapore: "Gold" alone isn’t a level', index('singapore', 'Gold'), -1);
check('BA: "Gold Guest List" over "Gold"', index('ba', 'Gold Guest List'), 4);
check('Hilton still matches without filler words', index('hilton', 'Diamond Reserve status'), 3);
check('Marriott: "Gold" finds Gold Elite', index('marriott', 'Gold'), 1);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
