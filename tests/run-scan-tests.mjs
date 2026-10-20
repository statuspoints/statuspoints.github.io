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
vm.runInContext(`${bigSrc}\nglobalThis.big = { bigNumbers, useReread, shakyBeside, useSmallReread };`, context);
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
{ // The re-read replaces the number where it stands, not the same digits inside an earlier number.
  const w = word('16', 100, 200, 300, 400, 70);
  const nights = { text: '16', words: [w] };
  const pass = { text: 'Marriott Bonvoy\nMember 1234516890\nNights\n16\n', lines: [{ text: 'Member 1234516890', words: [] }, nights] };
  bigChecks.push(['“16” re-read as “18” changes the 16 on its own line, not the member number',
    [context.big.useReread(pass, { line: nights, words: [w] }, '18', 95), pass.text, nights.text], [true, 'Marriott Bonvoy\nMember 1234516890\nNights\n18\n', '18']]);
  const v = word('2,450', 100, 300, 300, 400, 70);
  const tile = { text: '2,450', words: [v] };
  const pass2 = { text: 'Points\n12,450 pending\n2,450\n', lines: [{ text: '12,450 pending', words: [] }, tile] };
  bigChecks.push(['“2,450” re-read as “2,460” doesn’t touch “12,450”',
    [context.big.useReread(pass2, { line: tile, words: [v] }, '2,460', 95), pass2.text], [true, 'Points\n12,450 pending\n2,460\n']]);
}
{ // The group's own line and word get the re-read, even when the same number appears more than once.
  const l1 = { text: '16', words: [word('16', 10, 60, 100, 200, 60)] };
  const l2 = { text: '16', words: [word('16', 10, 60, 300, 400, 60)] };
  const pass = { text: 'Nights\n16\nStays\n16\n', lines: [{ text: 'Nights', words: [word('Nights', 10, 90, 50, 70)] }, l1, { text: 'Stays', words: [word('Stays', 10, 90, 250, 270)] }, l2] };
  context.big.useReread(pass, { line: l2, words: l2.words }, '18', 95);
  bigChecks.push(['the same number on two lines: the group’s own line changes', [pass.text, l1.text, l2.text], ['Nights\n16\nStays\n18\n', '16', '18']]);
  const line = { text: 'Night 16 of 16', words: [word('Night', 0, 80, 0, 30), word('16', 90, 120, 0, 30, 60), word('of', 130, 160, 0, 30), word('16', 170, 200, 0, 30, 60)] };
  const one = { text: 'Night 16 of 16\n', lines: [line] };
  context.big.useReread(one, { line, words: [line.words[3]] }, '18', 95);
  bigChecks.push(['the same number twice on a line: the group’s own word changes', one.text, 'Night 16 of 18\n']);
  const comma = { text: 'Hilton Honors', words: [word('Hilton', 0, 80, 0, 30), word('Honors', 90, 180, 0, 30)] };
  const counts = { text: 'Nights 16, stays 4', words: [word('Nights', 0, 80, 50, 80), word('16,', 90, 130, 50, 80, 60), word('stays', 140, 200, 50, 80), word('4', 210, 225, 50, 80)] };
  const withComma = { text: 'Hilton Honors\nNights 16, stays 4\n', lines: [comma, counts] };
  bigChecks.push(['a re-read still applies before a punctuation comma', [context.big.useReread(withComma, { line: counts, words: [counts.words[1]] }, '18', 95), withComma.text],
    [true, 'Hilton Honors\nNights 18, stays 4\n']]);
}
{ // Rows and lines that don't line up, double spaces, and "$" in a word (review of the follow-up).
  const a = { text: '16', words: [word('16', 10, 60, 100, 200, 60)] };
  const b = { text: '16', words: [word('16', 10, 60, 300, 400, 60)] };
  const pass = { text: 'Points\n16\nNights\n16\n', lines: [{ text: 'Points', words: [word('Points', 0, 90, 50, 70)] }, a, b] }; // one line short
  context.big.useReread(pass, { line: b, words: b.words }, '18', 95);
  bigChecks.push(['lines one short of the rows: the 2nd “16” line is the 2nd “16” row', pass.text, 'Points\n16\nNights\n18\n']);
  const sp = { text: 'Points 16', words: [word('Points', 0, 90, 0, 30), word('16', 100, 130, 0, 30, 60)] };
  const spaced = { text: 'Points  16\n', lines: [sp] };
  bigChecks.push(['a row with double spaces still takes the re-read', [context.big.useReread(spaced, { line: sp, words: [sp.words[1]] }, '18', 95), spaced.text], [true, 'Points 18\n']]);
  const dl = { text: "MQDs $'x 16", words: [word('MQDs', 0, 60, 0, 30), word("$'x", 70, 110, 0, 30), word('16', 120, 150, 0, 30, 60)] };
  const dollar = { text: "MQDs $'x 16\nTail\n", lines: [dl, { text: 'Tail', words: [word('Tail', 0, 50, 40, 70)] }] };
  context.big.useReread(dollar, { line: dl, words: [dl.words[2]] }, '18', 95);
  bigChecks.push(['a “$” sequence in a word doesn’t garble the row', dollar.text, "MQDs $'x 18\nTail\n"]);
}
{ // Unsure smaller words on a big number's line (a colored level beside the balance, in a compressed screenshot).
  const qatar = (tierConf = 0) => {
    const top = { text: 'QATAR AIRWAYS Privilege Club', words: [word('QATAR', 40, 160, 40, 70), word('AIRWAYS', 170, 330, 40, 70), word('Privilege', 1300, 1450, 44, 70), word('Club', 1460, 1560, 44, 70)] };
    const bal = { text: 'i 58,940', words: [word('i', 61, 139, 249, 275, tierConf), word('58,940', 1001, 1219, 243, 307, 96)] };
    const small = { text: 'Membership no. 123456789', words: [word('Membership', 60, 230, 315, 340), word('no.', 240, 280, 315, 340), word('123456789', 290, 450, 315, 340)] };
    return { text: 'QATAR AIRWAYS Privilege Club\n\ni 58,940\n\nMembership no. 123456789\n', lines: [top, bal, small] };
  };
  let pass = qatar();
  let runs = context.big.shakyBeside(context.big.bigNumbers(pass.lines));
  bigChecks.push(['an unsure small word beside a big number is read again', runs.map((r) => r.words.map((w) => w.text)), [['i']]]);
  bigChecks.push(['…and a sure re-read replaces it', [context.big.useSmallReread(pass, runs[0], 'Gold\n', 96), pass.text.split('\n')[2]], [true, 'Gold 58,940']]);
  bigChecks.push(['…which the scan reads as the level', context.read({ text: pass.text }).tier, 'Gold']);
  pass = qatar();
  runs = context.big.shakyBeside(context.big.bigNumbers(pass.lines));
  bigChecks.push(['an unsure re-read (70%) changes nothing', [context.big.useSmallReread(pass, runs[0], 'Gold', 70), pass.text.split('\n')[2]], [false, 'i 58,940']]);
  bigChecks.push(['a re-read of two lines changes nothing', context.big.useSmallReread(pass, runs[0], 'Gold\nMember', 96), false]);
  bigChecks.push(['a re-read of only marks changes nothing', context.big.useSmallReread(pass, runs[0], '—', 96), false]);
  bigChecks.push(['a sure small word (95%) isn’t read again', context.big.shakyBeside(context.big.bigNumbers(qatar(95).lines)).length, 0]);
  const tall = { text: 'S8,940 points', words: [word('S8,940', 100, 300, 240, 310, 40), word('82,000', 900, 1100, 240, 310, 96)] };
  bigChecks.push(['an unsure word as tall as the number isn’t (it may be the number)', context.big.shakyBeside(context.big.bigNumbers([tall, ...qatar(95).lines.slice(0, 1)])).length, 0]);
  const two = { text: 'Pl atinum 58,940', words: [word('Pl', 60, 90, 250, 276, 20), word('atinum', 96, 200, 250, 276, 30), word('58,940', 1000, 1220, 243, 307, 96)] };
  const twoPass = { text: 'Pl atinum 58,940\n', lines: [two, ...qatar(95).lines.slice(0, 1)] };
  runs = context.big.shakyBeside(context.big.bigNumbers(twoPass.lines));
  bigChecks.push(['unsure words side by side are read again together', runs.map((r) => r.words.map((w) => w.text)), [['Pl', 'atinum']]]);
  bigChecks.push(['…and replaced by the re-read', [context.big.useSmallReread(twoPass, runs[0], 'Platinum Elite', 94), twoPass.text, two.words.map((w) => w.text)],
    [true, 'Platinum Elite 58,940\n', ['Platinum Elite', '58,940']]]);
  const plain = { text: 'Gold', words: [word('Go1d', 60, 140, 250, 276, 20)] };
  bigChecks.push(['an unsure word on a line without a big number isn’t read again', context.big.shakyBeside(context.big.bigNumbers([plain, ...qatar(95).lines])).length, 0]);
}
{ // Dark bands across a gray screenshot (a header bar with a light logo), read again when nothing names the program.
  vm.runInContext(`${slice('  function darkBands', '  // Each dark band read on its own')}\nglobalThis.big.darkBands = darkBands;`, context);
  const gray = (w, h, shade) => {
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = shade(x, y); px.fill(v, (y * w + x) * 4, (y * w + x) * 4 + 3); }
    return px;
  };
  // A blue header (gray 66) with white logo letters, a 3px rule, and a dark card lower down.
  const page = gray(100, 300, (x, y) => (y < 50 ? (y > 15 && y < 35 && x % 10 < 3 ? 255 : 66) : y >= 120 && y < 123 ? 40 : y >= 200 && y < 240 ? 30 : 255));
  bigChecks.push(['a header bar and a dark card are dark bands; a thin rule isn’t', context.big.darkBands(page, 100, 300), [{ y0: 0, y1: 50 }, { y0: 200, y1: 240 }]]);
  bigChecks.push(['a page dark all over (a third or more) has no bands', context.big.darkBands(gray(100, 300, () => 30), 100, 300), []]);
  bigChecks.push(['a light page has no bands', context.big.darkBands(gray(100, 300, () => 250), 100, 300), []]);
}
for (const [name, got, want] of bigChecks) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} Big number: ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
}
const total = cases.length + guesses.length + bigChecks.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
