// Checks a new person's first steps and sharing (from index.html): the setup screen keeps Start on screen on a phone
// with the example and backup links near the top; a send link with no name asks whose it is, and a newer link from
// someone already here updates their copy (with Undo, never touching your own tracker); typing "United" in Add program
// offers United MileagePlus with its levels and perks; a program's details have an Add balance button; the example
// setup has Undo; a tracker arriving on a new device doesn't show "What's new"; the scan card's chooser button says
// what it does; and the credit card swatch has a chip, so it doesn't look like a tick box.
// Usage: node tests/run-fixes-journey-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

// Everything up to `const state = load();` (constants, catalog, normalize, people, load), plus pieces under test
// (from a line up to the next given line; a piece that isn't there is left out, so its checks fail rather than crash).
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => { const at = js.indexOf(from); return at < 0 ? '' : js.slice(at, js.indexOf(to, at)); };
const dates = piece('  function parseISODate', '  function daysUntil');
const today = piece('  function isoOf', '  // Phones: hand the file');

const KEY = 'status-tracker-v2';
const PEOPLE_KEY = 'status-tracker-people';
const NEWS_KEY = 'status-tracker-news';

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
// A group of checks whose code isn't there yet (or throws) counts as one failure, not a crash.
const group = async (name, fn) => {
  try { await fn(); } catch (err) { total++; failed++; console.log(`✗ ${name}: threw ${err.message}`); }
};

/* ---------- A small fake app with real storage, the real people, link, replace and setup code ---------- */

const device = (entries = {}) => new Map(Object.entries(entries));
function app(store) {
  const context = vm.createContext({ console: { error() {}, log: console.log }, Intl, Math, Date, Number, String, Object,
    Array, Set, Map, RegExp, JSON, Promise, Uint8Array, setTimeout, clearTimeout, TextEncoder, TextDecoder, atob, btoa, Blob, Response,
    CSS: { escape: (s) => s }, store });
  vm.runInContext(`
  const store = globalThis.store;
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }, key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
  };
  class Event { constructor(type) { this.type = type; } }
  const els = {};
  const el = (sel) => els[sel] || (els[sel] = { sel, hidden: false, textContent: '', value: '', dataset: {}, open: false, opened: 0,
    on: {}, drawn: 0, showModal() { this.open = true; this.opened++; }, close() { this.open = false; },
    addEventListener(type, fn) { (this.on[type] = this.on[type] || []).push(fn); },
    dispatchEvent(ev) { (this.on[ev.type] || []).forEach((fn) => fn(ev)); },
    click() { (this.on.click || []).forEach((fn) => fn({ target: this })); },
    replaceChildren() { this.drawn++; }, setAttribute() {}, focus() { focused = this.sel; }, select() {} });
  let focused = null;
  el('#receive-replace').textContent = 'Replace the tracker on this device'; // as the page has it
  el('#receive-name-wrap').hidden = true; el('#receive-update').hidden = true; // hidden in the page until needed
  const document = { querySelector: el, querySelectorAll: () => [], visibilityState: 'visible',
    documentElement: { classList: { contains: () => false } }, addEventListener() {},
    createElement: () => ({ setAttribute() {}, append() {}, content: { firstChild: null } }) };
  const listeners = {};
  const addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {};
  const window = globalThis;
  const location = { hash: '', pathname: '/', search: '', origin: 'https://example.test' };
  const history = { replaceState(a, b, url) { location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } };
  ${head}
  ${dates}
  ${today}
  ${piece('  function sortVouchers', '  function expiryLine')}
  const state = load();
  const toasts = [];
  let toast = null; // what's showing: { message, undo, label, ms }
  let saveTimer = 0;
  let editMode = false;
  let filter = 'all';
  let planOpen = false;
  let planMqd = 0;
  let planSpend = 0;
  let intro = false;
  const picked = new Set();
  const pickedCards = new Set();
  const detail = { open: false };
  const detailProgram = () => null;
  const sheet = { open: false };
  let sheetId = null;
  ${piece('  // Something in the tracker changed: dated for the backup nudge', '  function scheduleSave')}
  const saveNow = () => { if (state.programs) localStorage.setItem(storageKey(), JSON.stringify(state)); else localStorage.removeItem(storageKey()); };
  const stopScanning = () => {}; const dropTyped = () => {};
  const forgetCreditParts = () => {}; const resetCreditsView = () => {};
  const hideToast = () => { toast = null; }; const hideTrackerToast = hideToast; let undoAction = null;
  const savedText = () => JSON.stringify(state);
  const reloadForUpdate = () => {}; const warnStaleCopy = () => toasts.push('stale copy: reload');
  const updateReady = false;
  const scrollTo = () => {};
  const rollOver = () => false;
  const renderToday = () => {}; const renderCredits = () => {}; const renderVouchers = () => {}; const renderWorth = () => {};
  const showToast = (message, undo, label = 'Undo', ms = 5000) => { toasts.push(message); toast = { message, undo, label, ms }; };
  const showNote = (message) => toasts.push(message);
  function renderAll() {}
  ${piece('  // The tracker on screen was replaced', '  // Opening flourish')}
  ${piece('  // Swaps in another tracker for whoever is showing', '  /* ---------- Send to another device')}
  ${piece('  const toB64url', '  const sendSheet')}
  ${piece('  // Opening a link made above', '  /* ---------- Toast')}
  ${piece("  const peopleSheet = $('#people-sheet');", '  function openPeople')}
  ${piece("  // Shows someone else's tracker", '  function saveRename')}
  ${piece('  // A one-time card listing new features', '  /* ---------- Install hint')}
  ${piece('  function finishSetup', "  $('#catalog')")}
  ${piece("  $('#setup-example')", "  $('#setup-restore')")}
  globalThis.api = { state, people, toasts, el, location, receiveFromLink, finishSetup, storageKey,
    toast: () => toast, focused: () => focused,
    catalogLoose: typeof catalogLoose === 'function' ? catalogLoose : () => 'missing' };`, context);
  return context.api;
}

