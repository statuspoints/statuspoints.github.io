// Vouchers read from a screenshot or pasted text (index.html's findVouchers and the checks around it), against
// tests/voucher-cases.mjs, plus proof the account reader's own pages don't turn into vouchers: every case in
// tests/scan-cases.mjs and every look-alike page in tests/lookalikes.js is read for vouchers, and none is found
// except on the few that truly show one (listed below, each with why).
// Usage: node tests/run-voucher-tests.mjs — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import cases from './voucher-cases.mjs';
import scanCases from './scan-cases.mjs';
import { pages } from './lookalikes.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
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
const today = new Date(2026, 10, 18).getTime();
class FixedDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(today); }
  static now() { return today; }
}
const context = vm.createContext({ console, Intl, Math, Date: FixedDate, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}\n${dates}\nconst state = { programs: [], balances: {}, progress: {}, updated: {}, vouchers: [] };\n${parser}\n
  globalThis.api = {
    find: (text) => (typeof findVouchers === 'function' ? findVouchers(text) : null),
    scan: (read) => scanVouchers(read),
    // Whether the screen also shows an account, once the vouchers' own numbers are set aside (as the scan card does).
    account: (text, list) => voucherAccount(parseAccountText(text), list),
    found: (text, list) => { const f = parseAccountText(text); voucherAccount(f, list); return f; },
    state: (v, saved, day) => voucherState(v, saved, day),
  };`, context);

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    expected ${JSON.stringify(want)}\n    got      ${JSON.stringify(got)}`}`);
};
const brief = (list) => (list || []).map((v) => ({ name: v.name, note: v.note, exp: v.exp }));

// ---------- The voucher cases ----------
for (const c of cases) {
  const list = context.api.find(c.text);
  check(c.name, brief(list), c.vouchers);
  if (c.unsure && list) check(`${c.name} — waits for a tap`, list.map((v) => !!v.unsure), c.unsure);
  // The confidence gate: added by itself only when its kind, program and date all come from its own lines, nothing
  // contradicts its program, no card words are around it, and its date reads one way.
  if (c.certain && list) check(`${c.name} — ${c.certain.map((x) => (x ? 'certain' : 'waits')).join(', ')}`, list.map((v) => !!v.certain), c.certain);
  if (c.account !== undefined && list) check(`${c.name} — ${c.account ? 'an account too' : 'a voucher alone'}`, context.api.account(c.text, list), c.account);
}
{ // A voucher's date isn't the status's end date: "Valid until Nov 30, 2027" under a free night's "Up to 40,000 points".
  const text = 'IHG One Rewards\nPlatinum Elite\n61,250 points\nAnniversary Free Night\nUp to 40,000 points\nValid until Nov 30, 2027';
  const list = context.api.find(text) || [];
  const f = context.api.found(text, list);
  check('a voucher’s date read as the status’s end is set aside; the balance and level stay', [f.exp, f.balances[0], f.tierIndex >= 0, list.map((v) => v.exp)], [null, 61250, true, ['2027-11-30']]);
  const plain = context.api.found('IHG One Rewards\nPlatinum Elite\nValid until Nov 30, 2027\n61,250 points', []);
  check('…with no voucher on the screen, the status date reads as before', plain.exp, '2027-11-30');
}
// Names fit the voucher list (80) and notes its value / note field (120).
const all = cases.flatMap((c) => context.api.find(c.text) || []);
check('every name fits in 80 characters and every note in 120', all.filter((v) => v.name.length > 80 || v.note.length > 120).map((v) => v.name), []);
{ // A long restriction is cut at a word, not mid-word, to fit with the number.
  const long = context.api.find(`Delta eCredit $75.00\nExpires Sep 28, 2027\neCredit number 0061234567890\nValid only on Delta-marketed and Delta-operated flights departing from airports in the United States, Puerto Rico and the US Virgin Islands, booked on delta.com or the Fly Delta app`) || [];
  check('a long restriction is cut at a word to fit 120 characters', long.map((v) => [v.note.length <= 120, /^No\. 0061234567890 · Delta-marketed/.test(v.note), /…$/.test(v.note)]), [[true, true, true]]);
}

// ---------- Two readings of one screenshot ----------
{
  const one = 'Delta eCredit\n$75.00 USD\nExpires Sep 28, 2027';
  const got = context.api.scan({ passes: [{ text: one }, { text: one.replace('Sep 28', 'Sep 26') }] }) || [];
  check('two readings that disagree on the date: found, marked unsure (the card waits for a tap)', got.map((v) => [v.name, !!v.unsure]), [['Delta $75 eCredit', true]]);
  const same = context.api.scan({ passes: [{ text: one }, { text: one.replace('\n', ' ') }] }) || [];
  check('two readings that agree: not unsure', same.map((v) => [v.name, !!v.unsure]), [['Delta $75 eCredit', false]]);
  const missed = context.api.scan({ passes: [{ text: 'UNITED\nFuture flight credit\n$212.40\nExpires 09/28/2027' }, { text: 'UNITED\nFuture flight credit\nExpires 09/28/2027' }] }) || [];
  check('a reading that missed the big value isn’t a disagreement: not unsure', missed.map((v) => [v.name, !!v.unsure]), [['United $212.40 FutureFlight credit', false]]);
  const banded = context.api.scan({ passes: [{ text: 'Free Night Reward\nExpires Mar 31, 2027' }], bands: 'Hilton Honors' }) || [];
  check('a program named only in a header bar (read on its own) names the voucher', banded.map((v) => v.name), ['Hilton free night']);
  const word = (text, confidence) => ({ text, confidence, bbox: { x0: 0, y0: 0, x1: 9, y1: 9 } });
  const shaky = (sure) => context.api.scan({ passes: [{ text: 'World of Hyatt\nCategory 1-4 Free Night\nAward ID THX2KS\nExpires 12/15/2027',
    lines: [{ text: 'Award ID THX2KS', words: [word('Award', 96), word('ID', 96), word('THX2KS', sure)] }] }] }) || [];
  check('a number the reader wasn’t sure of (60%) is left out of the note', shaky(60).map((v) => [v.number, v.note]), [['', '']]);
  check('…one it was sure of (96%) stays', shaky(96).map((v) => [v.number, v.note]), [['THX2KS', 'No. THX2KS']]);
  const better = context.api.scan({ passes: [{ text: 'Delta eCredit\n$75.00 USD' }, { text: one }] }) || [];
  check('the reading with more of the voucher is the one used', better.map((v) => v.exp), ['2027-09-28']);
}

// ---------- What happens to each voucher on the card ----------
{
  const day = '2026-11-18';
  const saved = [{ name: 'Delta $75 eCredit', note: 'No. 0061234567890 · Delta, Air France and KLM fares only', exp: '2027-09-28' },
    { name: 'Hilton free night', note: '', exp: '2027-03-31' }];
  const v = (name, exp, number = '') => ({ name, exp, number, note: number ? `No. ${number}` : '' });
  check('a new voucher with a date: added', context.api.state(v('United $150 TravelBank cash', '2028-01-31'), saved, day), 'new');
  check('no date on the screen: waits for one', context.api.state(v('Southwest $50 LUV voucher', ''), saved, day), 'date');
  check('expired: not added', context.api.state(v('Delta $50 eCredit', '2026-01-15'), saved, day), 'expired');
  check('expires today: still added', context.api.state(v('Delta $20 eCredit', day), saved, day), 'new');
  check('the same number already saved (another name): already there', context.api.state(v('Delta eCredit', '2027-09-28', '0061234567890'), saved, day), 'have');
  check('the same name and date: already there', context.api.state(v('Hilton free night', '2027-03-31'), saved, day), 'have');
  check('the same name, another date: a second one, added', context.api.state(v('Hilton free night', '2027-09-30'), saved, day), 'new');
  check('no date and no number, the same name saved: waits for a date (it may be a second one; the date settles it)', context.api.state(v('Hilton free night', ''), saved, day), 'date');
  check('no date but a number not saved: waits for its date', context.api.state(v('Hilton free night', '', '7712345678'), saved, day), 'date');
  check('a number that only starts like a saved one: added', context.api.state(v('Delta $75 eCredit', '2027-10-01', '00612345678'), saved, day), 'new');
}

// ---------- Account pages never read as vouchers ----------
// Scan cases that truly show a voucher (each an account page with an award or certificate tile on it): found, with the
// account read as before (the scan card shows both).
const TRULY = {
  'Probe 06: IHG Premier card in Chase app': ['IHG anniversary free night'], // "Anniversary Free Night expires 09/30/2027"
  'Probe 17: Marriott Boundless in Chase app, FNA expiry': ['Marriott free night'], // "Free Night Award expires 06/30/2027"
  'R2 Alaska companion fare date': ['Alaska companion fare'], // "Companion Fare expires Dec 31, 2026"
  'R3-29 Hyatt: award price and Category 1-4 free night expiry': ['Hyatt free night (Category 1-4)'], // "Category 1-4 Free Night expires 05/31/2027"
  'Hyatt: a Suite Upgrade Award’s date': ['Hyatt Suite Upgrade Award'], // "Suite Upgrade Award / Valid through 08/31/2027"
  'Hilton: a Confirmable Upgrade Reward’s date': ['Hilton Confirmable Upgrade Reward'], // "Confirmable Upgrade Reward / Expires 03/31/2027"
  'Hilton: “Upgrade reward expires” on one line': ['Hilton Upgrade Reward'],
  'Hilton: the level and an upgrade reward’s date on one line': ['Hilton Confirmable Upgrade Reward'],
  'Avis: an upgrade coupon’s date': ['Avis One-Car-Class Upgrade Coupon'], // "One-car-class upgrade coupon / Expires 06/30/2027"
  '…and the level’s own date above an award’s is still read': ['Hyatt Suite Upgrade Award'], // "My Awards / Suite Upgrade Award / Expires 08/31/2027"
};
const passText = (p) => (typeof p === 'string' ? p : p.text);
const textsOf = (c) => (c.passes ? c.passes.map(passText) : [c.text]);
const trips = [];
const truly = [];
for (const c of scanCases) {
  const names = [...new Set(textsOf(c).flatMap((t) => (context.api.find(t) || []).map((v) => v.name)))];
  if (TRULY[c.name]) truly.push([c.name, names]);
  else if (names.length) trips.push([c.name, names]);
}
check(`none of the ${scanCases.length - Object.keys(TRULY).length} other scan cases (account pages) reads as a voucher`, trips, []);
check('the scan cases that truly show a voucher: found', truly, Object.entries(TRULY));
// …and the account part of those reads exactly as it did: the voucher's numbers never touch a balance that isn't theirs.
{
  const kept = Object.keys(TRULY).map((name) => {
    const c = scanCases.find((x) => x.name === name);
    const list = context.api.find(c.text) || [];
    const [a, b] = [context.api.found(c.text, []), context.api.found(c.text, list)];
    return [name, JSON.stringify([a.programId, a.balances, a.tierIndex, a.exp, a.member, a.progress, a.mqd]) === JSON.stringify([b.programId, b.balances, b.tierIndex, b.exp, b.member, b.progress, b.mqd]), context.api.account(c.text, list)];
  });
  check('…and their account readings are unchanged with the voucher set aside (and still shown)', kept.filter(([, same, shown]) => !same || !shown), []);
}
// The look-alike pages, as their text reads top to bottom (the words on one baseline as one line).
const pageText = (page) => {
  const rows = [];
  for (const [text, x, y, size] of [...page.text].sort((a, b) => a[2] - b[2] || a[1] - b[1])) {
    const row = rows.find((r) => Math.abs(r.y - y) < Math.min(r.size, size) * 0.6);
    if (row) row.words.push([x, text]); else rows.push({ y, size, words: [[x, text]] });
  }
  return rows.map((r) => r.words.sort((a, b) => a[0] - b[0]).map((w) => w[1]).join(' ')).join('\n');
};
const accountPages = pages.filter((p) => !p.expect.vouchers);
const voucherPages = pages.filter((p) => p.expect.vouchers);
check(`none of the ${accountPages.length} account look-alike pages reads as a voucher`,
  accountPages.map((p) => [p.name, (context.api.find(pageText(p)) || []).map((v) => v.name)]).filter(([, n]) => n.length), []);
for (const p of voucherPages) {
  check(`look-alike: ${p.name}`, (context.api.find(pageText(p)) || []).map((v) => [v.name, v.exp]), p.expect.vouchers);
}
check('there are at least 10 voucher look-alike pages', voucherPages.length >= 10, true);
// Everyday vouchers (wallets, emails, a chat answer, hotel free nights) must add themselves: every one certain.
{
  const clean = cases.filter((c) => /^R6 K\d/.test(c.name));
  const vs = clean.flatMap((c) => context.api.find(c.text) || []);
  check(`all ${vs.length} everyday vouchers (${clean.length} screens) are certain`, [vs.length, vs.filter((v) => v.certain).length], [21, 21]);
}
check('at least 30 voucher cases', cases.filter((c) => c.vouchers.length).length >= 30, true);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
