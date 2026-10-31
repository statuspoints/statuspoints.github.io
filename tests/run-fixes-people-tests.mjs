// Checks people and saved-data handling (from index.html) against a small fake app with real storage: switching to
// someone whose data breaks the page (and saying it was kept aside), opening a tracker link, two windows sharing the
// people list, the "What's new" card on a new setup, and setting aside data this version can't read.
// Usage: node tests/run-fixes-people-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// Everything up to `const state = load();` (constants, normalize, people, load), the date helpers, and the UI
// pieces under test (from a line up to the next given line; a piece that isn't there is left out).
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => { const at = js.indexOf(from); return at < 0 ? '' : js.slice(at, js.indexOf(to, at)); };
const dates = piece('  function parseISODate', '  function daysUntil');
const today = piece('  function isoOf', '  // Phones: hand the file');

const KEY = 'status-tracker-v2';
const PEOPLE_KEY = 'status-tracker-people';
const NEWS_KEY = 'status-tracker-news';
const STASH = 'status-tracker-unreadable:';

// Browser storage for one device, shared by every "window" (app) made on it.
const device = (entries = {}) => new Map(Object.entries(entries));

// One window of the app on that device. Rendering is faked: it records what's shown, and fails on a program named
// "Breaks the page" (saved data that gets through normalize() but can't be shown).
function app(store, globals = {}) {
  const context = vm.createContext({ console: { error() {}, log: console.log }, Intl, Math, Date, Number, String, Object,
    Array, Set, Map, RegExp, JSON, Promise, Uint8Array, setTimeout, clearTimeout, TextEncoder, TextDecoder, atob, btoa, Blob, Response, ...globals });
  vm.runInContext(`
  const store = globalThis.store;
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }, key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
  };
  const els = {};
  const el = (sel) => els[sel] || (els[sel] = { sel, hidden: false, textContent: '', open: false, opened: 0,
    drawn: 0, showModal() { this.open = true; this.opened++; }, close() { this.open = false; }, addEventListener() {},
    replaceChildren() { this.drawn++; }, setAttribute() {}, focus() {}, select() {} });
  el('#receive-replace').textContent = 'Replace the tracker on this device'; // as the page has it
  const docListeners = {};
  const document = { querySelector: el, querySelectorAll: () => [], visibilityState: 'visible',
    addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
    createElement: () => ({ setAttribute() {}, append() {}, content: { firstChild: null } }) };
  const listeners = {};
  const addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {};
  const window = globalThis;
  const location = { hash: '', pathname: '/', search: '', origin: 'https://example.test' };
  const history = { replaceState() { location.hash = ''; } };
  ${head}
  ${dates}
  ${today}
  const state = load();
  const shown = [];
  const toasts = [];
  const replaced = [];
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
  const stopScanning = () => {};
  const forgetCreditParts = () => {}; // the Credits page's memory of a part-used amount
  const hideToast = () => {}; const hideTrackerToast = () => {};
  const scrollTo = () => {};
  const rollOver = () => (globalThis.rollOverHook ? globalThis.rollOverHook(state) : false);
  const renderToday = () => {};
  const renderCredits = () => {};
  const renderVouchers = () => {};
  const showToast = (message) => toasts.push(message);
  const showNote = showToast;
  const replaceTracker = (next, message) => { replaced.push({ next, message }); Object.assign(state, next); };
  const renderWorth = () => {};
  function renderAll() {
    shown.push(state.programs ? state.programs.map((p) => p.name) : 'setup');
    if (state.programs && state.programs.some((p) => p.name === 'Breaks the page')) throw new Error('render failed');
  }
  ${piece('  // The tracker on screen was replaced', '  // Opening flourish')}
  ${piece('  // Another tab or window saved this tracker', '  /* ---------- Editable numbers')}
  ${piece('  const toB64url', '  const sendSheet')}
  ${piece('  // Opening a link made above', "  $('#receive-replace').addEventListener")}
  ${piece("  const peopleSheet = $('#people-sheet');", '  function openPeople')}
  ${piece("  // Shows someone else's tracker", '  function saveRename')}
  ${piece('  // A one-time card listing new features', '  /* ---------- Install hint')}
  ${piece('  function finishSetup', "  $('#catalog')")}
  globalThis.api = { state, people, shown, toasts, replaced, el, location, listeners, docListeners, document, savePeople, switchPerson, receiveFromLink,
    finishSetup, load, storageKey, rename: (id) => { renaming = id; } };`, Object.assign(context, { store }));
  return context.api;
}

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const attempt = (fn) => { try { fn(); return 'ok'; } catch (err) { return `threw: ${err.message}`; } };

