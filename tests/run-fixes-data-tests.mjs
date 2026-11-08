// Checks that saved data stays whole (from index.html): a status you typed stays yours after saving the program
// editor; deleting a program and adding it again before Undo never gives two programs the same id; the Undo for a
// restored backup or a copied tracker goes away after a later change (here or in another window); and an older copy
// of the app never trims and saves data written by a newer one (it asks to Reload), while data with no shape number
// reads as always.
// Usage: node tests/run-fixes-data-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
// From one line of the app up to the next given line (a piece that isn't there is left out).
const piece = (from, to) => { const at = js.indexOf(from); return at < 0 ? '' : js.slice(at, js.indexOf(to, at)); };
const dates = piece('  function parseISODate', '  function expiryLine');

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const attempt = (fn) => { try { return fn(); } catch (err) { return `threw: ${err.message}`; } };

/* ---------- The program editor, cards and deleting a program (a small fake page, as in the cards tests) ---------- */

const fakeDom = `
  class El {
    constructor(tag) { Object.assign(this, { tag, children: [], dataset: {}, className: '', value: '', defaultValue: '', hidden: false, checked: false, listeners: {}, content: { firstChild: null } }); }
    setAttribute(k, v) {
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = String(v);
      if (k === 'value') this.value = this.defaultValue = String(v);
    }
    append(...kids) { this.children.push(...kids); }
    replaceChildren(...kids) { this.children = kids; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    querySelectorAll(sel) {
      const out = [];
      const walk = (el) => { for (const c of el.children) if (c instanceof El) { if (c.className.split(' ').includes(sel.slice(1))) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    showModal() {} close() {} focus() {}
  }
  const els = {};
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: (sel) => els[sel] || (els[sel] = new El('div')), createElement: (tag) => new El(tag) };
`;
const editor = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${fakeDom}\n${head}\n${dates}
  let state = normalize({ programs: [], cards: [] });
  const sheet = $('#sheet');
  let sheetId = null;
  let expEditing = null;
  const game = () => state.game;
  // As on the page: the toast's button is the latest toast's, and tapping it hides the toast first.
  let undoAction = null;
  const showToast = (message, action) => { undoAction = action || null; };
  const scheduleSave = () => {}; const renderPrograms = () => {}; const renderDetailStatus = () => {}; const renderLevels = () => {};
  ${piece('  function mergedLines', '  const lineExpired')}
  ${piece('  function statusEditorRow', '  $(\'#p-name\').addEventListener')}
  ${piece('  $(\'#sheet-form\').addEventListener', '  /* ---------- Program detail sheet')}
  ${piece('  const lineExpired', '\n')}
  globalThis.ed = {
    normalize, applyCard, removeCard, openSheet, els,
    get state() { return state; }, set state(s) { state = s; },
    reload() { state = normalize(JSON.parse(JSON.stringify(state))); return state; },
    submit() { els['#sheet-form'].listeners.submit({ preventDefault() {} }); },
    deleteProgram() { els['#p-delete'].listeners.click(); },
    undoUp: () => !!undoAction,
    tapUndo() { const action = undoAction; undoAction = null; if (action) action(); },
    rows: () => els['#p-status'].children,
  };`, editor);
const { ed } = editor;
const prog = (id) => ed.state.programs.find((p) => p.id === id);
const lineView = (id) => (prog(id) ? prog(id).status.map((l) => [l.tier, l.via, l.card || null, l.typed || null]) : null);

// A status you typed, then a card that also gives it, then the editor saved without changes, then the card removed.
{
  ed.state = ed.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [{ tier: 'Gold', via: 'Amex Platinum' }] }], cards: [] });
  ed.applyCard(ed.state, 'amex-platinum');
  check('a typed status the card also gives: linked to the card and marked as yours', lineView('hilton'), [['Gold', 'Amex Platinum', 'amex-platinum', true]]);
  ed.openSheet('hilton');
  ed.submit();
  check('…saving the program editor without changes keeps it marked as yours', lineView('hilton'), [['Gold', 'Amex Platinum', 'amex-platinum', true]]);
  ed.reload();
  ed.removeCard(ed.state, 'amex-platinum');
  check('…so removing the card later keeps your status, no longer tied to the card', lineView('hilton'), [['Gold', 'Amex Platinum', null, null]]);
}
// A line only the card gave stays the card's after the editor, and still goes with the card.
{
  ed.state = ed.normalize({ programs: [], cards: [] });
  ed.applyCard(ed.state, 'amex-platinum');
  ed.openSheet('hilton');
  ed.submit();
  check('a status only the card gave: not marked as yours after the editor', lineView('hilton').map((l) => l[3]), [null]);
  ed.removeCard(ed.state, 'amex-platinum');
  check('…and it goes with the card', lineView('hilton'), null);
}

// Deleting Hilton, then adding "Hilton Honors" again while the delete's Undo is still up, then tapping Undo.
const hiltonSetup = () => {
  ed.state = ed.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] }, { id: 'marriott', name: 'Marriott Bonvoy', unit: 'points', status: [] }],
    cards: [], balances: { hilton: 120000, marriott: 50000 }, members: { hilton: '7770001112' } });
};
{
  hiltonSetup();
  ed.openSheet('hilton');
  ed.deleteProgram();
  check('deleting Hilton: gone, with Undo up', [ed.state.programs.map((p) => p.id), ed.undoUp()], [['marriott'], true]);
  ed.openSheet(null);
  ed.els['#p-name'].value = 'Hilton Honors';
  ed.els['#p-member'].value = '1112223334';
  ed.els['#p-status'].children[0].querySelector('.sl-tier').value = '';
  ed.submit();
  const added = ed.state.programs.find((p) => p.id !== 'marriott');
  check('…adding Hilton Honors again meanwhile gives it an id of its own', added.id !== 'hilton', true);
  ed.tapUndo();
  const ids = ed.state.programs.map((p) => p.id);
  check('…Undo: three programs, no id twice', [ids.length, new Set(ids).size], [3, 3]);
  check('…the old Hilton is back with its own balance and member number', [prog('hilton') && prog('hilton').name, ed.state.balances.hilton, ed.state.members.hilton],
    ['Hilton Honors', 120000, '7770001112']);
  check('…and the one added since keeps the member number typed for it', ed.state.members[added.id], '1112223334');
  check('…all three still there after a reload', ed.reload().programs.length, 3);
}
{
  // Once the Undo has gone, adding it again takes the usual id.
  hiltonSetup();
  ed.openSheet('hilton');
  ed.deleteProgram();
  vm.runInContext('undoAction = null;', editor); // the toast timed out
  ed.openSheet(null);
  ed.els['#p-name'].value = 'Hilton Honors';
  ed.els['#p-member'].value = '';
  ed.els['#p-status'].children[0].querySelector('.sl-tier').value = '';
  ed.submit();
  check('after the Undo has gone, Hilton Honors added again gets the usual id', ed.state.programs.map((p) => p.id), ['marriott', 'hilton']);
}
{
  // Added back another way under the same id (a card) while Undo is up: Undo brings the old one back as its own row.
  hiltonSetup();
  ed.openSheet('hilton');
  ed.deleteProgram();
  ed.applyCard(ed.state, 'amex-platinum');
  check('Hilton deleted, then a card adds Hilton again under its usual id', !!prog('hilton'), true);
  ed.tapUndo();
  const hiltons = ed.state.programs.filter((p) => p.name === 'Hilton Honors');
  const old = hiltons.find((p) => p.id !== 'hilton');
  check('…Undo: two Hilton rows, never the same id', [hiltons.length, new Set(ed.state.programs.map((p) => p.id)).size === ed.state.programs.length], [2, true]);
  check('…the old one keeps its balance and member number under its new id', old ? [ed.state.balances[old.id], ed.state.members[old.id]] : null, [120000, '7770001112']);
  check('…and the card’s Hilton has none of them', [ed.state.balances.hilton, ed.state.members.hilton], [undefined, undefined]);
}

/* ---------- Saving, other windows, backups and links (real storage, a faked page) ---------- */

const KEY = 'status-tracker-v2';
const device = (entries = {}) => new Map(Object.entries(entries));

function app(store, globals = {}) {
  const context = vm.createContext({ console: { error() {}, log: console.log }, Intl, Math, Date, Number, String, Object,
    Array, Set, Map, RegExp, JSON, Promise, Uint8Array, TextEncoder, TextDecoder, atob, btoa, Blob, Response,
    CompressionStream, DecompressionStream, store, ...globals });
  vm.runInContext(`
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }, key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
  };
  const els = {};
  const el = (sel) => els[sel] || (els[sel] = { sel, hidden: false, textContent: '', open: false, opened: 0, listeners: {},
    showModal() { this.open = true; this.opened++; }, close() { this.open = false; }, addEventListener(type, fn) { this.listeners[type] = fn; },
    replaceChildren() {}, setAttribute() {}, focus() {}, select() {}, click() {} });

  const document = { documentElement: { classList: { contains: () => false } }, // no site password showing
    querySelector: el, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ setAttribute() {}, append() {}, content: { firstChild: null } }) };
  const listeners = {};
  const addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {};
  const location = { hash: '', pathname: '/', search: '', origin: 'https://example.test', reloads: 0, reload() { this.reloads++; } };
  const history = { replaceState() { location.hash = ''; } };
  let pending = null; // the save waiting on its timer
  const setTimeout = (fn) => { pending = fn; return 1; };
  const clearTimeout = () => {};
  ${head}
  ${dates}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  const state = load();
  let saveTimer = 0;
  let editMode = false; let filter = 'all'; let intro = false; let renaming = null;
  const detail = { open: false }; const detailProgram = () => null; const sheet = { open: false }; let sheetId = null;
  const toasts = [];
  let undoAction = null;
  const showToast = (message, onUndo) => { toasts.push(message); undoAction = onUndo || null; };
  const hideToast = () => { undoAction = null; };
  const hideTrackerToast = hideToast; const showNote = showToast;
  const stopScanning = () => {}; const dropTyped = () => {}; const forgetCreditParts = () => {}; const resetCreditsView = () => {}; const rollOver = () => false;
  const renderAll = () => {}; const renderStats = () => {}; const renderWorth = () => {}; const renderHousehold = () => {}; const renderPeople = () => {};
  let file = null; let files = 0; const saveFile = async (name, text) => { file = text; files++; return true; }; const fileTag = () => '';
  ${piece('  // Something in the tracker changed: dated for the backup nudge', '  // Flush a pending save')}
  ${piece('  // The tracker on screen was replaced', '  // Opening flourish')}
  ${piece('  async function backUp', "  $('#export-btn')")}
  ${piece("  $('#import-file').addEventListener", '  // Swaps in another tracker')}
  ${piece('  // Swaps in another tracker', '  /* ---------- Send to another device')}
  ${piece('  const toB64url', '  const sendSheet')}
  ${piece('  const sendSheet', "  $('#send-share').addEventListener")}
  ${piece('  // Opening a link made above', "  $('#receive-replace').addEventListener")}
  ${piece('  // Reload for the new-version toast', '  // A closed sheet is hidden')}
  let planOpen = false; let planMqd = 0; let planSpend = 0; const picked = new Set(); const pickedCards = new Set(); const scrollTo = () => {};
  ${piece('  function renderSafely', '  // Also for a rollover')}
  ${piece("  // Shows someone else's tracker", '  function saveRename')}
  globalThis.api = { state, toasts, location, listeners, el, store, KEY, normalize, scheduleSave, saveNow, replaceTracker, backUp, trackerLink, receiveFromLink, switchPerson,
    flush() { const fn = pending; pending = null; if (fn) fn(); },
    undo: () => undoAction, tapUndo() { const a = undoAction; undoAction = null; if (a) a(); },
    get file() { return file; }, get files() { return files; },
    send: () => el('#send-btn').listeners.click(), get sendOpened() { return el('#send-sheet').opened; } };`, context);
  return context.api;
}

const tracker = (extra = {}) => ({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] }], balances: { hilton: 1000 }, cards: [], ...extra });
const storedBalance = (store) => JSON.parse(store.get(KEY)).balances.hilton;
const lastToast = (a) => a.toasts[a.toasts.length - 1] || '';

// Data with no shape number (everything saved so far) reads and saves as always, now with the number.
{
  const store = device({ [KEY]: JSON.stringify(tracker()) });
  const a = app(store);
  check('saved data with no shape number: read as always', [a.state.programs.map((p) => p.id), a.state.balances.hilton], [['hilton'], 1000]);
  a.state.balances.hilton = 2000;
  a.scheduleSave();
  a.flush();
  const saved = JSON.parse(store.get(KEY));
  check('…and saved, with the shape number written', [saved.balances.hilton, saved.dataV], [2000, 1]);
  check('…which reading leaves out of the tracker itself', 'dataV' in a.normalize(saved), false);
  const junk = app(device({ [KEY]: JSON.stringify(tracker({ dataV: 'abc' })) }));
  junk.state.balances.hilton = 3;
  junk.saveNow();
  check('a shape number that isn’t a number: read and saved as usual', [junk.state.programs.length, junk.toasts], [1, []]);
}

// An older copy of the app opening data a newer version saved: shown, never saved over, asks to Reload.
{
  const newer = JSON.stringify(tracker({ dataV: 99, cardCopies: { 'amex-platinum': ['Alex Rivera'] }, laterField: { kept: true } }));
  const store = device({ [KEY]: newer });
  const a = app(store);
  check('data saved by a newer version: this older copy still shows it (no setup screen)', [a.state.programs && a.state.programs.length, a.state.balances.hilton], [1, 1000]);
  a.state.balances.hilton = 5;
  a.scheduleSave();
  a.flush();
  check('…an edit here never saves over it: the newer copy stays untouched', store.get(KEY), newer);
  check('…and it says to Reload, with the Reload button', [/newer version/.test(lastToast(a)), /Reload/.test(lastToast(a)), a.undo() && a.undo().name], [true, true, 'reloadForUpdate']);
  // Review finding: shown again after an edit, 'Reload so your changes save' read as if that edit would be kept.
  check('…the note after an edit says changes here aren’t kept (never that they’ll save after Reload)',
    [/changes save/i.test(lastToast(a)), /Changes here can’t be saved/.test(lastToast(a))], [false, true]);
  a.tapUndo();
  check('…Reload reloads the page', a.location.reloads, 1);
  check('…restoring a backup here doesn’t save over it either', [attempt(() => (a.replaceTracker(a.normalize(tracker({ balances: { hilton: 7 } })), 'Backup restored'), 'ok')), store.get(KEY)], ['ok', newer]);
}

// People on this device: one tracker saved by a newer version blocks saving only that tracker, and says so on arrival.
{
  const PEOPLE = 'status-tracker-people';
  const bea = JSON.stringify(tracker({ dataV: 2, balances: { hilton: 777 } }));
  const store = device({ [PEOPLE]: JSON.stringify({ active: 'me', list: [{ id: 'me', name: 'Alex' }, { id: 'b', name: 'Bea' }] }),
    [KEY]: JSON.stringify(tracker()), [`${KEY}:b`]: bea });
  const a = app(store);
  check('two people, Alex showing with no shape number: no Reload message', /newer version/.test(lastToast(a)), false);
  a.switchPerson('b');
  check('…switching to Bea, whose tracker a newer version saved: shown, and it says to Reload', [a.state.balances.hilton, /newer version/.test(lastToast(a)), a.undo() && a.undo().name],
    [777, true, 'reloadForUpdate']);
  a.switchPerson('me');
  a.state.vouchers.push({ id: 'v1', name: 'Free night', exp: '2027-01-01' });
  a.scheduleSave();
  a.flush();
  const alex = JSON.parse(store.get(KEY));
  check('…back to Alex (no shape number): an edit is saved, with the number', [(alex.vouchers || []).length, alex.dataV], [1, 1]);
  check('…with no Reload message for Alex', /newer version/.test(lastToast(a)), false);
  check('…and Bea’s tracker is still left as the newer version saved it', store.get(`${KEY}:b`), bea);
}
{
  // Opening the app on Bea, then switching to Alex: Alex's edits save.
  const PEOPLE = 'status-tracker-people';
  const store = device({ [PEOPLE]: JSON.stringify({ active: 'b', list: [{ id: 'me', name: 'Alex' }, { id: 'b', name: 'Bea' }] }),
    [KEY]: JSON.stringify(tracker()), [`${KEY}:b`]: JSON.stringify(tracker({ dataV: 2 })) });
  const a = app(store);
  a.switchPerson('me');
  a.state.balances.hilton = 4321;
  a.scheduleSave();
  a.flush();
  check('opened on Bea (newer version’s data), then switched to Alex: Alex’s edit is saved', [storedBalance(store), JSON.parse(store.get(KEY)).dataV], [4321, 1]);
}

// Another window running a newer version saves: this older window stops saving and asks to Reload.
{
  const store = device({ [KEY]: JSON.stringify(tracker()) });
  const a = app(store);
  const newer = JSON.stringify(tracker({ dataV: 99, balances: { hilton: 4242 }, laterField: [1, 2] }));
  store.set(KEY, newer);
  a.listeners.storage.forEach((fn) => fn({ key: KEY, newValue: newer }));
  check('a newer window’s save: this window shows it', a.state.balances.hilton, 4242);
  check('…and asks to Reload', /newer version/.test(lastToast(a)), true);
  a.state.balances.hilton = 1;
  a.scheduleSave();
  a.flush();
  check('…an edit here afterwards never writes the trimmed copy back', store.get(KEY), newer);
}

// The Undo for a restored backup or a copied tracker puts the whole tracker back, so a later change hides it.
{
  const store = device({ [KEY]: JSON.stringify(tracker()) });
  const a = app(store);
  a.replaceTracker(a.normalize(tracker({ balances: { hilton: 555 } })), 'Backup restored');
  check('restoring a backup: Undo is up', [lastToast(a), !!a.undo()], ['Backup restored', true]);
  a.state.vouchers.push({ id: 'v1', name: 'Free night', exp: '2027-01-01' });
  a.scheduleSave();
  a.flush();
  check('…a change made afterwards hides that Undo, so it can’t wipe the change', a.undo(), null);
  check('…and the change is saved', JSON.parse(store.get(KEY)).vouchers.length, 1);
}
{
  const store = device({ [KEY]: JSON.stringify(tracker()) });
  const a = app(store);
  a.replaceTracker(a.normalize(tracker({ balances: { hilton: 555 } })), 'Tracker copied to this device');
  const other = JSON.stringify({ ...JSON.parse(store.get(KEY)), vouchers: [{ id: 'v2', name: 'Lounge pass', exp: '2027-02-01' }], dataV: 1 });
  store.set(KEY, other);
  a.listeners.storage.forEach((fn) => fn({ key: KEY, newValue: other }));
  check('copied tracker, then another window saves a change: this window’s Undo goes', a.undo(), null);
  check('…and that window’s change is shown here', a.state.vouchers.length, 1);
}

// Backups and send links carry the shape number; a newer one is never trimmed in.
{
  const a = app(device({ [KEY]: JSON.stringify(tracker()) }));
  await a.backUp();
  check('a backup file carries the shape number', JSON.parse(a.file).data.dataV, 1);
  const link = await a.trackerLink();
  const b = app(device());
  b.location.hash = link.slice(link.indexOf('#'));
  await b.receiveFromLink();
  check('a send link carries it, and opens on a device with nothing set up', [b.toasts, b.state.balances.hilton], [['Tracker copied to this device'], 1000]);
}
{
  const store = device({ [KEY]: JSON.stringify(tracker()) });
  const a = app(store);
  const before = store.get(KEY);
  const file = { text: async () => JSON.stringify({ app: 'points-status-tracker', data: tracker({ dataV: 99, balances: { hilton: 9 } }) }) };
  await a.el('#import-file').listeners.change({ target: { files: [file], value: 'x' } });
  check('restoring a backup from a newer version: nothing replaced, it asks to Reload', [store.get(KEY) === before, a.state.balances.hilton, /newer version/.test(lastToast(a)), a.undo() && a.undo().name],
    [true, 1000, true, 'reloadForUpdate']);
  const old = { text: async () => JSON.stringify({ app: 'points-status-tracker', data: tracker({ balances: { hilton: 8 } }) }) };
  await a.el('#import-file').listeners.change({ target: { files: [old], value: 'x' } });
  check('…a backup with no shape number restores as always', [a.state.balances.hilton, lastToast(a)], [8, 'Backup restored']);
}
{
  const linkFor = (payload) => `#import=j${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  const newerLink = linkFor({ app: 'points-status-tracker', v: 1, name: 'Mom', data: tracker({ dataV: 99 }) });
  const b = app(device());
  b.location.hash = newerLink;
  await b.receiveFromLink();
  check('opening a link from a newer version: nothing copied in, it asks to Reload', [b.state.programs, /newer version/.test(lastToast(b)), b.undo() && b.undo().name],
    [null, true, 'reloadForUpdate']);
  check('…and the link stays in the address bar, so the updated app opens it', b.location.hash, newerLink);
  const c = app(device());
  c.location.hash = linkFor({ app: 'points-status-tracker', v: 1, name: 'Mom', data: tracker() });
  await c.receiveFromLink();
  check('…a link with no shape number opens as always (and leaves the address bar)', [c.toasts, c.location.hash], [['Tracker copied to this device'], '']);
}

