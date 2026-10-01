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
  globalThis.read = (text) => {
    const r = parseAccountText(text);
    const tiers = r.programId ? scanTiersFor(r.programId) : [];
    return { program: r.programId, balance: r.balances[0] ?? null, tier: r.tierIndex >= 0 ? tiers[r.tierIndex].name : null,
      exp: r.exp, progress: r.progress, alt: r.altProgress, mqd: r.mqd, member: r.member };
  };`, context);

let failed = 0;
for (const c of cases) {
  const got = context.read(c.text);
  const wrong = Object.entries(c.expect).filter(([k, v]) => (got[k] ?? null) !== v);
  if (wrong.length) {
    failed++;
    console.log(`✗ ${c.name}: ${wrong.map(([k, v]) => `${k} expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k] ?? null)}`).join('; ')}`);
  } else console.log(`✓ ${c.name}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