const program = (name, id = name.toLowerCase().replace(/\W+/g, '-')) => ({ id, name, unit: 'points', status: [] });
const tracker = (...names) => JSON.stringify({ programs: names.map((n) => program(n)), balances: {}, cards: [] });
const peopleList = (active, ...list) => JSON.stringify({ active, list: list.map(([id, name]) => ({ id, name })) });
const stashes = (store) => [...store.entries()].filter(([k]) => k.startsWith(STASH)).map(([, v]) => v).sort();

// Switching to someone whose saved data breaks the page: set it aside and open their setup, never leave the
// previous person's rows on screen under the new name.
{
  const bad = tracker('Breaks the page');
  const store = device({ [KEY]: tracker('Hilton Honors'), [`${KEY}:ubad`]: bad, [PEOPLE_KEY]: peopleList('me', ['me', ''], ['ubad', 'Kim']) });
  const a = app(store);
  check('switching to someone whose data breaks the page doesn’t throw', attempt(() => a.switchPerson('ubad')), 'ok');
  check('…their tracker opens fresh (setup), not the previous rows', [a.state.programs, a.shown[a.shown.length - 1]], [null, 'setup']);
  check('…and their data is kept aside untouched', store.get(`${STASH}${KEY}:ubad`), bad);
  check('…and the first person’s data is left alone', store.get(KEY), tracker('Hilton Honors'));
  check('…and it says their saved tracker was kept aside, not that they’re new', a.toasts,
    ['Couldn’t show Kim’s saved tracker — it’s kept aside on this device, not deleted']);
}

// Another window saved data for this tracker that breaks the page: the same.
{
  const store = device({ [KEY]: tracker('Hilton Honors') });
  const a = app(store);
  const bad = tracker('Breaks the page');
  store.set(KEY, bad);
  const fire = () => a.listeners.storage.forEach((fn) => fn({ key: KEY, newValue: bad }));
  check('another window’s data that breaks the page doesn’t throw here', attempt(fire), 'ok');
  check('…this window shows setup and keeps that data aside', [a.state.programs, store.get(`${STASH}${KEY}`)], [null, bad]);
  check('…and says so', a.toasts, ['Couldn’t show your saved tracker — it’s kept aside on this device, not deleted']);
}

// Coming back to the app as a new qualifying year starts, and rolling the year over fails partway: the saved data
// is set aside and the tracker opens fresh, rather than the half-changed copy being left to save over it.
{
  const saved = JSON.stringify({ ...JSON.parse(tracker('Hilton Honors')), progress: { 'hilton-honors': 40 } });
  const store = device({ [KEY]: saved });
  const rollOverHook = (state) => { delete state.progress['hilton-honors']; throw new Error('rollover failed'); };
  const a = app(store, { rollOverHook });
  const back = () => a.docListeners.visibilitychange.forEach((fn) => fn());
  check('a rollover that fails on return to the app doesn’t throw', attempt(back), 'ok');
  check('…this window shows setup and keeps the saved data aside, untouched', [a.state.programs, a.shown[a.shown.length - 1],
    store.get(`${STASH}${KEY}`)], [null, 'setup', saved]);
  check('…and says so', a.toasts, ['Couldn’t show your saved tracker — it’s kept aside on this device, not deleted']);
}

