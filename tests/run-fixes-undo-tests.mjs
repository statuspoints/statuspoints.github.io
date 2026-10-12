// Checks toasts, Undo and filters (from index.html) against a small fake page: removing several people in one
// Undo window, switching person while that Undo is up, a toast left inside a sheet that closes, the Undo toast's own focus, a filter whose chips are
// hidden, replacing the tracker, another tab deleting the program open in the detail sheet or the editor, and a
// tracker replaced under open sheets and toasts (another tab starting over, or saved data that can't be shown).
// Usage: node tests/run-fixes-undo-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const dates = js.slice(js.indexOf('  function parseISODate'), js.indexOf('  function expiryLine'))
  + js.slice(js.indexOf('  function isoOf'), js.indexOf('  // Phones: hand the file'));
// From one line of the app up to the next given line.
const piece = (from, to) => { const at = js.indexOf(from); if (at < 0) throw new Error(`not found: ${from}`); return js.slice(at, js.indexOf(to, at)); };

/* A fake page: elements with children, listeners (capture and bubble), focus and dialogs. */

let now = 0;
let timers = [];
const setTimeout = (fn, ms = 0) => { const t = { fn, at: now + ms, id: timers.length + 1 }; timers.push(t); return t.id; };
const clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
// Moves the clock on, running whatever comes due on the way.
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
class FakeDate extends Date { static now() { return now; } }

function makePage() {
  class El {
    constructor(tag, id) {
      this.tagName = tag.toUpperCase();
      this.id = id || '';
      this.children = [];
      this.parentNode = null;
      this.listeners = [];
      this.hidden = false;
      this.textContent = '';
      this.open = false;
      this.dataset = {};
      this.attrs = {};
      const classes = new Set();
      this.classList = {
        add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
        toggle: (c, on = !classes.has(c)) => (on ? classes.add(c) : classes.delete(c)),
      };
    }
    append(...kids) {
      for (const kid of kids) {
        if (!(kid instanceof El)) continue;
        if (kid.parentNode) kid.parentNode.children = kid.parentNode.children.filter((c) => c !== kid);
        kid.parentNode = this;
        this.children.push(kid);
      }
    }
    replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(type, fn, opts) { this.listeners.push({ type, fn, capture: opts === true || !!(opts && opts.capture) }); }
    dispatchEvent(e) {
      const path = [];
      for (let n = this; n; n = n.parentNode) path.push(n);
      e.target = this;
      const run = (node, capture) => {
        for (const l of node.listeners) if (l.type === e.type && (capture == null || l.capture === capture)) { e.currentTarget = node; l.fn(e); }
      };
      for (const node of path.slice(1).reverse()) run(node, true);
      run(this, null);
      if (e.bubbles) for (const node of path.slice(1)) run(node, false);
    }
    focus() {
      const was = page.document.activeElement;
      if (was === this) return;
      page.document.activeElement = this;
      if (was && was !== page.body) was.dispatchEvent({ type: 'focusout', bubbles: true });
      this.dispatchEvent({ type: 'focusin', bubbles: true });
    }
    closest(sel) { // only [data-*] selectors
      const key = (sel.match(/^\[data-([a-z-]+)\]$/) || [])[1];
      const prop = key && key.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      for (let n = this; n && prop; n = n.parentNode) if (n.dataset && prop in n.dataset) return n;
      return null;
    }
    click() { this.dispatchEvent({ type: 'click', bubbles: true }); }
    showModal() { this.open = true; }
    close() { // the browser drops [open] first; 'close' doesn't bubble
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent({ type: 'close', bubbles: false });
    }
  }
  const document = new El('#document');
  const body = new El('body');
  document.append(body);
  document.body = body;
  const all = function* (n) { for (const c of n.children) { yield c; yield* all(c); } };
  document.querySelector = (sel) => {
    if (sel === 'dialog[open]') return [...all(document)].find((n) => n.tagName === 'DIALOG' && n.open) || null;
    if (sel.startsWith('#')) return [...all(document)].find((n) => n.id === sel.slice(1)) || null;
    return null;
  };
  document.querySelectorAll = (sel) => (sel === 'dialog[open]' ? [...all(document)].filter((n) => n.tagName === 'DIALOG' && n.open) : []);
  document.createElement = (tag) => new El(tag);
  document.activeElement = body;
  const make = (tag, id, parent = body) => { const el = new El(tag, id); parent.append(el); return el; };
  const page = { El, document, body, make, $: (sel) => document.querySelector(sel) };
  return page;
}

