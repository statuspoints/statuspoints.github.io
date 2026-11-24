// Several programs' balances on one page (index.html's findBalances / readBalances and the scan card's balances card):
// the made-up pages in tests/multi-cases.mjs, each row's program, balance and whether it updates by itself (the
// confidence gate); proof that pages about one program are never split (every case in tests/scan-cases.mjs and
// tests/voucher-cases.mjs, every look-alike page in tests/lookalikes.js); and the card on a small fake page: Update
// all, Undo all, rows that wait, two accounts, Fix something, vouchers alongside.
// Usage: node tests/run-multi-tests.mjs — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import cases from './multi-cases.mjs';
import scanCases from './scan-cases.mjs';
import voucherCases from './voucher-cases.mjs';
import { pages } from './lookalikes.js';

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

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    expected ${JSON.stringify(want)}\n    got      ${JSON.stringify(got)}`}`);
};

/* ---------- The reader ---------- */

const today = new Date(2026, 10, 24).getTime();
class FixedDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(today); }
  static now() { return today; }
}
const reader = vm.createContext({ console, Intl, Math, Date: FixedDate, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: () => null, createElement: () => ({}) };
  ${head}
  ${piece('  function parseISODate', '  function daysUntil')}
  const state = { programs: [], balances: {}, progress: {}, updated: {}, vouchers: [] };
  ${piece('  // Words that identify each program in an account screen', '  // Loads the open-source text reader')}
  globalThis.api = { find: (text) => findBalances(text), read: (read, vouchers) => readBalances(read, vouchers), vouchers: (text) => findVouchers(text),
    tier: (id, i) => (i >= 0 ? scanTiersFor(id)[i].name : null) };`, reader);
const R = reader.api;
const brief = (rows) => rows.map((r) => [r.id, r.balance, !r.check.length]);

for (const c of cases) {
  const rows = R.find(c.text);
  check(c.name, brief(rows), c.rows);
  // Why a row waits: the reasons named for it.
  // Never certain about a number the user doesn't hold: every certain row is one of the page's true balances.
  if (c.truth && !c.amb) check(`${c.name} — no certain row outside the true balances`, rows.filter((r) => !r.check.length && c.truth[r.id] !== r.balance).map((r) => [r.id, r.balance]), []);
  for (const [id, why] of Object.entries(c.why || {})) check(`${c.name} — ${id} waits: ${why.join(', ')}`, why.every((w) => rows.filter((r) => r.id === id).every((r) => r.check.includes(w))), true);
  if (c.tiers || c.members) {
    const read = R.read({ passes: [{ text: c.text, lines: [] }] }) || [];
    for (const [id, tier] of Object.entries(c.tiers || {})) check(`${c.name} — ${id}’s level ${tier}`, R.tier(id, (read.find((r) => r.id === id) || {}).tierIndex ?? -1), tier);
    for (const [id, member] of Object.entries(c.members || {})) check(`${c.name} — ${id}’s member number`, (read.find((r) => r.id === id) || {}).member, member);
  }
}
check('at least 40 made-up pages, positives and negatives', [cases.length >= 40, cases.filter((c) => c.rows.length).length >= 20, cases.filter((c) => !c.rows.length).length >= 15], [true, true, true]);

// Readings of a screenshot: the one that found the most programs; a number another reading read differently, or one the
// reader wasn't sure of, or one cut off at the picture's edge, waits.
{
  const one = 'Delta SkyMiles 84,250 miles\nHilton Honors 212,500 points';
  const word = (text, confidence, x0 = 100) => ({ text, confidence, bbox: { x0, y0: 100, x1: x0 + 80, y1: 130 } });
  const lined = (text, sure = 96) => ({ text, lines: text.split('\n').map((l) => ({ text: l, words: l.split(' ').map((w, i) => word(w, sure, 100 + i * 100)) })) });
  check('one reading: both certain', brief(R.read({ passes: [lined(one)], width: 2000, height: 1000 })), [['delta', 84250, true], ['hilton', 212500, true]]);
  check('a second reading with Hilton read 242,500: Hilton waits', brief(R.read({ passes: [lined(one), lined(one.replace('212,500', '242,500'))], width: 2000, height: 1000 })),
    [['delta', 84250, true], ['hilton', 212500, false]]);
  check('…its reason is that the number was hard to read', R.read({ passes: [lined(one), lined(one.replace('212,500', '242,500'))], width: 2000, height: 1000 })[1].check, ['read']);
  check('a second reading that missed Hilton isn’t a disagreement', brief(R.read({ passes: [lined(one), lined('Delta SkyMiles 84,250 miles')], width: 2000, height: 1000 })),
    [['delta', 84250, true], ['hilton', 212500, true]]);
  const shaky = lined(one);
  shaky.lines[1].words[2].confidence = 71;
  check('the reader 71% sure of Hilton’s number: Hilton waits', brief(R.read({ passes: [shaky], width: 2000, height: 1000 })), [['delta', 84250, true], ['hilton', 212500, false]]);
  check('a number touching the picture’s edge waits', brief(R.read({ passes: [lined(one)], width: 2000, height: 131 })), [['delta', 84250, false], ['hilton', 212500, false]]);
  check('the reading naming two programs wins over one naming one', brief(R.read({ passes: [lined('Delta SkyMiles 84,250 miles\nHiltn 212,500'), lined(one)], width: 2000, height: 1000 })),
    [['delta', 84250, true], ['hilton', 212500, true]]);
  check('one program’s page: no rows (null)', R.read({ passes: [lined('Delta SkyMiles\nGold Medallion\n84,250 miles\nMQDs $11,240')] }), null);
  // A voucher's own number ("35,000 points" on a free night) is never a program's balance.
  const page = 'Hilton Honors 212,500 points\nMarriott Bonvoy 35,000 points\nMarriott Free Night Award\nUp to 35,000 points\nExpires Mar 31, 2027';
  check('a number a voucher on the page holds: without the voucher read, it’s read as Marriott’s balance (waiting: the voucher’s lines aren’t balances)', brief(R.read({ passes: [{ text: page, lines: [] }] }) || []), [['hilton', 212500, false], ['marriott', 35000, false]]);
  check('…with it, it’s set aside (as the one-program card does), leaving one program (no rows)', R.read({ passes: [{ text: page, lines: [] }] }, R.vouchers(page)), null);
  for (const t of ['Hilton Honors 212,500 points\nMarriott Bonvoy\nFree Night Award (35K)\n35,000 points\nExpires Mar 31, 2027', 'Hilton Honors 212,500 points\nMarriott Bonvoy\nFree Night Award\nUp to\n35,000 points']) {
    check(`a free night’s points under a program’s name are never its balance: ${JSON.stringify(t.split('\n').slice(2, 4).join(' / '))}`, R.find(t), []);
  }
  check('pasted text works the same as a screenshot', brief(R.read({ passes: [{ text: 'Delta 84,250 miles, Hilton 212,500 points', lines: [] }] })), [['delta', 84250, true], ['hilton', 212500, true]]);
}

/* ---------- Pages about one program are never split ---------- */

// The one page among the reader's cases that truly shows two programs' balances (an Amex page with a Delta card's
// SkyMiles and the Membership Rewards points), with what it reads.
const truly = { '…nor from the card list above the Delta card’s miles': [['delta', 88430, false], ['amex', 212480, false]] }; // waits: its card list is more than balances
const split = [];
for (const c of scanCases) {
  for (const [k, t] of [c.text, ...(c.passes || []).map((p) => (typeof p === 'string' ? p : p.text))].entries()) {
    if (!t) continue;
    const rows = brief(R.find(t));
    if (rows.length && JSON.stringify(rows) !== JSON.stringify(truly[c.name])) split.push(`${c.name}${k ? ` (reading ${k})` : ''}: ${JSON.stringify(rows)}`);
  }
}
check(`none of the ${scanCases.length} one-program scan cases is read as several programs (except the Amex page above)`, split, []);
check('…and that Amex page reads both of its balances', brief(R.find(scanCases.find((c) => truly[c.name]).text)), Object.values(truly)[0]);
check(`none of the ${voucherCases.length} voucher pages is read as several programs`, voucherCases.filter((c) => R.find(c.text).length).map((c) => c.name), []);
// A look-alike page's words in reading order (top to bottom, then left to right), and column by column.
const asRead = (p) => {
  const items = [...p.text].sort((a, b) => a[2] - b[2] || a[1] - b[1]);
  const rows = [];
  for (const it of items) { const last = rows[rows.length - 1]; if (last && Math.abs(last.y - it[2]) < 12) last.t.push(it[0]); else rows.push({ y: it[2], t: [it[0]] }); }
  return [rows.map((r) => r.t.join(' ')).join('\n'), [...p.text].sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]).join('\n')];
};
const single = pages.filter((p) => !(p.expect && p.expect.many) && !(p.expect && p.expect.balances));
check(`none of the ${single.length} one-program look-alike pages is read as several programs`, single.filter((p) => asRead(p).some((t) => R.find(t).length)).map((p) => p.name), []);
const multi = pages.filter((p) => p.expect && p.expect.balances);
check('the look-alike pages of several programs read their rows (as text)', multi.map((p) => [p.name, R.find(asRead(p)[0]).map((r) => [r.id, r.balance])]),
  multi.map((p) => [p.name, p.expect.balances.map(([id, v]) => [id, v])]));

/* ---------- The card ---------- */

// A small DOM: enough of elements, selects (a value with no matching option is '', as in a browser), dialogs and
// events for the card, the review sheet and the Edit sheet.
const fakeDom = `
  class El {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.listeners = []; this._value = ''; this.checked = false;
      this.hidden = false; this.className = ''; this.textContent = ''; this.dataset = {}; this.id = ''; this.type = ''; this.open = false; this.defaultValue = '';
      this.style = { setProperty() {}, cssText: '' };
      const cl = () => this.className.split(' ').filter(Boolean);
      this.classList = { add: (...n) => { this.className = [...new Set([...cl(), ...n])].join(' '); }, remove: (...n) => { this.className = cl().filter((c) => !n.includes(c)).join(' '); },
        toggle: (n) => { const has = cl().includes(n); if (has) this.classList.remove(n); else this.classList.add(n); return !has; }, contains: (n) => cl().includes(n) };
    }
    get options() { const out = []; const walk = (el) => { for (const c of el.children) { if (c.tagName === 'OPTION') out.push(c); walk(c); } }; walk(this); return out; }
    get value() {
      if (this.tagName !== 'SELECT') return this._value;
      const opts = this.options;
      return opts.some((o) => o._value === this._value) ? this._value : (opts[0] ? opts[0]._value : '');
    }
    set value(v) { this._value = String(v); }
    get content() { return { firstChild: null }; }
    get innerText() { return [this.textContent, ...this.children.map((c) => c.innerText)].filter(Boolean).join('\\n'); }
    setAttribute(k, v) {
      (this.attrs || (this.attrs = {}))[k] = String(v);
      if (k === 'id') this.id = v; if (k === 'checked') this.checked = true; if (k === 'value') { this._value = String(v); this.defaultValue = String(v); }
      if (k === 'type') this.type = v; if (k === 'class') this.className = v; if (k === 'src') this.src = v;
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = String(v);
    }
    removeAttribute(k) { if (k === 'src') delete this.src; }
    append(...kids) { for (const k of kids) { if (typeof k === 'string') { this.textContent += k; continue; } if (k.parentNode) k.parentNode.children = k.parentNode.children.filter((c) => c !== k); k.parentNode = this; this.children.push(k); } }
    replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
    replaceWith(n) { const p = this.parentNode; if (!p) return; const i = p.children.indexOf(this); if (n.parentNode) n.parentNode.children = n.parentNode.children.filter((c) => c !== n); p.children[i] = n; n.parentNode = p; this.parentNode = null; }
    remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    get parentElement() { return this.parentNode; }
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }
    dispatch(type) { const e = { type, target: this, preventDefault() {} }; for (let n = this; n; n = n.parentNode) for (const l of [...n.listeners]) if (l.type === type) { e.currentTarget = n; l.fn(e); } }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    matches(sel) {
      if (sel === 'dialog[open]') return this.tagName === 'DIALOG' && this.open;
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) return this.className.split(' ').includes(sel.slice(1));
      const m = /^(\\w+)\\[type="(\\w+)"\\]$/.exec(sel); if (m) return this.tagName === m[1].toUpperCase() && this.type === m[2];
      return this.tagName === sel.toUpperCase();
    }
    closest(sel) { for (let n = this; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n; return null; }
    querySelectorAll(sel) {
      const [first, ...rest] = sel.trim().split(/\\s+/);
      const out = [];
      const walk = (el) => { for (const c of el.children) { if (c.matches(first)) out.push(c); walk(c); } };
      walk(this);
      return rest.length ? out.flatMap((el) => el.querySelectorAll(rest.join(' '))) : out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    focus() {} select() {} getBoundingClientRect() { return {}; }
  }
  const body = new El('body');
  const make = (tag, id, parent = body) => { const e = new El(tag); e.setAttribute('id', id); parent.append(e); return e; };
  const playEl = make('dialog', 'play');
  for (const id of ['play-shot', 'play-img', 'play-loot', 'play-title', 'play-xp', 'play-actions', 'play-marks', 'play-count', 'play-skip', 'play-close']) make('div', id, playEl);
  const scanEl = make('dialog', 'scan-sheet');
  for (const id of ['scan-result', 'scan-start', 'scan-again', 'scan-status', 'scan-apply', 'scan-preview', 'scan-text', 'scan-file']) make('div', id, scanEl);
  const sheetEl = make('dialog', 'sheet');
  const formEl = make('form', 'sheet-form', sheetEl);
  for (const id of ['sheet-title', 'p-name', 'p-unit', 'p-member', 'p-who', 'p-medallion', 'p-medallion-wrap', 'p-status', 'p-delete', 'p-add-status', 'p-cancel', 'p-suggest']) make(id === 'p-status' ? 'div' : 'input', id, formEl);
  make('div', 'say'); make('div', 'achieve');
  const document = { body, querySelector: (sel) => body.querySelector(sel), querySelectorAll: (sel) => body.querySelectorAll(sel), createElement: (tag) => new El(tag) };
`;
const base = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const URL = { createObjectURL: () => 'blob:shot', revokeObjectURL() {} };
  const shown = { toasts: [], undo: null, countdowns: 0, played: [], timers: [] };
  // Timers wait for flush(), as the next screenshot in a batch waits for the points to land.
  const setTimeout = (fn) => { shown.timers.push(fn); return shown.timers.length; };
  const setInterval = () => { shown.countdowns++; return 1; };
  const clearInterval = () => {};
`;
const ctx = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Promise });
vm.runInContext(`${base}${fakeDom}
  ${head}
  ${piece('  function parseISODate', '  function expiryLine')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  svgIcon = () => null; // no <template> here
  let state = normalize({ programs: [], cards: [] });
  const game = () => state.game;
  const topLayer = () => body;
  const showToast = (message, onUndo) => { shown.toasts.push(message); shown.undo = onUndo || null; };
  const hideToast = () => {}; const showNote = (m) => shown.toasts.push(m); let undoAction = null;
  const renderAll = () => {}; const renderPrograms = () => {}; const renderSafely = () => {}; const rollOver = () => false;
  const saveNow = () => {}; const markChanged = () => {}; const scheduleSave = () => {}; const skipNewsForNewSetup = () => {};
  const award = () => ({ xp: 0, unlocked: [] }); const offerBonusLanding = () => {}; const matchesFilter = () => true; let filter = 'all';
  const unlockSound = () => true; const sound = () => {}; const gameIcon = () => null;
  const setField = (k, v) => { const [a, id] = k.split(/:(.*)/s); if (a === 'bal') state.balances[id] = v; else if (a === 'prog') state.progress[id] = v; else state.mqd = v; state.updated[a === 'mqd' ? 'mqd' : id] = todayISO(); };
  let combo = 0; let lastCollectAt = 0;
  ${piece('  const signed', '\n')}
  ${piece('  const lineExpired', '\n')}
  ${piece('  const daysLeft', '\n')}
  ${piece('  const medallionProgram', '\n')}
  ${piece('  const mdy', '\n')}
  const mqdYear = () => new Date().getFullYear();
  ${piece('  function mqdGoal', '  function mqdNextText')}
  ${piece('  function medallionFor', '  function updateMedallion')}
  ${piece('  function relativeDay', '  function openDetail')}
  ${piece('  function parseEntry', '  function paintNum')}
  ${piece('  // Words that identify each program in an account screen', '  // Loads the open-source text reader')}
  ${piece('  const scanSheet = ', '  let pickHint')}
  let pickHint = null; let replacePick = false;
  const pickImage = () => {}; const pickFor = (id) => { pickHint = { id, at: Date.now() }; }; const pickAnother = () => {};
  let autoCollect = true;
  ${piece("  const play = $('#play');", '  // Another sheet is open')}
  const playScan = (file, hint = null) => { shown.played.push(file); playing = { url: 'blob:shot', hint, taken: null }; };
  ${piece('  function setActions', '  // What a recognized screen updates')}
  ${piece('  // What a recognized screen updates', '  async function celebrate')}
  const celebrate = () => { if (batch) setTimeout(nextInQueue); };
  let quietClose = false;
  scanSheet.addEventListener('close', () => { if (quietClose) { quietClose = false; return; } if (batch) { finishOne(false); nextInQueue(); } });
  ${piece('  const sheet = $(\'#sheet\');', "  $('#p-name').addEventListener")}
  ${piece("  $('#sheet-form').addEventListener('submit'", "  $('#p-cancel')")}
  globalThis.api = {
    $, shown, normalize, programFromCatalog, CATALOG_BY_ID, nameOf, showLoot, collect, accountFor, programOptions, showScanResult, scanFields, formVals, applyScan, undoTo,
    staleCounts, readYears, fixPlay, collectNow, openSheet, cleanPrograms, sheetEl, formEl, playEl, scanEl, setManyRow, readBalances, newBatch,
    get state() { return state; }, set state(s) { state = s; }, get playing() { return playing; }, set playing(p) { playing = p; },
    get batch() { return batch; }, set batch(b) { batch = b; }, scanQueue, flush: () => { while (shown.timers.length) shown.timers.shift()(); }, set autoCollect(v) { autoCollect = v; }, setHint: (id) => { pickHint = { id, at: Date.now() }; },
  };`, ctx);