// An older copy showing a newer version's data can't pass on a cut-down copy: Back up and Send a link ask to Reload.
{
  const newer = JSON.stringify(tracker({ dataV: 99, laterField: { kept: true } }));
  const store = device({ [KEY]: newer });
  const a = app(store);
  await a.backUp();
  check('data saved by a newer version: Back up makes no file', a.files, 0);
  check('…it says to Reload for the newest version first, with the Reload button',
    [/Reload/.test(lastToast(a)), /newest version/.test(lastToast(a)), /back up/i.test(lastToast(a)), a.undo() && a.undo().name], [true, true, true, 'reloadForUpdate']);
  check('…and the tracker isn’t marked as backed up (nor saved over)', [a.state.backedUp || '', store.get(KEY)], ['', newer]);
  await a.send();
  check('…Send a link: no link is made and its sheet doesn’t open', a.sendOpened, 0);
  check('…it says to Reload first, with the Reload button', [/Reload/.test(lastToast(a)), /newest version/.test(lastToast(a)), /link/i.test(lastToast(a)), a.undo() && a.undo().name],
    [true, true, true, 'reloadForUpdate']);
  a.tapUndo();
  check('…Reload reloads the page', a.location.reloads, 1);
}
{
  // Not stale: Back up and Send a link work as always.
  const a = app(device({ [KEY]: JSON.stringify(tracker()) }));
  await a.backUp();
  check('data this version saved: Back up makes its file, with no Reload message', [a.files, /Reload/.test(lastToast(a))], [1, false]);
  await a.send();
  check('…and Send a link opens its sheet', a.sendOpened, 1);
}
{
  // Two people: Bea's tracker is a newer version's, Alex's isn't. Only Bea's exports wait for Reload.
  const PEOPLE = 'status-tracker-people';
  const store = device({ [PEOPLE]: JSON.stringify({ active: 'b', list: [{ id: 'me', name: 'Alex' }, { id: 'b', name: 'Bea' }] }),
    [KEY]: JSON.stringify(tracker()), [`${KEY}:b`]: JSON.stringify(tracker({ dataV: 2 })) });
  const a = app(store);
  await a.backUp();
  check('two people, Bea (newer version’s data) showing: no backup file', a.files, 0);
  a.switchPerson('me');
  await a.backUp();
  await a.send();
  check('…switched to Alex: Back up and Send a link work for Alex', [a.files, a.sendOpened, JSON.parse(a.file).data.balances.hilton], [1, 1, 1000]);
}

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
