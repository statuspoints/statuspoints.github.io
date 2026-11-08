// Checks small things a person runs into on the page (from index.html): "212,50" (a missed zero) isn't read as 213;
// a form sheet you've typed in isn't thrown away by a backdrop tap or Escape; Escape in the member number or an end
// date cancels just that edit (with no number saved yet, Escape empties what was typed); a typed member number or a
// changed end date is kept on Done (an emptied box, or a date only looked at, is left alone), but never carried into
// another person's or another tracker; the
// screenshot review won't skip a number it can't read; a rename puts you back on its
// pencil; the Vouchers section holds still when Coming up above it changes; phone sheets keep Done/Save on screen;
// and the worth line and "Or paste text instead" are big enough to tap.
// Usage: node tests/run-fixes-ux-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
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
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const run = (code, extra = {}) => {
  const context = vm.createContext({ console, Math, Number, String, Object, Array, Set, Map, RegExp, JSON, Date, ...extra });
  vm.runInContext(code, context);
  return context;
};

/* ---------- Reading a typed number ---------- */

const parse = run(`const MAX_VALUE = 1e12;\n${piece('  function parseEntry', '  function paintNum')}\nglobalThis.parseEntry = parseEntry;`).parseEntry;
const read = (text, dollars) => { const r = parse(text, dollars); return r ? r.value : 'unread'; };
check('"212,50" (a missed zero) isn’t read as 213', read('212,50'), 'unread');
check('…nor "212.50", "212,5" or "84.2"', [read('212.50'), read('212,5'), read('84.2')], ['unread', 'unread', 'unread']);
check('what worked still works: 1.5k, 2,25m, 212,500, 84.500, 84 500, $4,512.37, 84,500 miles',
  [read('1.5k'), read('2,25m'), read('212,500'), read('84.500'), read('84 500'), read('$4,512.37'), read('84,500 miles')],
  [1500, 2250000, 212500, 84500, 84500, 4512, 84500]);
check('…blank still clears, and "abc" still isn’t read', [parse('').value, read('abc')], [null, 'unread']);
check('dollar fields (MQDs, card spend) take cents without a $', [read('4512.37', true), read('4512,37', true), read('4,512.37', true)], [4512, 4512, 4512]);
check('every place that reads MQDs or dollars says so', [
  js.includes("parseEntry(input.value, field === 'mqd'); // MQDs are dollars"),
  js.includes("parseEntry($(`#scan-${key}`).value, key === 'mqd')"),
  js.includes("parseEntry(input.value, input.dataset.quick === 'mqd')"),
  js.includes("input.value.replace(/\\.\\d*$/, ''), key !== 'points')"),
], [true, true, true, true]);

/* ---------- A form sheet you've typed in: backdrop tap and Escape ---------- */

const fakeDialog = () => {
  const inputs = [{ type: 'text', value: '84,210' }, { type: 'checkbox', checked: false }];
  const save = { focused: false, focus() { this.focused = true; } };
  const d = {
    open: true, inputs, listeners: {}, save,
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    fire(type, e = {}) { for (const fn of this.listeners[type] || []) fn(e); },
    querySelectorAll: () => inputs,
    querySelector: (sel) => (sel === '[type=submit]' ? save : null),
    close() { this.open = false; this.fire('close'); },
  };
  return d;
};
const guard = run(`let pressedOn = null;
  ${piece('  const backdropTap', '  // Says something to screen readers')}
  const toasts = [];
  let undoAction = null;
  const showToast = (message, onUndo, label) => { toasts.push({ message, onUndo, label, up: true }); undoAction = onUndo; };
  const hideToast = () => { toasts.at(-1).up = false; undoAction = null; };
  globalThis.api = { guardEdits, formSnap, toasts, press: (el) => { pressedOn = el; } };`).api;