// A fake localStorage over a Map.
function makeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

const globals = () => ({ console, Intl, Math, Number, String, Object, Array, Set, Map, RegExp, JSON, Date: FakeDate, setTimeout, clearTimeout });

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

/* ---------- Toasts and removing people ---------- */

function toastApp() {
  const page = makePage();
  const toast = page.make('div', 'toast');
  page.make('span', 'toast-msg', toast);
  page.make('button', 'toast-undo', toast);
  const peopleSheet = page.make('dialog', 'people-sheet');
  const detail = page.make('dialog', 'detail');
  const keep = page.make('button', 'keep', peopleSheet); // a control that stays put while rows re-render
  const localStorage = makeStorage();
  const app = { page, toast, peopleSheet, detail, keep, localStorage };
  const context = vm.createContext({ ...globals(), document: page.document, $: page.$, app });
  vm.runInContext(`
    const people = { active: 'me', list: [{ id: 'me', name: '' }, { id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }] };
    const KEY = 'status-tracker-v2';
    const localStorage = app.localStorage;
    const storageKey = (id = people.active) => (id === 'me' ? KEY : \`\${KEY}:\${id}\`);
    const whose = (person) => (person.name ? \`\${person.name}’s\` : 'your');
    const activePerson = () => people.list.find((person) => person.id === people.active);
    const savePeople = () => {}; const renderPeople = () => {}; const saveRename = () => {};
    const backdropTap = () => false;
    const peopleSheet = app.peopleSheet;
    // What switching person needs around it: a saved tracker for everyone, and rendering that works unless the
    // test says it doesn't (renderSafely is false when the saved data was set aside instead).
    let renaming = null;
    let saveTimer = 0;
    const saveNow = () => {}; const stopScanning = () => {}; const rollOver = () => {}; const scrollTo = () => {};
    const state = {};
    const load = () => ({ programs: [] });
    const renderSafely = () => !app.renderFails;
    let editMode = false; let filter = 'all'; let planOpen = false; let planMqd = 0; let planSpend = 0; let intro = false;
    const picked = new Set(); const pickedCards = new Set();
    ${piece('  /* ---------- Toast ---------- */', '  /* ---------- People on this device ---------- */')}
    ${piece('  let recentRemovals', '  function programCount')}
    ${piece("  // Shows someone else's tracker", '  function saveRename')}
    ${piece("  peopleSheet.addEventListener('click'", "  peopleSheet.addEventListener('keydown'")}
    globalThis.api = { showToast, hideToast, hideTrackerToast, reloadForUpdate, switchPerson, people, undo: () => undoAction };`, context);
  for (const id of ['a', 'b', 'c', 'd']) localStorage.setItem(`status-tracker-v2:${id}`, `{"programs":[],"who":"${id}"}`);
  app.api = context.api;
  // Tapping a person's remove (×) button on the People sheet.
  app.remove = (id) => {
    for (const l of peopleSheet.listeners) if (l.type === 'click') l.fn({ target: { closest: (sel) => (sel === '[data-remove]' ? { dataset: { remove: id } } : null) } });
  };
  app.ids = () => app.api.people.list.map((p) => p.id);
  app.shown = () => toast.classList.contains('show');
  return app;
}