const { api } = ctx;
const { $, shown } = api;
ctx.renderVouchers = () => {};
const shot = (text) => ({ text, passes: [{ text, lines: [] }], width: 100, height: 100 });
const program = (id) => api.programFromCatalog(api.CATALOG_BY_ID[id]);
const reset = (programs, extra = {}) => {
  api.state = api.normalize({ programs, cards: [], ...extra });
  shown.toasts.length = 0; shown.undo = null; shown.countdowns = 0; shown.played.length = 0;
  api.batch = null; api.scanQueue.length = 0; shown.timers.length = 0;
  api.playEl.open = true;
  api.scanEl.open = false; // the review sheet a "Fix something" left open
  api.autoCollect = true;
  api.playing = { url: 'blob:shot', hint: null, taken: null };
};
const title = () => $('#play-title').textContent;
const label = () => ($('#play-collect-label') || {}).textContent;
const rowsText = () => $('#play-loot').children.map((li) => li.innerText.replace(/\n/g, ' | '));
const tags = () => $('#play-loot').children.filter((li) => li.className.includes('loot-many')).map((li) => (li.children.find((c) => c.className.split(' ').includes('loot-tag')) || {}).textContent ?? null);
const tap = (text) => { const btn = $('#play-actions').children.find((b) => b.innerText.includes(text)); if (!btn) throw new Error(`no button ${text}`); btn.dispatch('click'); };
const done = () => { api.flush(); return shown.toasts[shown.toasts.length - 1]; };
const bal = (id) => api.state.balances[id];

