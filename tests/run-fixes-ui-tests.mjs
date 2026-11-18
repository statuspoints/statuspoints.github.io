// Checks (from index.html, against small fake pages) round 2's fixes to what a person sees and presses:
// with data from a newer version, the "can't be saved" warning isn't covered by a toast saying the edit worked;
// "+ Add another status" left empty isn't an unsaved change; "2.125m" is 2,125,000 (and "2,125m" isn't guessed at);
// Cmd/Ctrl+Z runs the toast's Undo; warning text has enough contrast; Update balances names wrap; same-named credits
// on two cards say which card; lists keep their list role in Safari; and the Credits checklist's headings nest.
// Made-up names only. Usage: node tests/run-fixes-ui-tests.mjs  — exits non-zero if any check fails.
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

/* ---------- The toast: a fake page with a fake clock ---------- */

let now = 0;
let timers = [];
const fakeSetTimeout = (fn, ms = 0) => { const t = { fn, at: now + ms, id: timers.length + 1 + Math.random() }; timers.push(t); return t.id; };
const fakeClearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
const advance = (ms) => {
  const end = now + ms;
  for (;;) {
    const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter((t) => t !== due);
    now = due.at;
    due.fn();
  }
  now = end;
};
const el = (tag = 'div', props = {}) => ({
  tagName: tag.toUpperCase(), type: props.type || '', textContent: '', hidden: false, isContentEditable: false, listeners: {},
  classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
  addEventListener(t, f) { this.listeners[t] = f; }, focus() {}, click() { if (this.listeners.click) this.listeners.click(); },
  append(...kids) { for (const k of kids) k.parentNode = this; },
  // Enough of matches() for the "is this a field you type in?" test.
  matches(sel) {
    if (this.tagName === 'TEXTAREA' || this.tagName === 'SELECT') return /\b(textarea|select)\b/.test(sel);
    if (this.tagName !== 'INPUT') return false;
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color'].includes(this.type);
  },
  ...props,
});

const toastPage = ({ stale = false } = {}) => {
  const els = {};
  const docListeners = {};
  const body = el('body');
  const $ = (sel) => els[sel] || (els[sel] = el(sel === '#toast-undo' ? 'button' : 'div'));
  $('#toast').parentNode = body;
  let openSheet = null;
  const sheetHost = () => openSheet;
  const doc = {
    visibilityState: 'visible', body, activeElement: body,
    querySelector: (sel) => (sel === 'dialog[open]' ? sheetHost() : null),
    addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); },
  };
  const ctx = vm.createContext({
    $, document: doc, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, Math, Date: { now: () => now },
    saveTimer: 0, saveNow() {}, refreshDay() {}, fetch: () => Promise.resolve(), reloads: 0, staleCopy: stale, undone: [],
    location: { reload() { ctx.reloads++; } },
    navigator: { serviceWorker: { controller: null, addEventListener() {} } },
  });
  vm.runInContext(`function undoRemovals() { undone.push('people'); }\n${piece('  let toastTimer = 0;', '  /* ---------- People on this device')}`, ctx);
  const toast = () => ({ msg: $('#toast-msg').textContent, show: $('#toast').classList.contains('show'), button: $('#toast-undo').hidden ? null : $('#toast-undo').textContent });
  // A key press: the keydown listeners on the page, as the browser would run them.
  const key = (k, mods = {}, target = body) => {
    const e = { key: k, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, repeat: false, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods };
    for (const f of docListeners.keydown || []) f(e);
    return e.defaultPrevented;
  };
  const open = (sheet) => { openSheet = sheet; };
  return { ctx, $, toast, key, open, doc, show: (code) => vm.runInContext(code, ctx) };
};
const STALE = 'Changes here can’t be saved. Reload to get the newer version';