now = 0; timers = [];
{
  // Finding: a third removal, 9 s after the first, used to drop the first from the Undo while the toast was still up.
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  advance(5000);
  app.remove('b');
  advance(4000);
  app.remove('c');
  check('three removals inside one Undo toast: it counts all three', app.page.$('#toast-msg').textContent, 'Removed 3 trackers');
  check('…the toast is still up 9 s after the first', app.shown(), true);
  app.page.$('#toast-undo').click();
  check('…Undo puts all three back, in their places', app.ids(), ['me', 'a', 'b', 'c', 'd']);
  check('…with their saved trackers', ['a', 'b', 'c'].map((id) => (JSON.parse(app.localStorage.getItem(`status-tracker-v2:${id}`)) || {}).who), ['a', 'b', 'c']);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  advance(10000);
  check('once the Undo toast has gone, the removal stays', app.shown(), false);
  app.remove('b');
  check('…the next removal starts a fresh Undo', app.page.$('#toast-msg').textContent, 'Removed Ben’s tracker');
  app.page.$('#toast-undo').click();
  check('…which brings back only that one', app.ids(), ['me', 'b', 'c', 'd']);
  check('…and the first one’s tracker stays deleted', app.localStorage.getItem('status-tracker-v2:a'), null);
}
now = 0; timers = [];
{
  // Finding: switching person hid the toast, so removing someone and then switching made the removal permanent
  // (their tracker is already out of storage; Undo is the only way back).
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  advance(2000);
  app.api.switchPerson('b');
  check('switching person while a removal’s Undo is up keeps that Undo on screen',
    [app.shown(), app.page.$('#toast-msg').textContent, app.page.$('#toast-undo').hidden], [true, 'Removed Ana’s tracker', false]);
  app.page.$('#toast-undo').click();
  check('…and it still brings them back, with their saved tracker', [app.ids(), (JSON.parse(app.localStorage.getItem('status-tracker-v2:a')) || {}).who],
    [['me', 'a', 'b', 'c', 'd'], 'a']);
  check('…then says whose tracker is showing now', [app.shown(), app.page.$('#toast-msg').textContent, app.page.$('#toast-undo').hidden],
    [true, 'Showing Ben’s tracker', true]);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  app.api.switchPerson('b');
  advance(10000);
  check('left alone, the Undo toast goes on time and the switch note follows it', [app.shown(), app.page.$('#toast-msg').textContent], [true, 'Showing Ben’s tracker']);
  advance(5000);
  check('…and that note goes too, leaving the removal done', [app.shown(), app.localStorage.getItem('status-tracker-v2:a')], [false, null]);
}
now = 0; timers = [];
{
  // Review finding: a held switch note came up long after, once another toast had replaced the one it waited for.
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  app.api.switchPerson('b');
  app.api.showToast('Goal removed', () => {});
  advance(10000);
  check('a toast that replaces the removal’s Undo drops the waiting switch note: nothing pops up later', app.shown(), false);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.keep.focus();
  app.api.showToast('Goal removed', () => {});
  app.api.switchPerson('c');
  check('an Undo that belongs to the person being left goes when switching', [app.page.$('#toast-msg').textContent, app.page.$('#toast-undo').hidden],
    ['Showing Cy’s tracker', true]);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.keep.focus();
  app.renderFails = true; // Cy's saved data can't be shown, and is set aside (openFresh says so itself)
  app.api.switchPerson('c');
  check('switching to someone whose data had to be set aside doesn’t add a note of its own', app.shown(), false);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  check('the Undo toast shows inside the open People sheet', app.toast.parentNode === app.peopleSheet, true);
  app.peopleSheet.close();
  check('closing the sheet moves the toast back onto the page', app.toast.parentNode === app.page.body, true);
  check('…still showing, with its Undo', [app.shown(), app.page.$('#toast-undo').hidden], [true, false]);
  app.page.$('#toast-undo').click();
  check('…and Undo still works', app.ids(), ['me', 'a', 'b', 'c', 'd']);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.detail.showModal();
  app.keep.focus();
  let reloaded = false;
  app.api.showToast('A new version is ready', () => { reloaded = true; }, 'Reload', 15000);
  app.detail.close();
  check('a Reload toast shown over the detail sheet survives the sheet closing', [app.toast.parentNode === app.page.body, app.shown()], [true, true]);
  app.page.$('#toast-undo').click();
  check('…and its Reload still runs', reloaded, true);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.peopleSheet.showModal();
  app.detail.showModal();
  app.keep.focus();
  app.api.showToast('Goal removed', () => {});
  app.peopleSheet.close();
  check('with two sheets open, closing the one holding the toast moves it into the other', app.toast.parentNode === app.detail, true);
  app.detail.close();
  check('…and closing that one too moves it onto the page', app.toast.parentNode === app.page.body, true);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.keep.focus();
  app.api.showToast('Saved');
  app.peopleSheet.showModal();
  app.peopleSheet.close();
  check('closing a sheet that doesn’t hold the toast leaves it where it is', app.toast.parentNode === app.page.body, true);
}
now = 0; timers = [];
{
  // Finding: the control you used went away, Undo took focus, and its own focusin stopped the timer for good.
  const app = toastApp();
  app.page.document.activeElement = app.page.body;
  app.api.showToast('Goal removed', () => {});
  check('Undo takes focus when the control you used went away', app.page.document.activeElement === app.page.$('#toast-undo'), true);
  advance(9999);
  check('…the toast is up just before 10 s', app.shown(), true);
  advance(1);
  check('…and goes at 10 s, even though Undo has focus', [app.shown(), app.api.undo() === null], [false, true]);
}
now = 0; timers = [];
{
  const app = toastApp();
  app.keep.focus();
  app.api.showToast('Goal removed', () => {});
  app.toast.dispatchEvent({ type: 'mouseenter', bubbles: false });
  advance(60000);
  check('pointing at the toast still keeps it up', app.shown(), true);
  app.toast.dispatchEvent({ type: 'mouseleave', bubbles: false });
  advance(4000);
  check('…and it goes 4 s after you leave', app.shown(), false);
}

