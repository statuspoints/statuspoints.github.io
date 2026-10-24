// Checks the screenshot review sheet and Update (from index.html), against a small fake page: picking another
// program reads the text again as that program; typing a value or choosing a level ticks its row; a program removed
// (or added) in another window while the sheet or card was open.
// Usage: node tests/run-fixes-sheet-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => {
  const at = js.indexOf(from);
  if (at < 0) throw new Error(`not found: ${from}`);
  const end = js.indexOf(to, at);
  if (end < 0) throw new Error(`end not found: ${to}`);
  return js.slice(at, end);
};
const base = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
`;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

/* ---------- The review sheet, with its typing listener ---------- */

const fakeDom = `
  class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.listeners = []; this.value = ''; this.checked = false; this.hidden = false; this.className = ''; this.textContent = ''; this.dataset = {}; this.id = ''; this.type = ''; }
    setAttribute(k, v) { if (k === 'id') this.id = v; if (k === 'checked') this.checked = true; if (k === 'value') this.value = String(v); if (k === 'type') this.type = v; if (k === 'class') this.className = v; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = String(v); }
    append(...kids) { for (const k of kids) { if (typeof k === 'string') { this.textContent += k; continue; } if (k.parentNode) k.parentNode.children = k.parentNode.children.filter((c) => c !== k); k.parentNode = this; this.children.push(k); } }
    replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
    get firstElementChild() { return this.children[0] || null; }
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }
    dispatch(type) { const e = { type, target: this }; for (let n = this; n; n = n.parentNode) for (const l of n.listeners) if (l.type === type) { e.currentTarget = n; l.fn(e); } }
    matches(sel) {
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) return this.className.split(' ').includes(sel.slice(1));
      const m = /^(\\w+)\\[type="(\\w+)"\\]$/.exec(sel); if (m) return this.tagName === m[1].toUpperCase() && this.type === m[2];
      return this.tagName === sel.toUpperCase();
    }
    closest(sel) { for (let n = this; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n; return null; }
    querySelector(sel) { for (const c of this.children) { if (c.matches(sel)) return c; const d = c.querySelector(sel); if (d) return d; } return null; }
    focus() {} getBoundingClientRect() { return {}; }
  }
  const body = new El('body');
  for (const id of ['scan-result', 'scan-start', 'scan-again', 'scan-status', 'scan-apply']) { const e = new El('div'); e.setAttribute('id', id); body.append(e); }
  const document = { querySelector: (sel) => body.querySelector(sel), createElement: (tag) => new El(tag) };
`;
const sheet = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${base}${fakeDom}\n${head}\n${piece('  function parseISODate', '  function daysUntil')}
  const state = { programs: [], balances: {}, progress: {}, updated: {}, members: {}, mqd: 0 };
  ${piece('  // Words that identify each program in an account screen', '  // Loads the open-source text reader')}
  const mqdYear = () => new Date().getFullYear();
  ${piece('  const readYears', '\n')}
  ${piece('  function parseEntry', '  function paintNum')}
  let scanned = null;
  ${piece('  const scanField =', '  // The review sheet: the how-to')}
  ${piece('  // Your accounts in a program', '  // The card asks which account')}
  const newProgramId = (name) => 'p' + name.length; // a fresh id for a second account
  ${piece('  function programOptions', '  function applyScan')}
  ${piece('  // Typing a value or choosing a level means using it', '\n\n')}
  globalThis.app = { state, showScanResult, formVals, $, programFromCatalog, CATALOG_BY_ID, scanTiersFor };`, sheet);
const app = sheet.app;
const { $ } = app;
const tierName = (id) => { const v = Number($('#scan-tier').value); return v >= 0 ? app.scanTiersFor(id)[v].name : null; };

// Pasted text that doesn't name the program, then Hilton picked: it's read again as Hilton.
for (const own of [false, true]) {
  app.state.programs.length = 0;
  if (own) app.state.programs.push(app.programFromCatalog(app.CATALOG_BY_ID.hilton));
  app.showScanResult('Diamond Member\nPoints 152,310\nNights this year 61');
  $('#scan-program').value = own ? 'hilton' : 'add:hilton';
  $('#scan-program').dispatch('change');
  check(`picking Hilton (${own ? 'on your list' : 'to add'}) reads the text again as Hilton: Diamond and 61 nights, ticked`,
    [tierName('hilton'), $('#scan-use-tier').checked, $('#scan-progress').value, $('#scan-use-progress').checked],
    ['Diamond', true, '61', true]);
  check(`…and Update takes them (${own ? 'on your list' : 'to add'})`, app.formVals(), { balance: 152310, progress: 61, tierIndex: 2, exp: '' });
}
app.state.programs.length = 0;