{
  // Data from a newer version: an edit that saves straight away (Update balances, Restore, a scan) shows the
  // warning, then its own "Updated…" toast. That edit wasn't saved, so the warning stays.
  const p = toastPage({ stale: true });
  p.show('warnStaleCopy(); showToast("Updated 1 balance")');
  check('stale data: “Updated 1 balance” doesn’t cover the “can’t be saved” warning', p.toast(), { msg: STALE, show: true, button: 'Reload' });
  let restored = 0;
  p.ctx.restore = () => { restored++; };
  p.show('showToast("Hilton Honors back to 200,000 points", restore)');
  check('…nor does a Restore with Undo', p.toast(), { msg: STALE, show: true, button: 'Reload' });
  check('…and Cmd+Z doesn’t act on that hidden Undo', [p.key('z', { metaKey: true }), restored], [false, 0]);
  p.show('showToast("Couldn’t read “2,125m” for Delta SkyMiles. Type the whole number, then tap Save.")');
  check('…a number that couldn’t be read still says so', p.toast().msg, 'Couldn’t read “2,125m” for Delta SkyMiles. Type the whole number, then tap Save.');
  for (const msg of ['That file isn’t a Points & Status backup', 'That link couldn’t be read — it may have been cut off',
    'This browser is too old to open that link — update it, or use a backup file', 'Not enough storage on this device']) {
    p.show(`warnStaleCopy(); showToast(${JSON.stringify(msg)})`);
    check(`…an error that saved nothing still says so: “${msg.slice(0, 30)}…”`, p.toast().msg, msg);
  }
  p.show('warnStaleCopy(); showToast("You have changes that aren’t saved. Tap Save to keep them.", () => {}, "Discard")');
  check('…so does the unsaved-changes note, with Discard', [p.toast().msg, p.toast().button], ['You have changes that aren’t saved. Tap Save to keep them.', 'Discard']);
  p.show('warnStaleCopy(); showToast("Removed Ana’s tracker", undoRemovals)');
  check('…and Undo for removed people (their only way back)', [p.toast().msg, p.toast().button], ['Removed Ana’s tracker', 'Undo']);
  p.show('warnStaleCopy(); showToast("Reload to get the newest version first, then back up", reloadForUpdate, "Reload", 15000)');
  check('…a Reload toast still shows', p.toast().msg, 'Reload to get the newest version first, then back up');
  p.show('warnStaleCopy()');
  const sheet = el('dialog');
  p.open(sheet);
  p.show('showToast("Goal saved")');
  check('…the warning behind a sheet opened since doesn’t hold back that sheet’s toasts', p.toast().msg, 'Goal saved');
  p.open(null);
  p.show('warnStaleCopy()');
  advance(15000);
  p.show('showToast("No changes")');
  check('…and once the warning is gone, toasts show again', p.toast().msg, 'No changes');
  p.ctx.staleCopy = false;
  p.show('warnStaleCopy(); showToast("Updated 1 balance")');
  check('saving works again (another tab saved this version): toasts cover it as before', p.toast().msg, 'Updated 1 balance');
}

/* ---------- Cmd/Ctrl+Z: the toast's Undo ---------- */

{
  const p = toastPage();
  p.ctx.undos = 0;
  p.show('showToast("Not tracking Uber Cash on Amex Platinum", () => { undos++; })');
  check('an Undo toast says Cmd/Ctrl+Z works', p.$('#toast-undo').ariaKeyShortcuts, 'Meta+Z Control+Z');
  check('Cmd+Z: runs Undo, and the toast goes', [p.key('z', { metaKey: true }), p.ctx.undos, p.toast().show], [true, 1, false]);
  p.show('showToast("Unchecked Uber Cash for October", () => { undos++; })');
  check('Ctrl+Z (with Caps Lock: “Z”) does it too', [p.key('Z', { ctrlKey: true }), p.ctx.undos], [true, 2]);
  check('with nothing to undo, Cmd+Z is left to the browser', [p.key('z', { metaKey: true }), p.ctx.undos], [false, 2]);
  p.show('showToast("Deleted “Free night”", () => { undos++; })');
  check('Cmd+Shift+Z, Alt+Cmd+Z, a held key or plain Z: nothing', [
    p.key('z', { metaKey: true, shiftKey: true }), p.key('z', { metaKey: true, altKey: true }), p.key('z', { metaKey: true, repeat: true }), p.key('z'), p.ctx.undos,
  ], [false, false, false, false, 2]);
  const field = el('input', { type: 'text' });
  const notes = el('textarea');
  const box = el('input', { type: 'checkbox' });
  check('…in a field you type in, its own undo: the toast’s Undo waits',
    [p.key('z', { metaKey: true }, field), p.key('z', { ctrlKey: true }, notes), p.key('z', { metaKey: true }, el('div', { isContentEditable: true })), p.ctx.undos, p.toast().show],
    [false, false, false, 2, true]);
  check('…on a checkbox you just ticked, Cmd+Z undoes', [p.key('z', { metaKey: true }, box), p.ctx.undos], [true, 3]);
  p.show('showToast("Deleted “Free night”", () => { undos++; })');
  advance(10000);
  check('after the toast has gone, Cmd+Z does nothing', [p.key('z', { metaKey: true }), p.ctx.undos], [false, 3]);
  p.show('showToast("A new version is ready", reloadForUpdate, "Reload", 15000)');
  check('Reload, Add or Discard aren’t pressed by Cmd+Z, and don’t claim it', [p.key('z', { metaKey: true }), p.ctx.reloads, p.$('#toast-undo').ariaKeyShortcuts], [false, 0, null]);
  p.show('showToast("Updated 1 balance")');
  p.show('showToast("Unticked Delta SkyMiles", () => { undos++; })');
  p.open(el('dialog'));
  check('an Undo toast left behind a sheet opened since: Cmd+Z leaves it', [p.key('z', { metaKey: true }), p.ctx.undos], [false, 3]);
}
check('a voucher’s Undo puts focus back on its ✕ (not the hidden “No vouchers” line)', [
  /if \(document\.activeElement === \$\('#vempty'\)\) document\.activeElement\.blur\(\);/.test(piece("  $('#vlist').addEventListener('click'", '  /* ---------- Backup')),
  /focusAfterUndo\(`#vlist \.v-del\[data-index="\$\{state\.vouchers\.indexOf\(removed\)\}"\]`, '#vlist \.v-del'\)/.test(piece("  $('#vlist').addEventListener('click'", '  /* ---------- Backup')),
], [true, true]);