/* ---------- Filters and replacing the tracker ---------- */

function filterApp() {
  const page = makePage();
  page.make('div', 'filters');
  const localStorage = makeStorage();
  const app = { page, localStorage, shown: [] };
  const context = vm.createContext({ ...globals(), document: page.document, $: page.$, app });
  vm.runInContext(`
    const matchMedia = () => ({ matches: false, addEventListener() {} });
    const navigator = {}; const addEventListener = () => {};
    const localStorage = app.localStorage;
    ${head}
    ${dates}
    let state = normalize({ programs: [] });
    let editMode = false;
    let intro = false;
    const medallionProgram = () => null;
    const medallionFor = () => ({ current: null });
    const lineExpired = () => false;
    const stopScanning = () => {}; const rollOver = () => {}; const saveNow = () => {};
    const renderPrograms = () => {};
    const showToast = (message, action) => app.shown.push({ message, action });
    const renderAll = () => renderFilters();
    ${piece("  let filter = 'all';", '  function renderPrograms(')}
    ${piece('  // Swaps in another tracker', '  /* ---------- Send to another device')}
    globalThis.api = { normalize, renderFilters, replaceTracker, matchesFilter,
      getState: () => state, setState: (s) => { state = s; }, setEditMode: (on) => { editMode = on; },
      getFilter: () => filter, setFilter: (f) => { filter = f; } };`, context);
  app.api = context.api;
  app.visible = () => app.api.getState().programs.filter(app.api.matchesFilter).map((p) => p.id);
  return app;
}

const program = (id, name) => ({ id, name, unit: 'points', status: [] });
const delta = program('delta', 'Delta SkyMiles');
const united = program('united', 'United MileagePlus');
const hilton = program('hilton', 'Hilton Honors');
const marriott = program('marriott', 'Marriott Bonvoy');
const hyatt = program('hyatt', 'World of Hyatt');