const CHAT = 'Delta 84,250 miles, Hilton 212,500 points, Marriott 156,000 points';
{ // Every row certain: counts down, Update all saves each, one toast, one Undo.
  reset([program('delta'), program('hilton'), program('marriott')], { balances: { delta: 80000, hilton: 200000, marriott: 150000 } });
  api.showLoot(shot(CHAT));
  check('three programs: the balances card, counting down, “Update all”', [title(), label(), shown.countdowns, tags()], ['Found 3 programs on this page', 'Update all', 1, ['+4,250', '+12,500', '+6,000']]);
  check('…each row says its balance', rowsText().map((t) => t.split(' | ').slice(1, 3).join(' | ')), ['Delta SkyMiles | 84,250 miles', 'Hilton Honors | 212,500 points', 'Marriott Bonvoy | 156,000 points']);
  api.collectNow();
  check('…Update all: every balance saved', [bal('delta'), bal('hilton'), bal('marriott')], [84250, 212500, 156000]);
  check('…one toast for all, with Undo', [done(), typeof shown.undo], ['Updated 3 programs', 'function']);
  shown.undo();
  check('…Undo puts all three back', [bal('delta'), bal('hilton'), bal('marriott')], [80000, 200000, 150000]);
}
{ // A program you don't track is never added by itself: it waits for a tick, which adds it.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot(CHAT));
  check('Marriott not on your list: it waits (“tick to add it”), the others count down', [label(), shown.countdowns, rowsText()[2].includes('it isn’t on your list yet — tick to add it'), tags()[2]], ['Update 2', 1, true, 'New']);
  api.setManyRow(2, { on: true });
  api.collectNow();
  check('…ticked: added with the others, one toast', [bal('marriott') !== undefined, api.state.programs.map((p) => p.id), done()], [true, ['delta', 'hilton', 'marriott'], 'Updated 3 programs']);
  shown.undo();
  check('…Undo takes it off again', api.state.programs.map((p) => p.id), ['delta', 'hilton']);
}
{ // A page with other people's balances, or prices: every row waits, the reason said once above them.
  reset([program('delta'), program('hilton'), program('marriott'), program('hyatt')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Alex Rivera\nDelta SkyMiles 84,250 miles\nHilton Honors 212,500 points\nSam Rivera\nMarriott Bonvoy 40,000 points\nWorld of Hyatt 12,000 points'));
  check('owners on the page: nothing counts down, one “Check this first” line, every row unticked', [shown.countdowns, label(), rowsText()[0], api.playing.many.map((it) => it.on)],
    [0, 'Update', 'Check this first | This screen may show other people’s balances — check each row is yours before updating it.', [false, false, false, false]]);
  api.collectNow();
  check('…Update with nothing ticked saves nothing', [bal('delta'), bal('marriott')], [80000, undefined]);
  reset([program('delta'), program('united')], { balances: { delta: 80000 } });
  api.showLoot(shot('Delta 60,000 miles RT\nUnited 70,000 miles RT'));
  check('award prices: nothing counts down, the page’s reason once', [shown.countdowns, rowsText()[0]], [0, 'Check this first | This screen looks like prices or offers — check each row before updating it.']);
}
{ // An update stamp: a fresh one is just a stamp; one more than 7 days old holds the page, saying when.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nHilton Honors 212,500 points\nUpdated today'));
  check('“Updated today” under the list: both rows ticked, counting down', [api.playing.many.map((it) => it.on), shown.countdowns], [[true, true], 1]);
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Updated Mar 2023\nDelta SkyMiles 40,000 miles\nHilton Honors 90,000 points'));
  check('“Updated Mar 2023”: every row waits, the card says the screen is old', [api.playing.many.map((it) => it.on), shown.countdowns, rowsText()[0]],
    [[false, false], 0, 'Check this first | This screen is from Mar 2023 — check it’s current.']);
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Updated for Mom\nDelta SkyMiles 84,250 miles\nHilton Honors 212,500 points'));
  check('“Updated for Mom” isn’t a stamp: every row waits', api.playing.many.map((it) => it.on), [false, false]);
}
{ // A member number on the page that matches the one saved: the row stays certain.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 }, members: { delta: '9012345678' } });
  api.showLoot(shot('Delta SkyMiles #9012345678 84,250 miles\nHilton Honors 212,500 points'));
  check('the screen’s Delta number is the one saved: both rows ticked, counting down', [api.playing.many.map((it) => it.on), shown.countdowns], [[true, true], 1]);
}
{ // A member number is the same one whatever its case, spaces or dashes; the account question doesn't repeat it.
  reset([program('hyatt'), program('hilton'), program('delta')], { balances: { hyatt: 60000, hilton: 200000, delta: 80000 }, members: { hyatt: '514807263K', delta: '9381726450' } });
  api.showLoot(shot('World of Hyatt #514807263k 61,200 points\nHilton Honors 212,500 points'));
  check('your Hyatt number in lower case: Hyatt certain, counting down', [api.playing.many.map((it) => it.on), shown.countdowns], [[true, true], 1]);
  reset([program('hyatt'), program('hilton'), program('delta')], { balances: { hyatt: 60000, hilton: 200000, delta: 80000 }, members: { hyatt: '514807263K', delta: '9381726450' } });
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nMember # 938-172-6450\nHilton Honors 212,500 points'));
  check('your Delta number with dashes under its row: Delta certain', api.playing.many.map((it) => it.on), [true, true]);
  reset([program('hyatt'), program('hilton'), program('delta')], { balances: { hyatt: 60000, hilton: 200000, delta: 80000 }, members: { hyatt: '514807263K', delta: '9381726450' } });
  api.showLoot(shot('World of Hyatt #123456789A 58,000 points\nHilton Honors 205,000 points'));
  const hy = rowsText().find((t) => t.startsWith('Hy'));
  check('someone else’s Hyatt number: the row asks which account, saying the number once', [api.playing.many[0].on, (hy.match(/•••• 789A/g) || []).length], [false, 1]);
}
{ // The status bar is the first line only, with one time; its battery "%" isn't a price.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Verizon 9:41 AM 87%\nDelta SkyMiles 84,250 miles\nHilton Honors 212,500 points'));
  check('“Verizon 9:41 AM 87%” at the top: rows certain', api.playing.many.map((it) => it.on), [true, true]);
  reset([program('delta'), program('united')], { balances: { delta: 80000, united: 60000 } });
  api.showLoot(shot('8:05 AM\n4:30 PM\nUnited MileagePlus 70,000 miles\nDelta SkyMiles 85,000 miles'));
  check('two time lines at the top (a flight’s times): every row waits', api.playing.many.map((it) => it.on), [false, false]);
}
{ // A member number under a row that isn't the one saved for that program: the row waits (the app's own check).
  reset([program('delta'), program('hilton')], { balances: { delta: 84000, hilton: 200000 }, members: { delta: '5555555555' } });
  api.showLoot(shot('My programs\nDelta SkyMiles 80,000 miles\nMember # 1234567890\nHilton Honors 205,000 points'));
  check('another member number under Delta: Delta asks which account, Hilton counts down', [api.playing.many.map((it) => it.on), api.playing.many[0].ask, shown.countdowns], [[false, true], true, 1]);
}
{ // Auto-update off: no countdown.
  reset([program('delta'), program('hilton'), program('marriott')]);
  api.autoCollect = false;
  api.showLoot(shot(CHAT));
  check('Auto-update off: no countdown, waits for Update all', [shown.countdowns, label()], [0, 'Update all']);
}
{ // Every row waits (two columns read as one line): nothing counts down, nothing saves without a tick.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles Hilton Honors\n84,250 miles 212,500 points'));
  check('columns: both rows wait, with their reason and a box; no countdown', [shown.countdowns, label(), rowsText().find((t) => t.startsWith('DL')).includes('Check first: it was read from side-by-side columns — is the number this program’s?'), !!$('#play-many-0'), !!$('#play-many-1')],
    [0, 'Update', true, true, true]);
  api.collectNow();
  check('…Update with nothing ticked: says so, nothing saved', [shown.toasts.at(-1), bal('delta'), bal('hilton'), api.playEl.open], ['Tick the programs to update first', 80000, 200000, true]);
  api.setManyRow(0, { on: true }); // the box ticked (play's change listener)
  check('…ticking Delta: “Update 1”, its box ticked', [label(), $('#play-many-0').checked], ['Update 1', true]);
  api.collectNow();
  check('…Update: Delta saved, Hilton left alone', [bal('delta'), bal('hilton')], [84250, 200000]);
  check('…and the toast says Hilton wasn’t updated', done(), 'Updated 1 program. Hilton Honors wasn’t updated (it needs a check)');
}
{ // One row waits (miles for a points program), the other counts down and goes alone.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nHilton Honors 212,500 miles'));
  check('a unit that doesn’t fit: Hilton waits with why; Delta counts down alone (“Update 1”)', [shown.countdowns, label(), rowsText()[1].includes('the screen says miles, but Hilton Honors counts points')], [1, 'Update 1', true]);
  api.collectNow();
  check('…the countdown’s update saves Delta only', [bal('delta'), bal('hilton'), done()], [84250, 200000, 'Updated 1 program. Hilton Honors wasn’t updated (it needs a check)']);
}
{ // A big drop (the app's own doubts): that row waits.
  reset([program('delta'), program('hilton'), program('marriott')], { balances: { delta: 184250, hilton: 200000 } });
  api.showLoot(shot(CHAT));
  check('Delta would drop by more than 40%: Delta waits, saying so; the others count down', [shown.countdowns, label(), rowsText()[0].includes('miles would go from 184,250 to 84,250')], [1, 'Update 2', true]);
  api.collectNow();
  check('…Delta keeps its balance', [bal('delta'), bal('hilton'), api.state.programs.length], [184250, 212500, 3]);
}
{ // Two Delta accounts on your list: the row asks which, and never guesses.
  const mine = program('delta');
  const hers = { ...program('delta'), id: 'delta-2', who: 'Ms. Lee' };
  reset([mine, hers, program('hilton'), program('marriott')], { balances: { delta: 80000, 'delta-2': 80000, hilton: 200000 } });
  api.showLoot(shot(CHAT));
  const select = $('#play-many-acct-0');
  check('two Delta accounts: the row asks which (none picked), the others count down', [!!select, select && select.value, select && select.options.map((o) => o.value), label(), shown.countdowns],
    [true, '', ['', 'delta', 'delta-2', 'new:delta'], 'Update 2', 1]);
  api.setManyRow(0, { choice: 'delta-2' }); // picked (play's change listener)
  check('…picking Ms. Lee’s: the row is in (“Update all”), showing her change', [label(), tags()[0]], ['Update all', '+4,250']);
  api.collectNow();
  check('…Update all: her balance, not yours', [bal('delta'), bal('delta-2'), bal('hilton')], [80000, 84250, 212500]);
  // Picking an account runs the app's own checks for it: Ms. Lee's 12,000 going to 84,250 waits.
  reset([mine, hers, program('hilton'), program('marriott')], { balances: { delta: 80000, 'delta-2': 12000, hilton: 200000 } });
  api.showLoot(shot(CHAT));
  api.setManyRow(0, { choice: 'delta-2' });
  check('…picking an account whose balance would jump from 12,000 to 84,250: the row waits, saying so', [api.playing.many[0].on, rowsText()[0].includes('miles would go from 12,000 to 84,250'), !!$('#play-many-0'), label()],
    [false, true, true, 'Update 2']);
  api.setManyRow(0, { on: true });
  api.collectNow();
  check('…ticked after a look: her balance saved', bal('delta-2'), 84250);
  reset([mine, hers, program('hilton'), program('marriott')], { balances: { delta: 80000, 'delta-2': 12000, hilton: 200000 } });
  api.showLoot(shot(CHAT));
  api.collectNow();
  check('…not picked: both Delta accounts untouched, and the toast says so', [bal('delta'), bal('delta-2'), done()], [80000, 12000, 'Updated 2 programs. Delta SkyMiles wasn’t updated (it needs you to pick which account)']);
  // The screen's member number is one of them: that one, no question.
  reset([mine, hers, program('hilton')], { balances: { delta: 80000, 'delta-2': 82000 }, members: { delta: '9012345678', 'delta-2': '9087654321' } });
  api.showLoot(shot('Delta SkyMiles #9087654321 84,250 miles\nHilton Honors 212,500 points'));
  check('…a member number on the row that’s Ms. Lee’s: her account, certain', [api.playing.many[0].choice, label()], ['delta-2', 'Update all']);
}
{ // The same balances as saved: Confirm.
  reset([program('delta'), program('hilton')], { balances: { delta: 84250, hilton: 212500 } });
  api.showLoot(shot('Delta 84,250 miles, Hilton 212,500 points'));
  check('nothing new: “These 2 programs are up to date”, Confirm all, rows say Confirmed', [title(), label(), tags()], ['These 2 programs are up to date', 'Confirm all', ['Confirmed', 'Confirmed']]);
}
{ // Two balances can't go to one account.
  reset([program('delta'), program('hilton')]);
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nDelta SkyMiles 12,400 miles\nHilton Honors 212,500 points'));
  api.setManyRow(0, { on: true });
  api.setManyRow(1, { on: true });
  api.collectNow();
  check('two Delta balances both ticked for one Delta account: refused, nothing saved', [shown.toasts.at(-1), bal('delta'), bal('hilton')], ['Two balances can’t go to the same account — untick one', undefined, undefined]);
}
{ // Fix something: pick the row, and it opens in the review form; nothing else changes.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nHilton Honors 212,500 miles'));
  tap('Fix something');
  check('Fix something: “Which one needs fixing?”, the waiting row picked first', [title(), $('#play-program').value, $('#play-program').options.map((o) => o.innerText)], ['Which one needs fixing?', '1', ['Delta SkyMiles — 84,250', 'Hilton Honors — 212,500']]);
  tap('Fix this one');
  check('…the review form for Hilton with its number; nothing saved', [api.scanEl.open !== undefined, $('#scan-program').value, $('#scan-balance') && $('#scan-balance').value, bal('delta'), bal('hilton'), api.playEl.open],
    [true, 'hilton', '212,500', 80000, 200000, false]);
}
{ // Back from the chooser: the card again, no countdown.
  reset([program('delta'), program('hilton'), program('marriott')]);
  api.showLoot(shot(CHAT));
  tap('Fix something');
  const before = shown.countdowns;
  tap('Back');
  check('…Back: the card again, without counting down', [title(), shown.countdowns - before], ['Found 3 programs on this page', 0]);
}
{ // Vouchers on the same page: added with the balances, and undone with them.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Hilton Honors 212,500 points\nDelta SkyMiles 84,250 miles\nDelta eCredit $75.00\nExpires Sep 28, 2027'));
  check('a voucher on the page: its row after the programs, and the rows wait (a voucher’s lines aren’t balances)', [title(), rowsText().at(-1).split(' | ')[0], api.playing.many.map((it) => it.on)],
    ['Found 2 programs on this page', 'Delta $75 eCredit', [false, false]]);
  api.setManyRow(0, { on: true });
  api.setManyRow(1, { on: true });
  api.collectNow();
  check('…Update all saves both balances and the voucher', [bal('delta'), bal('hilton'), api.state.vouchers.map((v) => v.name)], [84250, 212500, ['Delta $75 eCredit']]);
  check('…one toast for all, saying the voucher too, with Undo', [done(), typeof shown.undo], ['Updated 2 programs and added 1 voucher', 'function']);
  shown.undo();
  check('…Undo takes all of it back', [bal('delta'), bal('hilton'), api.state.vouchers.length], [80000, 200000, 0]);
}
{ // No row ticked, only a dated voucher: Update adds it, with its own toast and Undo, and the batch ends.
  reset([program('chase'), program('hilton')], { balances: { chase: 131500, hilton: 200000 } });
  api.showLoot(shot('Chase 140,000\nHilton 220,000\n\nA $75 Delta eCredit that’s good until Sep 28, 2027. The eCredit number is 0061234567890.'));
  check('both rows wait (no unit), a voucher below: “Update”', [label(), api.playing.many.map((it) => it.on)], ['Update', [false, false]]);
  api.collectNow();
  check('…Update: the voucher saved, its toast with Undo, the batch ended', [api.state.vouchers.map((v) => v.name), done(), typeof shown.undo, api.batch],
    [['Delta $75 eCredit'], 'Added 1 voucher. Chase Ultimate Rewards and Hilton Honors weren’t updated (they need a check)', 'function', null]);
  if (shown.undo) shown.undo();
  check('…Undo takes the voucher away; balances untouched', [api.state.vouchers.length, bal('chase'), bal('hilton')], [0, 131500, 200000]);
}
{ // An undated voucher on a page of balances: left out, and the toast says so.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles: 90,000 miles\nHilton Honors: 220,000 points\n\nA $75 Delta eCredit. The eCredit number is 0061234567890.'));
  check('an undated voucher: a date box on the card', !!$('#play-vexp-0'), true);
  api.setManyRow(0, { on: true });
  api.setManyRow(1, { on: true });
  api.collectNow();
  check('…Update all with the box empty: balances saved, the toast says the voucher wasn’t added', [bal('delta'), bal('hilton'), api.state.vouchers.length, done()],
    [90000, 220000, 0, 'Updated 2 programs — the voucher with no date wasn’t added']);
  // A date typed on the card goes with "Fix something" to the review form.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles: 90,000 miles\nHilton Honors: 220,000 points\n\nA $75 Delta eCredit. The eCredit number is 0061234567890.'));
  $('#play-vexp-0').value = '2027-12-31';
  tap('Fix something');
  tap('Fix this one');
  check('…a date typed on the card reaches the review form through Fix something', ($('#scan-vexp-0') || {}).value, '2027-12-31');
}
{ // A batch: a one-program screenshot, then a page of balances. Every program saved is counted, and one the batch did
  // update isn't said to be left out.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.batch = api.newBatch(2);
  api.scanQueue.push('second');
  api.showLoot(shot('Hilton Honors\nGold\n245,100 Points'));
  api.collectNow();
  api.flush();
  api.playEl.open = true;
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nHilton Honors 212,500 miles'));
  api.collectNow();
  check('…the batch’s toast counts both and doesn’t say Hilton was left', [bal('hilton'), bal('delta'), done()], [245100, 84250, 'Updated 2 programs']);
}
{ // Back from Fix something keeps your ticks.
  reset([program('delta'), program('hilton')]);
  api.showLoot(shot('Delta SkyMiles Hilton Honors\n84,250 miles 212,500 points'));
  api.setManyRow(0, { on: true });
  tap('Fix something');
  tap('Back');
  check('Back from Fix something: Delta still ticked (“Update 1”)', [label(), $('#play-many-0').checked], ['Update 1', true]);
}
{ // The box names its program for a screen reader, tied to its reason; confirming everything says so.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000, hilton: 200000 } });
  api.showLoot(shot('Delta SkyMiles 84,250 miles\nHilton Honors 212,500 miles'));
  const box = $('#play-many-1');
  check('the box’s name says which program, and points at its reason', [box.attrs['aria-label'], !!box.attrs['aria-describedby'] && !!$(`#${box.attrs['aria-describedby']}`)], ['Update Hilton Honors too', true]);
  reset([program('delta'), program('hilton')], { balances: { delta: 84250, hilton: 212500 } });
  api.showLoot(shot('Delta 84,250 miles, Hilton 212,500 points'));
  api.collectNow();
  check('Confirm all: the toast says they’re up to date', done(), 'These 2 programs are up to date');
}
{ // A page about one program still gets the one-program card.
  reset([program('delta'), program('hilton')], { balances: { delta: 80000 } });
  api.showLoot(shot('Delta SkyMiles\nGold Medallion\n84,250 miles\nDelta SkyMiles Reserve American Express Card\nEarn 3X miles on Delta purchases'));
  check('one program’s page: the one-program card as before', [title(), api.playing.many, api.playing.choice], ['Found your Delta SkyMiles', null, 'delta']);
  // Reading it as a program you pick ("Which program?" / the hint) never splits it either.
  reset([program('delta'), program('hilton')]);
  api.showLoot(shot(CHAT), 'hilton');
  check('read as a program you picked: one program', [api.playing.many, api.playing.choice], [null, 'hilton']);
}
{ // A status and a member number on a row: saved with the balance (a member number only fills an empty one).
  reset([program('delta'), program('hilton')], { members: { hilton: '1111111111' } });
  api.showLoot(shot('Delta SkyMiles #9012345678 84,250 miles\nHilton Honors #1234567890 212,500 points'));
  check('a member number that isn’t the one saved for your Hilton: that row asks which account', [api.playing.many.map((it) => it.ask), label()], [[false, true], 'Update']);
  check('…Delta’s number isn’t saved yet: Delta waits too, saying which number the screen shows', [api.playing.many[0].on, rowsText().find((t) => t.startsWith('DL')).includes('Check first: is this your account? The screen shows member number •••• 5678.')], [false, true]);
  api.setManyRow(0, { on: true });
  api.collectNow();
  check('…Update: Delta’s number saved; Hilton’s balance and number left as they were', [api.state.members.delta, api.state.members.hilton, bal('hilton')], ['9012345678', '1111111111', undefined]);
  reset([program('delta'), program('hilton')]);
  api.showLoot(shot('Delta SkyMiles (Gold Medallion): 84,250 miles\nHilton Honors (Diamond): 212,500 points'));
  api.collectNow();
  check('levels on the rows are saved too', api.state.programs.map((p) => p.status.map((l) => l.tier)), [['Gold Medallion'], ['Diamond']]);
}

check('What’s new says so, with a new id so it shows again', [/<li><b>Several programs from one screenshot<\/b>:/.test(html), /const NEWS_ID = '2026-11e'/.test(html)], [true, true]);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