// Typing into an unticked row, or choosing a level, ticks it; unticking a box by hand stays unticked.
app.showScanResult('Hilton Honors\nDiamond Member\nNights this year 61');
check('no balance read: its row starts unticked', $('#scan-use-balance').checked, false);
$('#scan-balance').value = '152,310';
$('#scan-balance').dispatch('input');
check('typing a balance ticks its row, and Update takes it', [$('#scan-use-balance').checked, app.formVals().balance], [true, 152310]);
app.showScanResult('Hilton Honors\nPoints 152,310');
$('#scan-tier').value = '2';
$('#scan-tier').dispatch('change');
check('choosing a level in an unticked Status row ticks it', [$('#scan-use-tier').checked, app.formVals().tierIndex], [true, 2]);
app.showScanResult('Hilton Honors\nPoints 152,310');
$('#scan-use-balance').checked = false;
$('#scan-use-balance').dispatch('input');
$('#scan-use-balance').dispatch('change');
check('unticking a box by hand stays unticked', [$('#scan-use-balance').checked, app.formVals().balance], [false, undefined]);

/* ---------- Update with a program removed or added in another window ---------- */

const quietDom = `
  class El { constructor() { this.children = []; this.dataset = {}; } setAttribute() {} append() {} replaceChildren() {} addEventListener() {} querySelectorAll() { return []; } querySelector() { return null; } }
  const document = { querySelector: () => new El(), createElement: () => new El() };
`;
const upd = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError });
vm.runInContext(`${base}${quietDom}\n${head}\n${piece('  function parseISODate', '  function expiryLine')}
  let state = normalize({ programs: [], cards: [] });
  const game = () => state.game;
  const shown = { toasts: [], finished: 0 };
  const showToast = (message) => shown.toasts.push(message);
  const renderAll = () => {}; const rollOver = () => false; const saveNow = () => {}; const markChanged = () => {};
  const award = () => ({ xp: 0, unlocked: [] }); const celebrate = () => {}; const offerBonusLanding = () => {}; const matchesFilter = () => true; let filter = 'all';
  const skipNewsForNewSetup = () => {}; const todayISO = () => '2026-10-20'; const undoTo = () => {};
  const setField = (k, v) => { const [a, id] = k.split(':'); if (a === 'bal') state.balances[id] = v; };
  let batch = null; const finishOne = () => { shown.finished++; }; const nextInQueue = () => {}; const setTimeout = (f) => f();
  const mqdYear = () => new Date().getFullYear();
  ${piece('  const lineExpired', '\n')}
  ${piece('  function scanTiersFor', '  // What follows a number')}
  ${piece('  const medallionProgram', '\n')}
  ${piece('  function medallionFor', '  function updateMedallion')}
  ${piece('  function realChanges', '  const lootText')}
  ${piece('  function applyRead', '  async function celebrate')}
  ${piece('  function newProgramId', '\n\n')}
  ${piece('  // Your accounts in a program', '  // The card asks which account')}
  ${piece('  const daysLeft', '\n')}
  ${piece('  // A level your account already shows above this one', '  // A card\'s benefits page:')}
  globalThis.api = { collect, normalize, programFromCatalog, CATALOG_BY_ID, shown, accountFor, heldAbove, get state() { return state; }, set state(s) { state = s; }, setBatch(b) { batch = b; } };`, upd);
const { api } = upd;
const update = (choice, now) => {
  api.state = api.normalize({ programs: now.map((id) => api.programFromCatalog(api.CATALOG_BY_ID[id])), cards: [] });
  api.shown.toasts.length = 0;
  api.shown.finished = 0;
  api.setBatch({ total: 2, done: 0, collected: 0, xp: 0 });
  let threw = null;
  try { api.collect(choice, { balance: 152310 }, null, null); } catch (e) { threw = String(e); }
  return { threw, toasts: [...api.shown.toasts], finished: api.shown.finished, programs: api.state.programs.map((p) => p.id), hilton: api.state.balances.hilton ?? null };
};
check('Hilton removed in another window: no crash, it says so, the batch moves on, nothing brought back', update('hilton', ['ihg']),
  { threw: null, toasts: ['That program was removed in another window, so nothing was updated'], finished: 1, programs: ['ihg'], hilton: null });
check('“Add Hilton” when another window already added it: that Hilton is updated, not added twice', update('add:hilton', ['hilton', 'ihg']),
  { threw: null, toasts: [], finished: 1, programs: ['hilton', 'ihg'], hilton: 152310 });