// Opening a link while a newly added person (not set up yet) is showing and someone else is set up: ask first.
const linkFor = (payload) => `#import=j${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const momLink = linkFor({ app: 'points-status-tracker', v: 1, name: 'Mom', data: JSON.parse(tracker('Marriott Bonvoy')) });
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [PEOPLE_KEY]: peopleList('ualex', ['me', ''], ['ualex', 'Alex']) });
  const a = app(store);
  a.location.hash = momLink;
  await a.receiveFromLink();
  check('a link opened while Alex (not set up) shows, with Me set up: asks rather than filing Mom’s data as Alex’s',
    [a.replaced.length, a.el('#receive-sheet').opened], [0, 1]);
  check('…and Replace says whose tracker it replaces', a.el('#receive-replace').textContent, 'Replace Alex’s tracker');
}
{
  // Two people, neither set up yet: Mom's tracker isn't filed under Alex's name without asking either.
  const a = app(device({ [PEOPLE_KEY]: peopleList('ualex', ['me', ''], ['ualex', 'Alex']) }));
  a.location.hash = momLink;
  await a.receiveFromLink();
  check('a link opened while Alex shows, nobody set up but two people on the device: asks first',
    [a.replaced.length, a.el('#receive-sheet').opened, a.el('#receive-replace').textContent], [0, 1, 'Replace Alex’s tracker']);
}
{
  const a = app(device());
  a.location.hash = momLink;
  await a.receiveFromLink();
  check('nothing set up on the device: the link’s tracker is copied in right away', [a.replaced.map((r) => r.message), a.el('#receive-sheet').opened],
    [['Tracker copied to this device'], 0]);
}
{
  const a = app(device({ [KEY]: tracker('Hilton Honors') }));
  a.location.hash = momLink;
  await a.receiveFromLink();
  check('one person, set up: Replace keeps its plain label', [a.el('#receive-sheet').opened, a.el('#receive-replace').textContent],
    [1, 'Replace the tracker on this device']);
}

// A browser with DecompressionStream that can't do 'deflate-raw' (Chromium 80–102): "too old", not "cut off".
{
  class DecompressionStream { constructor(format) { if (format !== 'gzip' && format !== 'deflate') throw new TypeError('Unsupported format'); } }
  const a = app(device(), { DecompressionStream });
  a.location.hash = '#import=zq1YqyEksSs3NS8kvT8nPzw';
  await a.receiveFromLink();
  check('a compressed link on a browser without deflate-raw: says the browser is too old', a.toasts,
    ['This browser is too old to open that link — update it, or use a backup file']);
}

// Two windows: a person added in one isn't dropped when the other saves the list.
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [PEOPLE_KEY]: peopleList('me', ['me', '']) });
  const two = app(store); // the second window, opened before Alex was added
  const added = peopleList('ualex', ['me', ''], ['ualex', 'Alex']);
  store.set(PEOPLE_KEY, added); // the first window adds Alex (not set up yet, so no data saved for them)
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: added }));
  two.savePeople(); // e.g. renaming someone in the second window
  const saved = JSON.parse(store.get(PEOPLE_KEY));
  check('the other window’s new person survives this window saving the list', saved.list.map((p) => [p.id, p.name]), [['me', ''], ['ualex', 'Alex']]);
  check('…this window keeps showing who it was showing', two.people.active, 'me');
  check('…and the header here shows Alex is on the device', [two.el('#person-chip').hidden, two.el('#people-btn-label').textContent],
    [false, 'People on this device (2)']);
  const removed = peopleList('me', ['me', '']);
  store.set(PEOPLE_KEY, removed); // the first window removes Alex again
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: removed }));
  two.savePeople();
  check('…and someone removed there isn’t brought back by this window', JSON.parse(store.get(PEOPLE_KEY)).list.map((p) => p.id), ['me']);
}
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [`${KEY}:ualex`]: tracker('Marriott Bonvoy'), [PEOPLE_KEY]: peopleList('ualex', ['me', ''], ['ualex', 'Alex']) });
  const two = app(store); // showing Alex
  const removed = peopleList('me', ['me', '']);
  store.set(PEOPLE_KEY, removed); // the other window removes Alex
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: removed }));
  check('the person this window is showing stays on its list, even if removed elsewhere', two.people.list.map((p) => p.id), ['me', 'ualex']);
}

// A rename left open when the People sheet was closed doesn't stop the header following another window's list.
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [PEOPLE_KEY]: peopleList('me', ['me', '']) });
  const two = app(store);
  two.rename('me'); // tapped the pencil, then closed the sheet without saving
  const added = peopleList('ualex', ['me', ''], ['ualex', 'Alex']);
  store.set(PEOPLE_KEY, added);
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: added }));
  check('a rename left open with the sheet closed: the header still shows the new person', [two.el('#person-chip').hidden,
    two.el('#people-btn-label').textContent], [false, 'People on this device (2)']);
}
// Mid-rename with the sheet open: the header follows, the list (with what's being typed) is left alone.
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [PEOPLE_KEY]: peopleList('me', ['me', '']) });
  const two = app(store);
  two.el('#people-sheet').open = true;
  two.rename('me');
  const drawn = two.el('#people-list').drawn;
  const added = peopleList('ualex', ['me', ''], ['ualex', 'Alex']);
  store.set(PEOPLE_KEY, added);
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: added }));
  check('mid-rename, another window adds someone: the header follows, the list being typed in isn’t redrawn',
    [two.el('#people-btn-label').textContent, two.el('#people-list').drawn - drawn], ['People on this device (2)', 0]);
  const renamed = peopleList('ualex', ['me', ''], ['ualex', 'Al']);
  two.rename(null); // saved or cancelled
  store.set(PEOPLE_KEY, renamed);
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: renamed }));
  check('…and once the rename is done, the open list is redrawn too', two.el('#people-list').drawn - drawn, 1);
}
// Mid-rename, another window removes someone whose row is still on this window's list; tapping it doesn't switch to
// a person who's gone (which broke the page until a reload).
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [`${KEY}:ux`]: tracker('Hyatt'), [`${KEY}:uy`]: tracker('Marriott Bonvoy'),
    [PEOPLE_KEY]: peopleList('me', ['me', ''], ['ux', 'Xavi'], ['uy', 'Yan']) });
  const two = app(store);
  two.el('#people-sheet').open = true;
  two.rename('ux');
  const removed = peopleList('me', ['me', ''], ['ux', 'Xavi']);
  store.set(PEOPLE_KEY, removed); // the other window removes Yan (and their tracker)
  store.delete(`${KEY}:uy`);
  two.listeners.storage.forEach((fn) => fn({ key: PEOPLE_KEY, newValue: removed }));
  const drawn = two.el('#people-list').drawn;
  check('tapping the leftover row of someone removed elsewhere doesn’t throw', attempt(() => two.switchPerson('uy')), 'ok');
  check('…this window keeps showing who it was, and the saved list still names them', [two.people.active, (two.state.programs || []).map((p) => p.name),
    JSON.parse(store.get(PEOPLE_KEY)).active], ['me', ['Hilton Honors'], 'me']);
  check('…and the list is redrawn without them', [two.el('#people-list').drawn - drawn, two.toasts[two.toasts.length - 1]],
    [1, 'That person was removed in another window']);
}

// "What's new": setting up a new person doesn't dismiss it for someone else who already uses the app.
const setup = { programs: [program('Hyatt')], cards: [], notes: '' };
{
  const store = device({ [KEY]: tracker('Hilton Honors'), [PEOPLE_KEY]: peopleList('ukim', ['me', ''], ['ukim', 'Kim']) });
  const a = app(store);
  a.finishSetup(setup);
  check('setting up Kim leaves the card for Me, who hasn’t seen it', store.get(NEWS_KEY) ?? null, null);
}
{
  const store = device();
  const a = app(store);
  a.finishSetup(setup);
  check('the first tracker on a device skips the card', store.get(NEWS_KEY) != null, true);
}

// Data this version can't read: every different unreadable copy is kept, not just the first.
{
  const store = device({ [KEY]: '{ first bad copy' });
  app(store);
  store.set(KEY, '{ second bad copy'); // set up again; that later breaks too
  app(store);
  check('a second unreadable copy is kept alongside the first', stashes(store), ['{ first bad copy', '{ second bad copy']);
  app(store);
  check('…and opening again with the same copy doesn’t add another', stashes(store).length, 2);
}
// Another window keeps saving data this window can't show: copies stop piling up, keeping the first and the newest.
{
  const store = device({ [KEY]: tracker('Hilton Honors') });
  const a = app(store);
  for (let i = 1; i <= 12; i++) {
    const bad = JSON.stringify({ programs: [program('Breaks the page')], notes: `save ${i}` });
    store.set(KEY, bad);
    a.listeners.storage.forEach((fn) => fn({ key: KEY, newValue: bad }));
  }
  const kept = [...store.keys()].filter((k) => k.startsWith(STASH)).map((k) => JSON.parse(store.get(k)).notes);
  check('twelve saves that break the page here keep at most 5 copies', kept.length, 5);
  check('…the first copy and the newest ones', [kept.includes('save 1'), kept.includes('save 12'), kept.includes('save 2')], [true, true, false]);
}
{
  const store = device({ [KEY]: '{ broken', [`${KEY}:ukim`]: tracker('Hyatt'), [PEOPLE_KEY]: peopleList('me', ['me', ''], ['ukim', 'Kim']) });
  const a = app(store);
  check('a stash is never mistaken for a person', [a.people.list.map((p) => p.id), stashes(store)], [['me', 'ukim'], ['{ broken']]);
}

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