/* ---------- "+ Add another status" left empty isn't a change ---------- */

const fakeDialog = (inputs) => {
  const save = { focused: false, focus() { this.focused = true; } };
  return {
    open: true, listeners: {}, save,
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    fire(type, e = {}) { for (const fn of this.listeners[type] || []) fn(e); },
    querySelectorAll: inputs,
    querySelector: (sel) => (sel === '[type=submit]' ? save : null),
    close() { this.open = false; this.fire('close'); },
  };
};
const guard = run(`let pressedOn = null;
  ${piece('  const backdropTap', '  // Says something to screen readers')}
  let undoAction = null;
  const showToast = (message, onUndo) => { undoAction = onUndo; };
  const hideToast = () => { undoAction = null; };
  globalThis.api = { guardEdits, formSnap, press: (d) => { pressedOn = d; } };`).api;
const backdrop = (d) => { guard.press(d); const e = { target: d, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; d.fire('click', e); return d.open; };
const escape = (d) => { const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; d.fire('cancel', e); return e.defaultPrevented; };
{
  // The program editor: a name, then a row per status (level, "from", end date).
  const row = (tier, via = '', exp = '') => {
    const r = {};
    const mk = (cls, value) => ({ type: cls === 'sl-date' ? 'date' : 'text', value, closest: (sel) => (sel === '.sl' ? r : null) });
    r.tier = mk('sl-tier', tier); r.via = mk('sl-via', via); r.date = mk('sl-date', exp);
    r.querySelector = (sel) => (sel === '.sl-tier' ? r.tier : sel === '.sl-via' ? r.via : r.date);
    return r;
  };
  const name = { type: 'text', value: 'World of Hyatt', closest: () => null };
  const rows = [row('Explorist')];
  const ed = fakeDialog(() => [name, ...rows.flatMap((r) => [r.tier, r.via, r.date])]);
  guard.guardEdits(ed);
  ed._snap = guard.formSnap(ed);
  rows.push(row(''));
  check('program editor: “+ Add another status” left empty, then a backdrop tap, closes it', backdrop(ed), false);
  ed.open = true; ed._snap = guard.formSnap(ed);
  check('…Escape too', escape(ed), false);
  rows.at(-1).tier.value = 'Globalist';
  check('…typing a level in it counts as a change', escape(ed), true);
  rows.at(-1).tier.value = ''; rows.at(-1).via.value = 'Chase Sapphire';
  check('…so does typing where it’s from', escape(ed), true);
  rows.at(-1).via.value = ''; rows.at(-1).date.value = '2027-02-28';
  check('…but only an end date isn’t (Save drops a row with no level or “from”)', escape(ed), false);
  rows.pop(); ed._snap = guard.formSnap(ed);
  rows[0].tier.value = '';
  check('…emptying the only status still counts as a change', escape(ed), true);
  rows[0].tier.value = 'Explorist'; ed._snap = guard.formSnap(ed);
  rows.pop();
  check('…and so does removing a row', escape(ed), true);
  name.value = 'Hyatt';
  check('…as does the name', escape(ed), true);
}
{
  // Update balances' inputs have no closest(): they're read as before.
  const inputs = [{ type: 'text', value: '84,210' }];
  const d = fakeDialog(() => inputs);
  guard.guardEdits(d);
  d._snap = guard.formSnap(d);
  check('Update balances: nothing typed still closes', backdrop(d), false);
  d.open = true; d._snap = guard.formSnap(d); inputs[0].value = '90000';
  check('…typing still holds it', escape(d), true);
}

/* ---------- Reading a typed number with k or m ---------- */

const parse = run(`const MAX_VALUE = 1e12;\n${piece('  function parseEntry', '  function paintNum')}\nglobalThis.parseEntry = parseEntry;`).parseEntry;
const read = (text, dollars) => { const r = parse(text, dollars); return r ? r.value : 'unread'; };
check('“2.125m” is 2,125,000 and “1.250k” is 1,250 (not 1,000 times as much)', [read('2.125m'), read('1.250k'), read('1.255k'), read('12.125k'), read('$2.125M'), read('2.125 m miles')],
  [2125000, 1250, 1255, 12125, 2125000, 2125000]);
check('…“2,125m” and “1,250k” could mean either, so they aren’t read (the person is asked to type the whole number)', [read('2,125m'), read('1,250k'), read('1,000k')], ['unread', 'unread', 'unread']);
check('…“84.500” with no k or m is still 84,500', read('84.500'), 84500);
check('round 1 still holds: 1.5k, 2,25m, 212,500, 84.500, 84 500, $4,512.37, 84,500 miles',
  [read('1.5k'), read('2,25m'), read('212,500'), read('84.500'), read('84 500'), read('$4,512.37'), read('84,500 miles')],
  [1500, 2250000, 212500, 84500, 84500, 4512, 84500]);
check('…“212,50” is still refused', read('212,50'), 'unread');
check('…and 1.25m, 50K, 1,234,567, 84,500 points, 1,250,000 and 2m are as before',
  [read('1.25m'), read('50K'), read('1,234,567'), read('84,500 points'), read('1,250,000'), read('2m')], [1250000, 50000, 1234567, 84500, 1250000, 2000000]);

/* ---------- Contrast, wrapping, lists and headings ---------- */

// The light theme's colors, and WCAG contrast.
const lightVars = Object.fromEntries([...css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const rgb = (c) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const m = /rgba?\(([^)]+)\)/.exec(c).map(String)[1].split(',').map(Number);
  return m;
};
const over = (top, under) => { const [r, g, b, a = 1] = rgb(top); const u = rgb(under); return [r, g, b].map((v, i) => v * a + u[i] * (1 - a)); };
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const tagRule = (/\.tag\.warn \{([^}]*)\}/.exec(css) || [])[1] || '';
const tagInk = lightVars[(/color: var\((--[\w-]+)\)/.exec(tagRule.replace(/background:[^;]*;/, '')) || [])[1]];
check('“10 days” / “Today” tags use the darker warning ink', /color: var\(--warn-ink\)/.test(tagRule), true);
check('…which reads at 4.5:1 or better on cards, the page and insets', ['--card', '--bg', '--inset'].map((bg) => ratio(rgb(tagInk), over(lightVars['--warn-soft'], lightVars[bg])) >= 4.5), [true, true, true]);
check('hero tile: “expiring soon” is #FFF1DE and the other labels are opaque #F4F7FB', [
  /\.stat-l\.warn \{ color: #FFF1DE;/.test(css), /\.stat-l \{[^}]*color: #F4F7FB;/.test(css),
], [true, true]);
check('Update balances: names wrap instead of being cut off', [
  /\.quick-name span \{[^}]*overflow-wrap: anywhere/.test(css), /\.quick-name span \{[^}]*(text-overflow|white-space: nowrap)/.test(css),
], [true, false]);
check('lists without bullets keep their list role (Safari drops it otherwise)', [
  '<ul class="up-list" id="up-list" role="list">', '<ul class="card programs" id="programs" role="list">', '<ul class="vlist" id="vlist" role="list">',
  '<ul class="quick-list" id="quick-list" role="list">', '<ul class="people" id="people-list" role="list">',
].map((s) => html.includes(s)).concat(js.includes("h('ul', { class: 'perk-items', role: 'list' }")), [true, true, true, true, true, true]);
check('Credits checklist: cards are h3 under it, “Also on this card” h4, and renaming a second card retitles the h3', [
  js.includes("h('h3', null, c.card.label || c.card.name)"), js.includes("h('h3', null, 'Add your cards')"),
  js.includes("h('h4', { class: 'cp-others-title' }, 'Also on this card'"), js.includes("section.querySelector('h3').replaceChildren(creditCard(copy).name);"),
  /\.cp-panel h3 \{ margin: 0 0 4px; font-size: 16px; \}/.test(css), /\.cp-card-head h3 \{ flex: 1 1 auto;/.test(css), /\.cp-(panel|card-head) h2/.test(css),
], [true, true, true, true, true, true, false]);
check('a credit named the same on another card says which card', js.includes('creditCardIds().some((id) => id !== cardId && cardCreditDefs(id).some((c) => sameText(c.name, name)))'), true);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