check('Hilton still on the list: updated as usual', update('hilton', ['hilton', 'ihg']).hilton, 152310);
check('“Add Hilton” not on the list: added as usual', update('add:hilton', ['ihg']).programs, ['ihg', 'hilton']);

/* ---------- Two accounts in one program ---------- */

// "New account" from the card: a second row for the program, with its own id, balance and member number.
{
  api.state = api.normalize({ programs: [api.programFromCatalog(api.CATALOG_BY_ID.lhw)], cards: [] });
  api.state.members.lhw = '5523190';
  api.state.balances.lhw = 0;
  api.setBatch(null);
  api.collect('new:lhw', { balance: 262, member: '7781204' }, null, null);
  const [first, second] = api.state.programs;
  check('a second account is added beside the first, not in its place', [api.state.programs.length, first.id, second.name, second.id !== 'lhw'], [2, 'lhw', 'Leading Hotels of the World', true]);
  check('…with its own balance and member number; the first keeps its own', [api.state.balances[second.id], api.state.members[second.id], api.state.balances.lhw, api.state.members.lhw], [262, '7781204', 0, '5523190']);
  check('…and the toast says Added', api.shown.toasts.pop(), 'Added Leading Hotels of the World');
  // Which account a screen is, by its member number.
  const who = (member) => { const a = api.accountFor('lhw', member); return [a.own ? a.own.id : null, a.ask]; };
  check('the screen shows the first account’s number: the first', who('5523190'), ['lhw', false]);
  check('the screen shows the second account’s number: the second', who('7781204'), [second.id, false]);
  check('a number saved for neither: ask (it may be a third account)', who('9000001'), [null, true]);
  check('no number on the screen, two accounts: ask', who(null), [null, true]);
  api.state.programs.pop();
  check('one account with a number saved, a different number on the screen: ask', who('9000001'), [null, true]);
  delete api.state.members.lhw;
  check('one account with no number saved: that one, whatever the screen shows', [who('9000001'), who(null)], [['lhw', false], ['lhw', false]]);
  check('no account in that program: nothing to ask', api.accountFor('hilton', '123456789'), { own: null, ask: false });
  // The greeting's name picks the account you labeled.
  api.state.programs.push(api.programFromCatalog(api.CATALOG_BY_ID.lhw));
  const [a, b] = api.state.programs.filter((p) => p.name.startsWith('Leading'));
  b.id = 'lhw-2'; b.who = 'Ms. Lee'; api.state.members.lhw = '5523190';
  const whoN = (member, name) => { const r = api.accountFor('lhw', member, name); return [r.own ? r.own.id : null, r.ask]; };
  check('no number on the screen, the greeting says Ms. Lee: her account', whoN(null, 'Ms. Lee'), ['lhw-2', false]);
  check('…"Ms Lee" and "Lee" count as her too', [whoN(null, 'Ms Lee'), whoN(null, 'Lee')], [['lhw-2', false], ['lhw-2', false]]);
  check('a new number with her name, and no number saved for her yet: her account', whoN('7781204', 'Ms. Lee'), ['lhw-2', false]);
  api.state.members['lhw-2'] = '7781204';
  check('her saved number matches: her account', whoN('7781204', 'Ms. Lee'), ['lhw-2', false]);
  check('her name but a third number: ask', whoN('9000001', 'Ms. Lee'), [null, true]);
  check('a name nobody is labeled with, no number: ask', whoN(null, 'Jordan'), [null, true]);
  check('the first account’s number with her name: the number wins', whoN('5523190', 'Ms. Lee'), ['lhw', false]);
  // A second account added with the greeting's name is labeled with it.
  api.setBatch(null);
  api.collect('new:lhw', { balance: 10, member: '9000001', who: 'Jordan Kim' }, null, null);
  // A card's benefits page can't lower a level your account shows.
  const mar = api.programFromCatalog(api.CATALOG_BY_ID.marriott); mar.status = [{ tier: 'Titanium Elite', via: 'from your account' }];
  check('Titanium Elite held: Gold Elite from a card page is below it', [api.heldAbove(mar, 1), api.heldAbove(mar, 4)], [true, false]);
  mar.status = [{ tier: 'Gold Elite', via: 'from your account', exp: '2025-02-28' }];
  check('an expired higher line doesn’t count', api.heldAbove(mar, 0), false);
  check('a new account takes the greeting as its label', api.state.programs.filter((p) => p.name.startsWith('Leading')).map((p) => p.who || ''), ['', 'Ms. Lee', 'Jordan Kim']);
}

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