const backdrop = (d) => { guard.press(d); const e = { target: d, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; d.fire('click', e); return e; };
const escape = (d) => { const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; d.fire('cancel', e); return e; };

let dlg = fakeDialog();
guard.guardEdits(dlg);
dlg._snap = guard.formSnap(dlg);
backdrop(dlg);
check('nothing typed: a backdrop tap still closes the sheet', dlg.open, false);

dlg = fakeDialog();
guard.guardEdits(dlg);
dlg._snap = guard.formSnap(dlg);
dlg.inputs[0].value = '90000';
backdrop(dlg);
check('typed in Update balances, then a backdrop tap: the sheet stays open', dlg.open, true);
check('…and it says to tap Save, with Discard to drop it, and Save gets focus',
  [guard.toasts.at(-1).message, guard.toasts.at(-1).label, dlg.save.focused], ['You have changes that aren’t saved. Tap Save to keep them.', 'Discard', true]);
const esc = escape(dlg);
check('…Escape doesn’t close it either', [esc.defaultPrevented, dlg.open], [true, true]);
dlg.close();
check('…Cancel (or Save) closes it, and the “Tap Save” toast goes with it', [dlg.open, guard.toasts.at(-1).up], [false, false]);
dlg.open = true;
dlg._snap = '';
backdrop(dlg);
guard.toasts.at(-1).onUndo();
check('…Discard closes it', dlg.open, false);
dlg.open = true;
check('…and once closed, a new open starts clean', [dlg._snap, escape(dlg).defaultPrevented], [null, false]);

dlg = fakeDialog();
guard.guardEdits(dlg);
dlg._snap = guard.formSnap(dlg);
dlg.inputs[1].checked = true;
check('a ticked box counts as a change too', escape(dlg).defaultPrevented, true);
check('both form sheets take their starting snapshot when they open', [
  piece('  function openQuick', '  function quickRow').includes('quickSheet._snap = formSnap(quickSheet);'),
  piece('  function openSheet', '  function newProgramId').includes('sheet._snap = formSnap(sheet);'),
  js.includes('guardEdits(quickSheet);'), js.includes('guardEdits(sheet);'),
], [true, true, true, true]);

/* ---------- Program details: Escape in an inline edit, and Done keeps what you typed ---------- */

const detailRun = () => {
  const page = {};
  const el = (id, props = {}) => (page[`#${id}`] = { id, value: '', dataset: {}, focused: false, focus() { this.focused = true; }, ...props });
  const app = run(`
    const state = { members: {}, programs: [{ id: 'delta', status: [] }] };
    let detailId = 'delta';
    let expEditing = null;
    const calls = [];
    const page = globalThis.page;
    const $ = (sel) => page[sel] || null;
    const detail = { open: true, listeners: {}, addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }, close() { this.open = false; for (const fn of this.listeners.close || []) fn(); } };
    ${piece('  const detailProgram', '  const maskNumber')}
    const parseISODate = (s) => (/^\\d{4}-\\d{2}-\\d{2}$/.test(s) ? s : null);
    const renderMemberNow = (p, editing) => { calls.push(['renderMember', editing]); delete page['#d-member-input']; globalThis.el('d-member-edit'); };
    const renderDetailStatus = () => { calls.push(['renderStatus', expEditing]); delete page['#d-exp-input']; };
    const saveMember = () => { const v = page['#d-member-input'].value.trim(); if (v) state.members[detailId] = v; calls.push(['saveMember', v]); delete page['#d-member-input']; };
    const setStatusExp = (p, i, v) => { calls.push(['setStatusExp', i, v]); expEditing = null; delete page['#d-exp-input']; };
    ${piece("  detail.addEventListener('keydown'", '  /* ---------- "Your perks"')}
    globalThis.api = { state, detail, calls, page, key: (key, target) => { const e = { key, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; for (const fn of detail.listeners.keydown) fn(e); return e; },
      setExp: (i) => { expEditing = i; }, closeDetail, dropTyped };`, { page, el });
  return { ...app.api, el };
};

let d = detailRun();
d.state.members.delta = '9381726450';
let input = d.el('d-member-input', { value: '9381726477' });
let e = d.key('Escape', input);
check('Escape while changing a saved member number: just that edit is cancelled', [e.defaultPrevented, d.state.members.delta, d.calls], [true, '9381726450', [['renderMember', false]]]);
check('…and focus goes back to its pencil', d.page['#d-member-edit'].focused, true);

d = detailRun();
input = d.el('d-member-input', { value: 'B1234-5678' });
e = d.key('Escape', input);
check('Escape with no number saved yet: what was typed is dropped and the sheet stays open',
  [e.defaultPrevented, input.value, d.state.members.delta, d.detail.open], [true, '', undefined, true]);
d.detail.close();
check('…so the sheet closing after it saves nothing', [d.state.members.delta, d.calls], [undefined, []]);

d = detailRun();
input = d.el('d-member-input', { value: '', dataset: { was: '' } });
e = d.key('Escape', input);
check('…an empty box with nothing typed: Escape closes the sheet as usual', e.defaultPrevented, false);

d = detailRun();
d.setExp(0);
d.el('data-exp-edit-0');
d.page['[data-exp-edit="0"]'] = d.page['#data-exp-edit-0'];
input = d.el('d-exp-input', { value: '2027-02-28' });
e = d.key('Escape', input);
check('Escape in an end date: that edit is cancelled, not saved, and focus goes back to its button',
  [e.defaultPrevented, d.calls, d.page['[data-exp-edit="0"]'].focused], [true, [['renderStatus', null]], true]);

d = detailRun();
d.el('d-member-input', { value: '  B1234-5678-TEST ', dataset: { was: '' } });
d.closeDetail();
check('a member number typed but not Saved is kept on Done', [d.state.members.delta, d.detail.open], ['B1234-5678-TEST', false]);

d = detailRun();
d.state.members.delta = '9381726450';
d.el('d-member-input', { value: '', dataset: { was: '9381726450' } });
d.closeDetail();
check('a saved number cleared (to retype it) and then Done: the number is kept, not deleted', [d.state.members.delta, d.calls], ['9381726450', []]);

d = detailRun();
d.state.members.delta = 'HX55501234'; // saved in another window while this sheet showed the empty box
d.el('d-member-input', { value: '', dataset: { was: '' } });
d.closeDetail();
check('…an empty box drawn before another window saved a number: Done leaves that number alone', [d.state.members.delta, d.calls], ['HX55501234', []]);

d = detailRun();
d.state.members.delta = 'X1-NEWER'; // changed in another window
d.el('d-member-input', { value: '9381726450', dataset: { was: '9381726450' } });
d.closeDetail();
check('…a box left as it opened doesn’t put back an older number', [d.state.members.delta, d.calls], ['X1-NEWER', []]);
check('the box remembers what it opened with', piece('  function renderMemberNow', '  function saveMember').includes('input.dataset.was = number;'), true);

d = detailRun();
d.state.members.delta = '9381726450';
d.el('d-member-input', { value: '9381726450' });
d.closeDetail();
check('…unchanged, Done doesn’t save it again', d.calls, []);

d = detailRun();
d.setExp(1);
d.el('d-exp-input', { value: '2027-02-28' });
d.closeDetail();
check('an end date picked but not Saved is kept on Done', d.calls, [['setStatusExp', 1, '2027-02-28']]);

d = detailRun();
d.setExp(0);
d.el('d-exp-input', { value: '2027-12-31', dataset: { was: '2027-12-31' } });
d.closeDetail();
check('…a date box opened and left as it was: Done doesn’t write that date to every line of the level', d.calls, []);
check('the date box remembers what it opened with', piece('  function expRow', '  function setStatusExp').includes("input.dataset.was = group.exp || '';"), true);

d = detailRun();
d.setExp(1);
d.el('d-exp-input', { value: '' });
d.detail.close();
check('…an emptied date isn’t taken as clearing it (Escape, or a closed sheet)', d.calls, []);

d = detailRun();
d.el('d-member-input', { value: 'K77', dataset: { was: '' } });
d.detail.close();
check('Escape (the sheet’s own close) keeps a typed member number too', d.state.members.delta, 'K77');
check('Done, Edit, a backdrop tap and going to another program all keep it', [
  js.includes("case 'd-done': closeDetail(); break;"), js.includes("case 'd-edit': closeDetail(); openSheet(p.id); break;"),
  js.includes('if (backdropTap(e, detail)) { closeDetail(); return; }'), piece('  function openDetail', '  function renderDetail').includes('if (detail.open) keepTyped();'),
], [true, true, true, true]);

d = detailRun();
d.el('d-member-input', { value: 'LEAK-MADEUP-7', dataset: { was: '' } });
d.setExp(0);
d.el('d-exp-input', { value: '2028-01-31', dataset: { was: '' } });
d.dropTyped(); // another person's tracker is about to be shown
d.detail.close();
check('switching to another tracker drops what was typed in the program sheet, so it can’t land in theirs',
  [d.state.members.delta, d.calls], [undefined, []]);
d = detailRun();
d.state.programs = null; // another window started over
d.el('d-member-input', { value: 'TWO-MADEUP-3', dataset: { was: '' } });
let threw = false;
try { d.detail.close(); } catch (err) { threw = true; }
check('…the sheet closing after another window started over doesn’t break', [threw, d.calls], [false, []]);
const before = (fn, a, b) => { const body = piece(`  function ${fn}`, '\n  }\n'); return body.indexOf(a) >= 0 && body.indexOf(a) < body.indexOf(b); };
check('switching person, replacing the tracker, and leaving it all drop the typing first', [
  before('switchPerson', 'dropTyped();', 'Object.assign(state, next);'),
  before('replaceTracker', 'dropTyped();', 'Object.assign(state, next);'),
  before('leaveTracker', 'dropTyped();', "document.querySelectorAll('dialog[open]')"),
], [true, true, true]);

/* ---------- Screenshot review: a number that can't be read keeps the sheet open on it ---------- */

const scanRun = (fields) => {
  const page = { '#scan-program': { value: 'hilton', focus() {} }, '#scan-apply': { getBoundingClientRect: () => ({}) } };
  for (const [key, value, ticked = true] of fields) {
    page[`#scan-${key}`] = { value, attrs: {}, focused: false, focus() { this.focused = true; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
    page[`#scan-use-${key}`] = { checked: ticked };
  }
  const app = run(`const MAX_VALUE = 1e12;
    ${piece('  function parseEntry', '  function paintNum')}
    const page = globalThis.page;
    const $ = (sel) => page[sel] || null;
    const toasts = [];
    const collected = [];
    const showToast = (m) => toasts.push(m);
    let quietClose = false;
    let scanned = null;
    const scanSheet = { open: true, close() { this.open = false; } };
    const formVals = () => ({ from: 'formVals' });
    const collect = (...args) => collected.push(args[0]);
    ${piece('  function applyScan', '  // Puts what a screenshot showed')}
    globalThis.api = { applyScan, toasts, collected, scanSheet };`, { page });
  app.api.applyScan();
  return { ...app.api, page };
};
let sc = scanRun([['balance', '212,50'], ['progress', '12']]);
check('“212,50” in the screenshot review: nothing is applied, the sheet stays open and says why',
  [sc.collected, sc.scanSheet.open, sc.toasts], [[], true, ['Couldn’t read “212,50”. Type the whole number, then tap Update.']]);
check('…and that box is marked and has focus', [sc.page['#scan-balance'].attrs['aria-invalid'], sc.page['#scan-balance'].focused, sc.page['#scan-progress'].attrs['aria-invalid']], ['true', true, undefined]);
sc = scanRun([['balance', '212,50'], ['alt', '4.2']]);
check('…two unreadable numbers: says how many', sc.toasts, ['Couldn’t read 2 of the numbers. Type whole numbers, then tap Update.']);
sc = scanRun([['balance', '212,50', false], ['mqd', '4,512.37']]);
check('…an unticked row isn’t checked, and MQDs take cents', [sc.collected, sc.scanSheet.open, sc.toasts], [['hilton'], false, []]);
sc = scanRun([['balance', '212,500'], ['progress', '']]);
check('…readable or blank: applied as before', [sc.collected, sc.scanSheet.open], [['hilton'], false]);
check('typing again clears the red mark', js.includes("if (e.target.matches('.scan-control input')) e.target.removeAttribute('aria-invalid');"), true);
check('an unreadable number in the review is marked in red', /\.scan-control input\[aria-invalid="true"\] \{ border-color: var\(--danger\); \}/.test(css), true);

/* ---------- People: a rename puts you back on its pencil ---------- */

const peopleRun = () => {
  const pencil = { focused: false, focus() { this.focused = true; } };
  const app = run(`
    const people = { list: [{ id: 'u1', name: 'Kim' }, { id: 'u2', name: 'Rename Me' }] };
    let renaming = 'u2';
    const renders = [];
    const page = { '#person-rename': { value: ' Sam ' } };
    const $ = (sel) => page[sel] || null;
    const str = (s, n) => String(s).trim().slice(0, n);
    const savePeople = () => {};
    const renderPeople = () => { renders.push(renaming); delete page['#person-rename']; };
    const CSS = { escape: (s) => s };
    const peopleSheet = { listeners: {}, addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }, querySelector: (sel) => (sel === '[data-rename="u2"]' ? globalThis.pencil : null) };
    ${piece('  function saveRename', "  $('#people-btn')")}
    ${piece("  peopleSheet.addEventListener('keydown'", '  /* ---------- Appearance')}
    globalThis.api = { people, renders, key: (key) => { const target = { dataset: { renameInput: 'u2' }, closest: () => target }; const e = { key, target, preventDefault() {} }; for (const fn of peopleSheet.listeners.keydown) fn(e); } };`, { pencil });
  return { ...app.api, pencil };
};
let pp = peopleRun();
pp.key('Escape');
check('Escape in a rename: cancelled, and focus is back on that person’s pencil', [pp.people.list[1].name, pp.renders, pp.pencil.focused], ['Rename Me', [null], true]);
pp = peopleRun();
pp.key('Enter');
check('Enter in a rename: saved, and focus is back on the pencil', [pp.people.list[1].name, pp.pencil.focused], ['Sam', true]);

/* ---------- Vouchers hold still when Coming up above them changes ---------- */

// startTop: where the Vouchers heading is on screen; grow: how far it moves when the vouchers redraw; sideBottom: where
// the bottom of the block holding Coming up is on screen (far above by default, as on a phone looking at the vouchers);
// upTop: where the top of Coming up is on screen (null: Coming up is hidden, no rows yet).
const holdRun = (startTop, grow, sideBottom = -5000, upTop = null) => {
  let top = startTop;
  const scrolled = [];
  const frames = [];
  const app = run(`
    const $ = (sel) => (sel === '#h-vouchers' ? globalThis.head : sel === '.side-top' ? globalThis.side : sel === '#upcoming' ? globalThis.up : null);
    ${piece('  // Coming up (far above) changes height', "  $('#vform')")}
    globalThis.holdVouchers = holdVouchers;`, {
    head: { getBoundingClientRect: () => ({ top }) },
    side: { getBoundingClientRect: () => ({ bottom: sideBottom }) },
    up: { hidden: upTop === null, getBoundingClientRect: () => (upTop === null ? { top: 0, bottom: 0 } : { top: upTop }) },
    innerHeight: 800,
    scrollBy: (x, y) => { scrolled.push(y); top -= y; },
    requestAnimationFrame: (fn) => frames.push(fn),
  });
  app.holdVouchers(() => { top += grow; });
  for (const fn of frames) fn();
  return { scrolled, top };
};
let h = holdRun(74, 54);
check('a voucher added inside the Coming up window: the Vouchers heading stays where it was on screen', [h.scrolled, h.top], [[54], 74]);
h = holdRun(-300, -54);
check('…deleted: the same, the other way', [h.scrolled, h.top], [[-54], -300]);
h = holdRun(74, 0);
check('…no change above (Chrome holds the place itself): nothing is scrolled', h.scrolled, []);
h = holdRun(1200, 54);
check('…looking at Coming up itself (vouchers below the screen): the page is left alone', h.scrolled, []);
// Laptop and desktop: Coming up sits right above the vouchers in the right-hand column. At the top of the page you
// see it change, so nothing scrolls (it used to scroll the whole page, header and programs too, by 132px).
h = holdRun(778, 132, 640);
check('wide screen at the top of the page, Coming up on screen above the vouchers: the page doesn’t move', [h.scrolled, h.top], [[], 910]);
h = holdRun(778, -132, 640);
check('…deleted: the page doesn’t move either', h.scrolled, []);
h = holdRun(778, 54, 640, 400);
check('…Coming up already has rows and all of it is on screen: the page doesn’t move', h.scrolled, []);
h = holdRun(163, 77, 120, 10);
check('…scrolled down with the top of Coming up still on screen: the page doesn’t move', h.scrolled, []);
// Scrolled down to the vouchers with only the end of Coming up showing: the row that comes or goes is up in the part
// scrolled off the top, so you can't see it change. The vouchers hold still (they used to jump 54px).
h = holdRun(48, 54, 20, -150);
check('…only the last 20px of Coming up showing, its top above the screen: the vouchers hold still', [h.scrolled, h.top], [[54], 48]);
h = holdRun(102, -54, 20, -204);
check('…and deleting it: they hold still too', [h.scrolled, h.top], [[-54], 102]);
h = holdRun(88, 54, 60, -110);
check('…the same with 60px showing', [h.scrolled, h.top], [[54], 88]);
h = holdRun(40, 132, -10);
check('…Coming up scrolled all the way off the top: the vouchers hold still, as on a phone', [h.scrolled, h.top], [[132], 40]);
check('add, delete and its Undo all hold still; focus after a delete doesn’t scroll', [
  js.includes('holdVouchers(() => renderVouchers(voucher));'), js.includes('holdVouchers(() => renderVouchers());'),
  js.includes('holdVouchers(() => renderVouchers(removed));'), js.includes("|| $('#vempty')).focus({ preventScroll: true });"),
], [true, true, true, true]);
// After an add on a laptop, the name field gets focus back. Plain focus() makes Safari scroll the field to the middle of
// the screen when the add pushed it below (the page jumped 430-470px); now it only comes up the least it needs to.
const submitSrc = js.slice(js.indexOf("$('#vform').addEventListener('submit'"), js.indexOf("$('#vlist').addEventListener('click'"));
check('after adding a voucher, focus goes back to the name field without a jump: no scroll, then only as far as needed', [
  submitSrc.includes("nameEl.focus({ preventScroll: true });"), /nameEl\.scrollIntoView\(\{ block: 'nearest' \}\)/.test(submitSrc),
  /\bnameEl\.focus\(\);\s*\n\s*else document\.activeElement\.blur\(\)/.test(submitSrc),
], [true, true, false]);

/* ---------- Styles: phone sheets, the grab bar, tap targets ---------- */

const phone = css.slice(css.indexOf('@media (max-width: 560px) {\n    .sheet {'));
const phoneBlock = phone.slice(0, phone.indexOf('\n  }\n'));
check('on a phone, a sheet’s Done/Save row sticks to the bottom of the sheet', [
  /\.sheet > form > \.sheet-actions, \.sheet > \.sheet-body > \.sheet-actions \{[^}]*position: sticky; bottom: 0;/.test(phoneBlock),
  /\.sheet-actions \{[^}]*background: var\(--card\)/.test(phoneBlock),
], [true, true]);
check('…and a toast inside a phone sheet sits above that row, not over Save', /\.sheet > \.toast \{ bottom: calc\(76px \+ env\(safe-area-inset-bottom\)\); \}/.test(phoneBlock), true);
check('the grab bar that looked like swipe-to-close isn’t shown', [/\.grab \{ display: none; \}/.test(css), /\.grab \{ display: block; \}/.test(css)], [true, false]);
check('the worth line has a bigger tap area', [/\.worth \{ position: relative;/.test(css), /\.worth::after \{ content: ""; position: absolute; inset: -12px -6px; \}/.test(css)], [true, true]);
check('“Or paste text instead” is a full-height tap target', /\.scan-paste summary \{ padding: 12px 0;/.test(css), true);
check('an unreadable balance is marked in red', /\.quick-input\[aria-invalid="true"\] \{ border-color: var\(--danger\); \}/.test(css), true);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
