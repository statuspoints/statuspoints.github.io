// Runs the screenshot reader's text parser (from index.html) against tests/scan-cases.mjs.
// Usage: node tests/run-scan-tests.mjs  — exits non-zero if any case fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import cases from './scan-cases.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// The app's constants and helpers up to load(), the date helper, and the parser itself.
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const slice = (from, to) => js.slice(js.indexOf(from), js.indexOf(to));
const parser = slice('  // Words that identify each program in an account screen', '  // Loads the open-source text reader');
const dates = slice('  function parseISODate', '  function daysUntil');

const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: () => null, createElement: () => ({}) };
`;
const context = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}\n${dates}\nconst state = { programs: [], balances: {}, progress: {}, updated: {} };\n${parser}\n
  // A case's text, or each of its readings (passes) with the better one kept, as the app does with a screenshot.
  globalThis.read = (c) => {
    // A reading is its text, or { text, words: [[word, confidence], …] } for how sure the reader was of each word.
    const pass = (x) => (typeof x === 'string' ? { text: x, lines: [] } : { text: x.text, lines: [{ text: '', words: x.words.map(([text, confidence]) => ({ text, confidence })) }] });
    const r = c.passes ? readingOf({ passes: c.passes.map(pass) }).found : parseAccountText(c.text);
    const tiers = r.programId ? scanTiersFor(r.programId) : [];
    return { program: r.programId, balance: r.balances[0] ?? null, tier: r.tierIndex >= 0 ? tiers[r.tierIndex].name : null,
      exp: r.exp, progress: r.progress, alt: r.altProgress, mqd: r.mqd, member: r.member };
  };`, context);

let failed = 0;
for (const c of cases) {
  const got = context.read(c);
  const wrong = Object.entries(c.expect).filter(([k, v]) => (got[k] ?? null) !== v);
  if (wrong.length) {
    failed++;
    console.log(`✗ ${c.name}: ${wrong.map(([k, v]) => `${k} expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k] ?? null)}`).join('; ')}`);
  } else console.log(`✓ ${c.name}`);
}
// A screen that doesn't name its program: the one program on your list whose level it names, else no guess.
const guessSrc = slice('  const GUESS_COMMON', '  // A screen that doesn\'t name its program: pick it on the card');
vm.runInContext(`${guessSrc}
  globalThis.guess = (ids, text) => {
    state.programs = ids.map((id) => ({ ...programFromCatalog(CATALOG_BY_ID[id]), status: [] }));
    try { return guessProgram({ passes: [{ text, lines: [] }] }); } finally { state.programs = []; }
  };`, context);
const unnamed = 'Hello Alex,\nPlatinum Elite Member\nMember #123456789\nYOUR POINTS\n26,948';
const guesses = [
  ['only IHG on your list: IHG', ['ihg'], unnamed, 'ihg'],
  ['IHG and Chase: IHG (Chase has no levels)', ['chase', 'ihg'], unnamed, 'ihg'],
  ['IHG and Marriott both have Platinum Elite: no guess', ['ihg', 'marriott'], unnamed, null],
  ['no listed program has the level: no guess', ['chase', 'delta'], unnamed, null],
  ['no level on screen: no guess', ['ihg'], 'YOUR POINTS\n26,948', null],
];
let guessed = 0;
for (const [name, ids, text, want] of guesses) {
  const got = context.guess(ids, text) ?? null;
  const ok = got === want;
  if (ok) guessed++; else failed++;
  console.log(`${ok ? '✓' : '✗'} Guess: ${name}${ok ? '' : `: expected ${want}, got ${got}`}`);
}
const total = cases.length + guesses.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
