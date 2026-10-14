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
    const pass = (x) => (typeof x === 'string' ? { text: x, lines: [] }
      : { text: x.text, disputed: x.disputed, lines: [{ text: '', words: (x.words || []).map(([text, confidence]) => ({ text, confidence })) }] });
    const r = c.passes ? readingOf({ passes: c.passes.map(pass) }).found : parseAccountText(c.text);
    const tiers = r.programId ? scanTiersFor(r.programId) : [];
    return { program: r.programId, balance: r.balances[0] ?? null, tier: r.tierIndex >= 0 ? tiers[r.tierIndex].name : null,
      exp: r.exp, progress: r.progress, alt: r.altProgress, mqd: r.mqd, member: r.member, unsure: !!r.unsure };
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
// Big numbers read again on their own: which words count as one big number, and when a re-read replaces them.
const bigSrc = slice('  const boxAround', '  /* ---------- The game');
vm.runInContext(`${bigSrc}\nglobalThis.big = { bigNumbers, useReread };`, context);
const word = (text, x0, x1, y0, y1, confidence = 95) => ({ text, confidence, bbox: { x0, x1, y0, y1 } });
const hilton = () => {
  const top = { text: 'Hilton Honors', words: [word('Hilton', 50, 200, 40, 80), word('Honors', 210, 380, 40, 80)] };
  const merged = { text: 'Gold Member 1 52,31 0', words: [word('Gold', 46, 200, 280, 340), word('Member', 210, 500, 280, 340),
    word('1', 1500, 1530, 240, 330, 97), word('52,31', 1545, 1760, 240, 330, 96), word('0', 1765, 1812, 240, 330, 94)] };
  const low = { text: 'Member #1234567890 Nights this year 21', words: [word('Member', 46, 180, 370, 400), word('#1234567890', 190, 420, 370, 400),
    word('Nights', 1500, 1600, 370, 400), word('this', 1610, 1670, 370, 400), word('year', 1680, 1760, 370, 400), word('21', 1780, 1812, 370, 400)] };
  return { text: 'Hilton Honors\nGold Member 1 52,31 0\nMember #1234567890 Nights this year 21\n', lines: [top, merged, low] };
};
const bigChecks = [];
{
  const pass = hilton();
  const groups = context.big.bigNumbers(pass.lines);
  bigChecks.push(['the split big number is one group; small numbers aren’t', groups.map((g) => g.words.map((w) => w.text).join(' ')), ['1 52,31 0']]);
  bigChecks.push(['a sure re-read replaces it in the text', [context.big.useReread(pass, groups[0], '152,310\n', 96), pass.text.split('\n')[1]], [true, 'Gold Member 152,310']]);
  bigChecks.push(['…and in the line’s words, as one word', pass.lines[1].words.map((w) => w.text), ['Gold', 'Member', '152,310']]);
  bigChecks.push(['…which the scan reads as the balance', context.read({ text: `${pass.text}Points balance` }).balance, 152310]);
}
{
  const pass = hilton();
  const [group] = context.big.bigNumbers(pass.lines);
  bigChecks.push(['an unsure re-read (56%) changes nothing', [context.big.useReread(pass, group, '152,311', 56), pass.text.split('\n')[1]], [false, 'Gold Member 1 52,31 0']]);
  bigChecks.push(['a re-read that isn’t a whole number changes nothing', context.big.useReread(pass, group, '2,', 96), false]);
}
{ // A whole number read as one word: a re-read never loses digits, and only a surer one replaces it.
  const one = (text, confidence) => {
    const w = word(text, 100, 400, 100, 200, confidence);
    const pass = { text: `Points\n${text}\n`, lines: [{ text, words: [w] }] };
    return { pass, group: { line: pass.lines[0], words: [w] } };
  };
  let t = one('128,400', 97);
  bigChecks.push(['“128,400” at 97% isn’t cut to “128” by a re-read', [context.big.useReread(t.pass, t.group, '128', 99), t.pass.text], [false, 'Points\n128,400\n']]);
  t = one('84,250', 96);
  bigChecks.push(['“84,250” at 96% stays when a re-read is no surer (“34,250” at 98%)', context.big.useReread(t.pass, t.group, '34,250', 98), false]);
  t = one('37,900', 83);
  bigChecks.push(['“37,900” at 83% gives way to a clearly surer re-read (“57,900” at 95%)', [context.big.useReread(t.pass, t.group, '57,900', 95), t.pass.text], [true, 'Points\n57,900\n']]);
  t = one('57,900', 82);
  bigChecks.push(['“57,900” at 82% read again as “37,900” at 86%: kept, and noted as read two ways',
    [context.big.useReread(t.pass, t.group, '37,900', 86), t.pass.text, t.pass.disputed], [false, 'Points\n57,900\n', [57900]]]);
}
for (const [name, got, want] of bigChecks) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} Big number: ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
}
const total = cases.length + guesses.length + bigChecks.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