{
  // Finding: Hotels chosen with 4 programs, an airline removed in Edit; the chips hide but the filter stayed on.
  const app = filterApp();
  app.api.setState(app.api.normalize({ programs: [delta, united, hilton, marriott] }));
  app.api.setFilter('Hotels');
  app.api.renderFilters();
  check('the test programs fall into Airlines and Hotels', app.visible(), ['hilton', 'marriott']);
  app.api.setEditMode(true);
  app.api.getState().programs.splice(1, 1);
  app.api.renderFilters();
  app.api.setEditMode(false);
  app.api.renderFilters();
  check('down to 3 programs: the chips hide', app.page.$('#filters').hidden, true);
  check('…and the filter goes back to All, so every program shows', [app.api.getFilter(), app.visible()], ['all', ['delta', 'hilton', 'marriott']]);
}
{
  const app = filterApp();
  app.api.setState(app.api.normalize({ programs: [delta, united, hilton, marriott] }));
  app.api.setFilter('Hotels');
  app.api.setEditMode(true);
  app.api.renderFilters();
  check('in Edit with 4 programs, the chosen filter is kept for after', app.api.getFilter(), 'Hotels');
}
{
  // Finding: Airlines chosen, then a backup with 1 airline and 2 hotels restored: only the airline showed.
  const app = filterApp();
  app.api.setState(app.api.normalize({ programs: [delta, united, hilton, marriott] }));
  app.api.setFilter('Airlines');
  app.api.renderFilters();
  app.api.replaceTracker(app.api.normalize({ programs: [delta, hilton, marriott] }), 'Backup restored');
  check('a restored backup with 3 programs shows all of them', [app.api.getFilter(), app.visible()], ['all', ['delta', 'hilton', 'marriott']]);
}
{
  const app = filterApp();
  app.api.setState(app.api.normalize({ programs: [delta, united, hilton, marriott] }));
  app.api.setFilter('Airlines');
  app.api.renderFilters();
  app.api.replaceTracker(app.api.normalize({ programs: [delta, united, hilton, marriott, hyatt] }), 'Backup restored');
  check('replacing the tracker starts from All, like switching person', [app.api.getFilter(), app.visible().length], ['all', 5]);
}

/* ---------- Another tab changes this tracker while the detail sheet is open ---------- */

function storageApp() {
  const page = makePage();
  page.make('dialog', 'worth-sheet');
  const detail = page.make('dialog', 'detail');
  const sheet = page.make('dialog', 'sheet');
  const localStorage = makeStorage();
  const app = { page, detail, sheet, localStorage, handlers: [], rendered: 0 };
  const context = vm.createContext({ ...globals(), document: page.document, $: page.$, app });
  vm.runInContext(`
    const matchMedia = () => ({ matches: false, addEventListener() {} });
    const navigator = {};
    const addEventListener = (type, fn) => { if (type === 'storage') app.handlers.push(fn); };
    const localStorage = app.localStorage;
    ${head}
    ${dates}
    const state = load();
    let saveTimer = 0;
    let editMode = false;
    const detail = app.detail;
    let detailId = null;
    const sheet = app.sheet;
    let sheetId = null;
    ${piece('  const detailProgram', '  const maskNumber')}
    const renderWorth = () => {}; const renderHousehold = () => {};
    // Showing a tracker throws while app.breaks is set and there is one (as an older cached version might).
    const renderAll = () => { app.rendered++; if (app.breaks && state.programs) throw new Error('can’t show this'); };
    const stopScanning = () => { app.stopped = true; };
    const hideTrackerToast = () => { app.toastHidden = true; };
    const showNote = (message) => { app.note = message; };
    const console = { error() {} };
    ${piece('  // The tracker on screen was replaced', '  // Opening flourish')}
    ${piece('  // Another tab or window saved this tracker', '  // Flush a pending save')}
    globalThis.api = {
      KEY, state,
      open: (id) => { detailId = id; detail.showModal(); },
      edit: (id) => { sheetId = id; sheet.showModal(); }, // the program editor; null when adding
    };`, context);
  app.api = context.api;
  // The other tab saves (or clears) this tracker.
  app.otherTab = (s) => {
    const value = s ? JSON.stringify(s) : null;
    if (value) localStorage.setItem(app.api.KEY, value); else localStorage.removeItem(app.api.KEY);
    for (const fn of app.handlers) fn({ key: app.api.KEY, newValue: value });
  };
  return app;
}