const program = (id, name) => ({ id, name, unit: 'points', status: [] });
const trackerData = (balances, ...programs) => ({ programs, balances, cards: [], notes: '' });
const peopleList = (active, ...list) => JSON.stringify({ active, list: list.map(([id, name]) => ({ id, name })) });
const linkFor = (payload) => `#import=j${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const sendLink = (name, hyatt) => linkFor({ app: 'points-status-tracker', v: 1, name, data: trackerData({ hyatt }, program('hyatt', 'World of Hyatt')) });
const hyattOf = (store, key) => JSON.parse(store.get(key)).balances.hyatt;
const open = async (a, link) => { a.location.hash = link; await a.receiveFromLink(); };

/* ---------- 2. Sharing with a partner ---------- */

await group('receiving a link from someone unnamed', async () => {
  const mine = JSON.stringify(trackerData({ hilton: 5000 }, program('hilton', 'Hilton Honors')));
  const store = device({ [KEY]: mine });
  const a = app(store);
  await open(a, sendLink('', 61200));
  check('a link from someone never named asks whose tracker it is', [a.el('#receive-sheet').opened, a.el('#receive-name-wrap').hidden], [1, false]);
  check('…with no Update button yet (nobody here by that name)', a.el('#receive-update').hidden, true);
  a.el('#receive-name').value = 'Alex';
  a.el('#receive-name').dispatchEvent({ type: 'input' });
  a.el('#receive-person').click();
  const alex = a.people.list.find((p) => p.name === 'Alex');
  check('Add as another person names them as typed', [a.people.list.length, !!alex, a.people.active === (alex && alex.id)], [2, true, true]);
  check('…their copy is saved under them, your own tracker untouched', [hyattOf(store, `${KEY}:${alex.id}`), store.get(KEY)], [61200, mine]);

  // Back on your own tracker, Alex sends a newer link.
  store.set(PEOPLE_KEY, peopleList('me', ['me', ''], [alex.id, 'Alex']));
  const c = app(store);
  await open(c, sendLink('', 70000));
  check('a newer unnamed link: no Update until you say whose it is', [c.el('#receive-name-wrap').hidden, c.el('#receive-update').hidden], [false, true]);
  c.el('#receive-name').value = 'alex';
  c.el('#receive-name').dispatchEvent({ type: 'input' });
  check('…typing their name (any case) offers to update their copy', [c.el('#receive-update').hidden, c.el('#receive-update').textContent], [false, 'Update Alex’s tracker']);
  c.el('#receive-update').click();
  check('Update switches to Alex and puts the new numbers in their copy', [c.people.active, hyattOf(store, `${KEY}:${alex.id}`), c.people.list.length], [alex.id, 70000, 2]);
  check('…your own tracker is byte-for-byte untouched', store.get(KEY), mine);
  const t = c.toast();
  check('…and it says so, with Undo', [t && t.message, t && typeof t.undo], ['Updated Alex’s tracker', 'function']);
  t.undo();
  check('Undo puts Alex’s copy back as it was, and still leaves yours alone', [hyattOf(store, `${KEY}:${alex.id}`), store.get(KEY)], [61200, mine]);
});

await group('receiving a link from someone named', async () => {
  const mine = JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors')));
  const sam = JSON.stringify(trackerData({ hyatt: 100 }, program('hyatt', 'World of Hyatt')));
  const store = device({ [KEY]: mine, [`${KEY}:usam`]: sam, [PEOPLE_KEY]: peopleList('me', ['me', ''], ['usam', 'Sam']) });
  const a = app(store);
  await open(a, sendLink('Sam', 900));
  check('a link that carries a name: no name box, and Update is offered when that person is here', [a.el('#receive-name-wrap').hidden,
    a.el('#receive-update').hidden, a.el('#receive-update').textContent], [true, false, 'Update Sam’s tracker']);
  a.el('#receive-person').click();
  check('Add as another person still adds them (keeping the link’s name)', [a.people.list.map((p) => p.name), store.get(`${KEY}:usam`)], [['', 'Sam', 'Sam'], sam]);
});

await group('two people with the same name', async () => {
  const store = device({ [KEY]: JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors'))),
    [`${KEY}:ua`]: JSON.stringify(trackerData({}, program('hyatt', 'World of Hyatt'))), [`${KEY}:ub`]: JSON.stringify(trackerData({}, program('hyatt', 'World of Hyatt'))),
    [PEOPLE_KEY]: peopleList('me', ['me', ''], ['ua', 'Alex'], ['ub', 'Alex']) });
  const a = app(store);
  await open(a, sendLink('Alex', 5));
  check('two people named Alex: no Update (it couldn’t know whose), only Add or Replace', a.el('#receive-update').hidden, true);
});

await group('the person showing has the link’s name', async () => {
  const store = device({ [KEY]: JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors'))),
    [`${KEY}:ua`]: JSON.stringify(trackerData({}, program('hyatt', 'World of Hyatt'))), [PEOPLE_KEY]: peopleList('ua', ['me', ''], ['ua', 'Alex']) });
  const a = app(store);
  await open(a, sendLink('Alex', 5));
  check('Alex is showing: Replace Alex’s tracker covers it, no second Update button', [a.el('#receive-update').hidden, a.el('#receive-replace').textContent],
    [true, 'Replace Alex’s tracker']);
});

await group('an unnamed link with an "Imported" person already here', async () => {
  const mom = JSON.stringify(trackerData({ hyatt: 11111 }, program('hyatt', 'World of Hyatt')));
  const mine = JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors')));
  const store = device({ [KEY]: mine, [`${KEY}:umom`]: mom, [PEOPLE_KEY]: peopleList('me', ['me', ''], ['umom', 'Imported']) });
  const a = app(store);
  await open(a, sendLink('', 99999));
  check('nothing typed yet: no Update (an unnamed link is never matched to someone by the fallback name)', a.el('#receive-update').hidden, true);
  a.el('#receive-name').value = 'imported';
  a.el('#receive-name').dispatchEvent({ type: 'input' });
  check('…not even when "imported" is typed: that name says nothing about whose link it is', a.el('#receive-update').hidden, true);
  a.el('#receive-name').value = '';
  a.el('#receive-name').dispatchEvent({ type: 'input' });
  a.el('#receive-person').click();
  check('Add as another person adds them; Mom’s copy and yours are untouched', [a.people.list.length, store.get(`${KEY}:umom`), store.get(KEY)], [3, mom, mine]);
});

await group('Update for someone whose copy a newer version saved', async () => {
  const sam = JSON.stringify({ ...trackerData({ hyatt: 22222 }, program('hyatt', 'World of Hyatt')), dataV: 999 });
  const mine = JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors')));
  const store = device({ [KEY]: mine, [`${KEY}:usam`]: sam, [PEOPLE_KEY]: peopleList('me', ['me', ''], ['usam', 'Sam']) });
  const a = app(store);
  const link = sendLink('Sam', 70000);
  await open(a, link);
  a.el('#receive-update').click();
  const t = a.toast();
  check('Update doesn’t switch or write: Sam’s and your copies are as they were', [a.people.active, store.get(`${KEY}:usam`), store.get(KEY)], ['me', sam, mine]);
  check('…it says to Reload, and the link goes back in the address so the updated app opens it again',
    [t && t.label, t && /newer version/.test(t.message), a.location.hash], ['Reload', true, link]);
});

await group('names in a different Unicode form', async () => {
  const nfc = '김민지'.normalize('NFC');
  const nfd = '김민지'.normalize('NFD');
  const store = device({ [KEY]: JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors'))),
    [`${KEY}:ukim`]: JSON.stringify(trackerData({ hyatt: 1 }, program('hyatt', 'World of Hyatt'))), [PEOPLE_KEY]: peopleList('me', ['me', ''], ['ukim', nfc]) });
  const a = app(store);
  await open(a, sendLink(nfd, 5));
  check('a link named 김민지 (decomposed) finds 김민지 here', [nfc === nfd, a.el('#receive-update').hidden], [false, false]);
  const b = app(store);
  await open(b, sendLink('', 5));
  b.el('#receive-name').value = ` ${nfd} `;
  b.el('#receive-name').dispatchEvent({ type: 'input' });
  check('…and so does typing it that way (with spaces around it)', b.el('#receive-update').hidden, false);
  b.el('#receive-person').click();
  check('…a person added from that name is saved in the composed form', b.people.list[b.people.list.length - 1].name, nfc);
});

/* ---------- 5. The example setup has Undo ---------- */

await group('example setup Undo', async () => {
  const store = device();
  const a = app(store);
  a.el('#setup-example').click();
  const t = a.toast();
  check('the example setup fills the tracker and offers Undo', [!!a.state.programs, store.has(KEY), t && t.label, t && t.undo && t.undo.snapshot],
    [true, true, 'Undo', true]);
  t.undo();
  check('…Undo goes back to the setup screen, with nothing saved (so a reload shows setup too)', [a.state.programs, store.has(KEY)], [null, false]);
});
await group('example setup Undo for a second person', async () => {
  const mine = JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors')));
  const store = device({ [KEY]: mine, [PEOPLE_KEY]: peopleList('ualex', ['me', ''], ['ualex', 'Alex']) });
  const a = app(store);
  a.el('#setup-example').click();
  check('Alex uses the example: saved under Alex', store.has(`${KEY}:ualex`), true);
  a.toast().undo();
  check('…Undo removes only Alex’s copy; yours is untouched', [store.has(`${KEY}:ualex`), store.get(KEY)], [false, mine]);
});

/* ---------- 6. A tracker arriving on a new device isn't "news" ---------- */

await group('news on a new device', async () => {
  const store = device();
  const a = app(store);
  await open(a, sendLink('', 5));
  check('a link opened on a brand-new device: "What’s new" is skipped', store.get(NEWS_KEY) != null, true);
  check('…and it still says it was copied', a.toasts, ['Tracker copied to this device']);
});
await group('news kept for someone else here', async () => {
  const store = device({ [KEY]: JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors'))), [PEOPLE_KEY]: peopleList('ualex', ['me', ''], ['ualex', 'Alex']) });
  const a = app(store);
  await open(a, sendLink('', 5));
  a.el('#receive-replace').click();
  check('someone else here already uses the app: the card stays for them', store.get(NEWS_KEY) ?? null, null);
});
await group('news untouched when replacing a set-up tracker', async () => {
  const store = device({ [KEY]: JSON.stringify(trackerData({}, program('hilton', 'Hilton Honors'))) });
  const a = app(store);
  await open(a, sendLink('', 5));
  a.el('#receive-replace').click();
  check('replacing a tracker that was set up: the card is left as it was', store.get(NEWS_KEY) ?? null, null);
});

/* ---------- 3. "United" in Add program ---------- */

await group('short names for known programs', async () => {
  const a = app(device());
  const ids = (...names) => names.map((n) => { const c = a.catalogLoose(n); return c && typeof c === 'object' ? c.id : c; });
  check('"United", "hyatt", "Bonvoy", "Delta", "Hilton" each name one known program',
    ids('United', 'hyatt', 'Bonvoy', 'Delta', 'Hilton'), ['united', 'hyatt', 'marriott', 'delta', 'hilton']);
  check('…as does "ANA" (the start of a word), while "Air", "Club", "Sky", "AA", "ua" and "nada" (mid-word, Air Canada) don’t pick one',
    ids('ANA', 'Air', 'Club', 'Sky', 'AA', 'ua', 'nada'), ['ana', null, null, null, null, null, null]);
});

function suggester(programs, editingId = null) {
  const els = {};
  const el = (sel) => els[sel] || (els[sel] = { sel, value: '', hidden: true, textContent: '', dataset: {}, on: {},
    addEventListener(type, fn) { (this.on[type] = this.on[type] || []).push(fn); },
    dispatchEvent(ev) { (this.on[ev.type] || []).forEach((fn) => fn(ev)); }, focus() {} });
  const ctx = vm.createContext({ el, Event: class { constructor(type) { this.type = type; } }, console, Math, Object, Array, Set, Map, RegExp, JSON, String });
  const catalogItems = piece('  const CATALOG_ITEMS', "  // A program's name with whose account it is");
  vm.runInContext(`
  const $ = el;
  const state = { programs: ${JSON.stringify(programs)} };
  let sheetId = ${JSON.stringify(editingId)};
  ${piece('  const CATALOG = [', '  const CATALOG_ITEMS')}
  ${catalogItems}
  const catalogFor = (p) => CATALOG_BY_ID[p.id] || catalogByName(p.name);
  const syncMedallionToggle = () => {};
  ${piece('  // Typed a short name for a known program', "  $('#p-name').addEventListener('input'")}
  globalThis.syncSuggest = syncSuggest;`, ctx);
  return { el, sync: ctx.syncSuggest };
}

await group('Add program suggests the full program', async () => {
  const s = suggester([program('hyatt', 'World of Hyatt')]);
  s.el('#p-name').value = 'United';
  s.sync();
  check('typing "United" offers United MileagePlus', [s.el('#p-suggest').hidden, s.el('#p-suggest').textContent],
    [false, 'Use United MileagePlus (with its levels and perks)']);
  s.el('#p-suggest').on.click[0]();
  check('…tapping it fills the full name and its balance type', [s.el('#p-name').value, s.el('#p-unit').value], ['United MileagePlus', 'miles']);
  s.el('#p-name').value = 'United MileagePlus';
  s.sync();
  check('…and the offer goes once the name is the full one', s.el('#p-suggest').hidden, true);
  s.el('#p-name').value = 'Hyatt';
  s.sync();
  check('"Hyatt" when World of Hyatt is already on the list: no offer (a deliberate second account)', s.el('#p-suggest').hidden, true);
});
await group('Edit a hand-made "United"', async () => {
  const s = suggester([{ id: 'pabc123', name: 'United', unit: 'points', status: [] }], 'pabc123');
  s.el('#p-name').value = 'United';
  s.sync();
  check('editing a hand-made "United": offered the full program', s.el('#p-suggest').hidden, false);
  const t = suggester([program('united', 'United MileagePlus')], 'united');
  t.el('#p-name').value = 'United';
  t.sync();
  check('…but renaming the real United MileagePlus to "United" offers nothing', t.el('#p-suggest').hidden, true);
});
check('the suggestion is checked when the sheet opens and as you type', [
  /syncMedallionToggle\(\);\n\s+syncSuggest\(\);\n\s+sheet\.showModal\(\);/.test(js),
  /\$\('#p-name'\)\.addEventListener\('input', \(\) => \{\n\s+syncMedallionToggle\(\);\n\s+syncSuggest\(\);/.test(js),
  /<input id="p-name"[^>]*>\s*<button class="link p-suggest" id="p-suggest" type="button" hidden><\/button>/.test(html),
], [true, true, true]);

/* ---------- 4. "Add balance" in a program's details ---------- */

function balanceButton(rowShown) {
  const calls = [];
  const on = {};
  const row = { getClientRects: () => (rowShown ? [{}] : []), scrollIntoView() { calls.push('scroll'); } };
  const ctx = vm.createContext({ CSS: { escape: (s) => s } });
  ctx.document = { querySelector: (sel) => (sel === '#programs [data-field="bal:hyatt"]' && rowShown !== null ? row : null) };
  ctx.detail = { addEventListener: (type, fn) => { on[type] = fn; } };
  ctx.detailProgram = () => ({ id: 'hyatt', name: 'World of Hyatt', unit: 'points' });
  ctx.closeDetail = () => calls.push('close');
  ctx.startEdit = (btn) => calls.push(btn === row ? 'edit row' : 'edit ?');
  ctx.openQuick = () => calls.push('type balances');
  vm.runInContext(piece('  // "Add balance" in a program\'s details', "  detail.addEventListener('close'"), ctx);
  const tap = (target) => on.click && on.click({ target: { closest: (sel) => (sel === '#d-bal' && target === 'bal' ? {} : null) } });
  return { calls, tap };
}
await group('Add balance from details', async () => {
  const shown = balanceButton(true);
  shown.tap('bal');
  check('Add balance closes the details and opens that row’s number', shown.calls, ['close', 'scroll', 'edit row']);
  const filtered = balanceButton(null);
  filtered.tap('bal');
  check('…with the row filtered out, it opens Type balances instead', filtered.calls, ['close', 'type balances']);
  const hidden = balanceButton(false);
  hidden.tap('bal');
  check('…and the same when the row isn’t on screen', hidden.calls, ['close', 'type balances']);
  const other = balanceButton(true);
  other.tap('elsewhere');
  check('other taps in the details are left alone', other.calls, []);
});
check('details show Add balance (or Change) for programs with a balance, never for status-only ones', [
  /if \(p\.unit\) \{\n\s+\$\('#d-sub'\)\.append\(' ', h\('button', \{ type: 'button', class: 'link d-bal', id: 'd-bal' \}, state\.balances\[p\.id\] == null \? 'Add balance' : 'Change'\)\);/.test(js),
], [true]);

/* ---------- 1. Setup screen layout ---------- */

const setupHtml = html.slice(html.indexOf('<section id="setup"'), html.indexOf('<section id="programs-section"'));
const actionsHtml = setupHtml.slice(setupHtml.indexOf('<div class="setup-actions">'));
check('the example and backup links sit near the top, right after Start from a screenshot', [
  setupHtml.indexOf('id="setup-example"') > setupHtml.indexOf('id="setup-scan"'),
  setupHtml.indexOf('id="setup-example"') < setupHtml.indexOf('class="setup-or"'),
  actionsHtml.includes('setup-example'),
], [true, true, false]);
const phoneBlock = (() => {
  const at = css.indexOf('Start stays on screen at the bottom while you pick');
  return at < 0 ? '' : css.slice(css.lastIndexOf('@media', at), css.indexOf('\n  }\n', at));
})();
check('on phones, upright or on their side, Start sticks to the bottom of the screen (the card clips, so it isn’t a scroll box that holds it)', [
  phoneBlock.startsWith('@media (max-width: 700px), (max-height: 500px) {'),
  /\.setup-card \{ overflow: clip; \}/.test(phoneBlock), /\.setup-actions \{[^}]*position: sticky; bottom: 0;/.test(phoneBlock),
], [true, true, true]);
check('Start and the receive sheet’s buttons are one full-width column (not .add’s own grid area)', [
  /\.setup-actions \.add \{ grid-area: auto; width: 100%; \}/.test(css), /\.receive-options \.add \{ grid-area: auto; \}/.test(css),
], [true, true]);
check('the program search hint fits a small phone', /id="program-search" type="search" placeholder="Search, e.g. Hyatt or Emirates"/.test(html), true);
check('the name box when receiving is 16px (no zoom on iPhone) and says what it’s for', [
  /<label class="d-label" for="receive-name">Whose tracker is this\?<\/label>\s*<input type="text" class="member-input name-input" id="receive-name" maxlength="30"/.test(html),
], [true]);

/* ---------- 7. Scan card wording ---------- */

check('the scan chooser’s button says what it does, not “Read it” (the screenshot was already read)', [
  js.includes("['Use this account', true, () => showLoot(read, select.value)]"), js.includes("['Use this program', true, () => {"), js.includes("'Read it'"),
], [true, true, false]);

/* ---------- 8. Credit card swatch ---------- */

check('the card swatch on Credits has a chip, so it reads as a card, not a tick box', [
  /\.cp-swatch \{ position: relative;/.test(css), /\.cp-swatch::after \{ content: '';[^}]*position: absolute;[^}]*linear-gradient\(135deg, #F1DFA6, #B9974F\)/.test(css),
], [true, true]);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