const saved = (programs) => ({ programs, balances: {}, cards: [] });
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.open('hilton');
  app.otherTab(saved([marriott]));
  check('another tab deletes the program open in the detail sheet: the sheet closes', [app.detail.open, app.rendered > 0], [false, true]);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.open('hilton');
  let threw = false;
  try { app.otherTab(null); } catch (e) { threw = true; }
  check('another tab starts over (no programs): the sheet closes without an error', [threw, app.detail.open], [false, false]);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.open('hilton');
  app.otherTab(saved([hilton]));
  check('another tab changes something else: the sheet stays open', app.detail.open, true);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.edit('hilton');
  app.otherTab(saved([marriott]));
  check('another tab deletes the program open in the editor: the editor closes (Save can’t bring it back)', app.sheet.open, false);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.edit('hilton');
  let threw = false;
  try { app.otherTab(null); } catch (e) { threw = true; }
  check('another tab starts over while editing a program: the editor closes without an error', [threw, app.sheet.open], [false, false]);
  check('another tab starts over: scanning stops before the sheets close', app.stopped, true);
  check('another tab starts over: an Undo toast from before goes too (it would undo into a tracker that’s gone)', app.toastHidden, true);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.otherTab(saved([marriott]));
  check('another tab changes something but keeps the tracker: an Undo toast stays', app.toastHidden, undefined);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.edit(null);
  app.otherTab(null);
  check('another tab starts over while adding a program: the editor closes', app.sheet.open, false);
}
{
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.edit('hilton');
  app.otherTab(saved([hilton]));
  check('another tab changes something else: the editor stays open', app.sheet.open, true);
  const adding = storageApp();
  adding.otherTab(saved([hilton, marriott]));
  adding.api.edit(null);
  adding.otherTab(saved([hilton]));
  check('another tab changes something while adding a program: the editor stays open', adding.sheet.open, true);
}
{
  // Fix: saved data that can't be shown opens the tracker fresh; nothing left open still acts on the old one.
  const app = storageApp();
  app.otherTab(saved([hilton, marriott]));
  app.api.open('hilton');
  app.breaks = true;
  let threw = false;
  try { app.otherTab(saved([hilton])); } catch (e) { threw = true; }
  check('another tab saves data this one can’t show: it opens fresh, with the detail sheet closed',
    [threw, app.api.state.programs, app.detail.open], [false, null, false]);
  check('…scanning stops and the old tracker’s Undo toast goes', [app.stopped, app.toastHidden], [true, true]);
  check('…and it says the saved tracker was kept aside', app.note, 'Couldn’t show your saved tracker — it’s kept aside on this device, not deleted');
}

now = 0; timers = [];
{
  // Fix: a tracker replaced under a person-removal Undo leaves that Undo up (it's the only way back for them).
  const app = toastApp();
  app.peopleSheet.showModal();
  app.keep.focus();
  app.remove('a');
  app.api.hideTrackerToast();
  check('a removal’s Undo stays when the tracker on screen is replaced', [app.shown(), app.api.undo() != null], [true, true]);
  app.page.$('#toast-undo').click();
  check('…and still brings the person back with their tracker', [app.ids(), (JSON.parse(app.localStorage.getItem('status-tracker-v2:a')) || {}).who], [['me', 'a', 'b', 'c', 'd'], 'a']);
  app.api.showToast('A new version is ready', app.api.reloadForUpdate, 'Reload', 15000);
  app.api.hideTrackerToast();
  check('…a new version’s Reload stays too', app.shown(), true);
  app.api.showToast('Deleted Hilton', () => {});
  app.api.hideTrackerToast();
  check('…while the tracker’s own Undo goes', [app.shown(), app.api.undo()], [false, null]);
}

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
