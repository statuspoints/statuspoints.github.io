// Checks (from index.html, against a small fake page) that with the site password showing, a send link and a dropped
// or pasted screenshot wait behind it instead of opening a sheet nobody can see, then open once it's given; and that the "A new version is
// ready" Reload offer comes back after another toast covers it, or when the app is resumed after it timed out.
// Made-up names only. Usage: node tests/run-fixes-safety-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
// From one line of the app up to the next given line.
const piece = (from, to) => { const at = js.indexOf(from); if (at < 0) throw new Error(`not found: ${from}`); return js.slice(at, js.indexOf(to, at)); };
// The lock helpers, when there are any (before the fix there are none, and the checks below fail).
const lockHelpers = js.includes('  const siteLocked') ? piece('  const siteLocked', '  async function receiveFromLink') : '';

let total = 0, failed = 0;
const check = (name, got, want) => { total++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`); };
const settle = () => new Promise((r) => setImmediate(r));

// The page's <html>: its classes, and MutationObservers watching them.
const makeRoot = (locked) => {
  const classes = new Set(locked ? ['site-locked'] : []);
  const observers = new Set();
  const notify = () => { for (const o of [...observers]) o.fn([{ type: 'attributes', attributeName: 'class' }]); };
  const documentElement = { classList: { contains: (c) => classes.has(c), add: (c) => { classes.add(c); notify(); }, remove: (c) => { classes.delete(c); notify(); } } };
  class MutationObserver {
    constructor(fn) { this.fn = fn; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  return { documentElement, MutationObserver, observers };
};
const el = () => ({ textContent: '', hidden: false, classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } } });

/* ---------- 1. A send link opened while the site password is showing ---------- */

const LINK = '#import=jeyJhcHAiOiJwb2ludHMifQ';
const receivePage = ({ locked, setUp = true, people = 2 }) => {
  const r = makeRoot(locked);
  const els = {};
  const got = { modal: 0, replaced: 0, toasts: [] };
  const location = { hash: LINK, pathname: '/', search: '' };
  const ctx = vm.createContext({
    MutationObserver: r.MutationObserver, location, Promise, Object, DecompressionStream: class {},
    document: { documentElement: r.documentElement },
    history: { replaceState: (a, b, url) => { location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } },
    $: (sel) => (sel === '#receive-sheet' ? { showModal: () => { got.modal++; }, close() {} } : (els[sel] || (els[sel] = el()))),
    readTrackerLink: async () => ({ name: 'Robin Test', data: { programs: [{ id: 'delta' }], cards: [], updated: {} } }),
    people: { list: Array.from({ length: people }, (_, i) => ({ id: `p${i}` })) },
    state: { programs: setUp ? [] : null },
    replaceTracker: () => { got.replaced++; },
    showToast: (m) => got.toasts.push(m),
    parseISODate: () => null, plural: (n, w) => `${n} ${w}`, whose: () => 'Robin’s', activePerson: () => ({}),
    dateFmt: { format: String },
  });
  vm.runInContext(piece("  const receiveSheet = $('#receive-sheet');", "  $('#receive-replace').addEventListener"), ctx);
  return { ctx, got, location, r };
};

{
  const p = receivePage({ locked: true });
  p.ctx.receiveFromLink();
  await settle();
  check('locked, set-up device: the link’s sheet doesn’t open behind the password', p.got.modal, 0);
  check('…and the link is still in the address (a reload keeps it)', p.location.hash, LINK);
  p.r.documentElement.classList.remove('site-locked');
  await settle(); await settle();
  check('the right password given: the link’s sheet opens as usual', p.got.modal, 1);
  check('…and only then leaves the address', p.location.hash, '');
  check('…nothing left watching the page', p.r.observers.size, 0);
}
{
  const p = receivePage({ locked: true, setUp: false, people: 1 });
  p.ctx.receiveFromLink();
  await settle();
  check('locked, empty device: the link’s tracker isn’t copied in unseen', [p.got.replaced, p.location.hash], [0, LINK]);
  p.r.documentElement.classList.remove('site-locked');
  await settle(); await settle();
  check('…copied once the password is given', p.got.replaced, 1);
}
{
  const p = receivePage({ locked: false });
  p.ctx.receiveFromLink();
  await settle(); await settle();
  check('no password showing: the link opens straight away, as before', [p.got.modal, p.location.hash], [1, '']);
}

/* ---------- 2. A screenshot dropped or pasted while the site password is showing ---------- */

const shot = (name) => [{ type: 'image/png', name }];
const dropPage = (locked) => {
  const r = makeRoot(locked);
  const els = {};
  const handlers = {};
  const got = { scans: 0, scanned: [], toasts: [] };
  const ctx = vm.createContext({
    MutationObserver: r.MutationObserver, Promise,
    document: { documentElement: r.documentElement },
    $: (sel) => els[sel] || (els[sel] = el()),
    addEventListener: (type, fn) => { handlers[type] = fn; },
    setTimeout: () => 0, clearTimeout: () => {}, innerWidth: 1440, innerHeight: 900,
    otherSheetOpen: () => false, scanSheet: { open: false }, play: { open: false },
    scanFiles: (list) => { const images = [...list].filter((f) => /^image\//.test(f.type)); if (!images.length) return false; got.scans++; got.scanned.push(images.map((f) => f.name)); return true; },
    showToast: (m) => got.toasts.push(m),
  });
  vm.runInContext(`${lockHelpers}\n${piece('  const imageIn', "  $('#scan-cancel')")}`, ctx);
  const ev = (extra) => { const e = { prevented: false, preventDefault() { this.prevented = true; }, ...extra }; return e; };
  return {
    got, r, gateMsg: () => (els['#gate-msg'] || el()).textContent,
    dragover: (files = shot('a.png')) => { const e = ev({ dataTransfer: { types: ['Files'], files, dropEffect: '' } }); handlers.dragover(e); return [e.prevented, e.dataTransfer.dropEffect, els['#drop-hint'].hidden]; },
    drop: (files = shot('a.png')) => { const e = ev({ dataTransfer: { types: ['Files'], files } }); handlers.drop(e); return e.prevented; },
    paste: (files = shot('b.png')) => { const e = ev({ clipboardData: { files } }); handlers.paste(e); return e.prevented; },
  };
};

{
  const p = dropPage(true);
  check('locked: dragging a screenshot over the page takes the drop (but shows no hint over the password box)', p.dragover(), [true, 'copy', true]);
  check('locked: a dropped screenshot doesn’t open the scan behind the password (and the browser doesn’t open the picture)', [p.drop(shot('drop.png')), p.got.scans, p.got.toasts], [true, 0, []]);
  check('…the password box says it will open once you’re in', p.gateMsg(), 'Your screenshot will open once you’re in.');
  check('locked: a pasted screenshot doesn’t open the scan either', [p.paste(shot('paste.png')), p.got.scans], [true, 0]);
  check('…and the box counts both', p.gateMsg(), 'Your 2 screenshots will open once you’re in.');
  check('…one wait on the page, not one per screenshot', p.r.observers.size, 1);
  p.r.documentElement.classList.remove('site-locked');
  await settle();
  check('the password given: both waiting screenshots are read, in one go', [p.got.scans, p.got.scanned], [1, [['drop.png', 'paste.png']]]);
  check('…nothing left watching the page', p.r.observers.size, 0);
  check('after that: a dropped screenshot is read as usual', [p.drop(shot('c.png')), p.got.scans], [true, 2]);
  check('…and a pasted one', [p.paste(shot('d.png')), p.got.scans], [true, 3]);
  await settle();
  check('…and the earlier ones aren’t read again', p.got.scanned.length, 3);
}
{
  const p = dropPage(true);
  p.drop([{ type: 'application/pdf', name: 'x.pdf' }]);
  check('locked: a file that isn’t a picture is turned away on the password box', [p.gateMsg(), p.r.observers.size], ['That isn’t a picture — drop a screenshot (PNG or JPG)', 0]);
  p.r.documentElement.classList.remove('site-locked');
  await settle();
  check('…and nothing opens once the password is given', p.got.scans, 0);
}
{
  const p = dropPage(false);
  check('no password showing: dragging offers the drop, as before', p.dragover(), [true, 'copy', false]);
}

/* ---------- 3. The "A new version is ready" Reload offer ---------- */

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

const updatePage = () => {
  const els = {};
  const docListeners = {};
  const body = { append() {} };
  const button = () => ({ ...el(), listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, focus() {} });
  const $ = (sel) => els[sel] || (els[sel] = sel === '#toast-undo' || sel === '#toast' ? button() : el());
  $('#toast').parentNode = body;
  let swMessage = null;
  const doc = { visibilityState: 'visible', body, activeElement: null, querySelector: () => null, addEventListener: (t, f) => { docListeners[t] = f; } };
  const ctx = vm.createContext({
    $, document: doc, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, Math, Date: { now: () => now },
    saveTimer: 0, saveNow() {}, refreshDay() {}, fetch: () => Promise.resolve(), reloads: 0,
    location: { reload() { ctx.reloads++; } },
    navigator: { serviceWorker: { controller: null, addEventListener: (t, f) => { swMessage = f; } } },
  });
  vm.runInContext([
    piece('  let checkedAt = Date.now();', '  /* ---------- Editable numbers'),
    piece('  let toastTimer = 0;', '  /* ---------- People on this device'),
    js.slice(js.indexOf("    navigator.serviceWorker.addEventListener('message'"), js.lastIndexOf('\n  }\n})();')),
  ].join('\n'), ctx);
  const toast = () => ({ msg: $('#toast-msg').textContent, show: $('#toast').classList.contains('show'), button: $('#toast-undo').hidden ? null : $('#toast-undo').textContent });
  const resume = () => { doc.visibilityState = 'hidden'; docListeners.visibilitychange(); doc.visibilityState = 'visible'; docListeners.visibilitychange(); };
  return { ctx, toast, resume, updated: () => swMessage({ data: { type: 'updated' } }), click: () => $('#toast-undo').listeners.click() };
};

const OFFER = { msg: 'A new version is ready', show: true, button: 'Reload' };
{
  const p = updatePage();
  p.updated();
  check('a new version fetched: Reload offered', p.toast(), OFFER);
  vm.runInContext('showToast("That isn’t a picture — drop a screenshot (PNG or JPG)")', p.ctx);
  check('another toast covers it for now', p.toast().msg, 'That isn’t a picture — drop a screenshot (PNG or JPG)');
  advance(5000);
  check('…and when that one goes, the Reload offer comes back', p.toast(), OFFER);
  advance(15000);
  check('left alone, it goes after a while', p.toast().show, false);
  p.resume();
  check('the app resumed later: Reload offered again', p.toast(), OFFER);
  advance(15000);
  vm.runInContext('showToast("Balance changed", () => {})', p.ctx);
  p.resume();
  check('resumed while an Undo is up: the Undo stays', [p.toast().msg, p.toast().button], ['Balance changed', 'Undo']);
  p.click();
  check('…and the Reload offer comes after it', p.toast(), OFFER);
  p.click();
  check('Reload reloads the page', p.ctx.reloads, 1);
}
{
  const p = updatePage();
  p.resume();
  check('no new version: resuming offers nothing', p.toast().show, false);
  vm.runInContext('showToast("Saved")', p.ctx);
  advance(5000);
  check('…and a toast going brings nothing up', p.toast().show, false);
}

// The Reload toasts about this tracker or a file being from a newer version aren't the new-version offer: covering
// one never brings up "A new version is ready" when none is waiting, and one covering the offer lets it come back.
const STALE = 'Changes here can’t be saved. Reload to get the newer version';
if (js.includes('  function warnStaleCopy')) {
  {
    const p = updatePage();
    vm.runInContext('warnStaleCopy()', p.ctx);
    check('no new version: the “can’t be saved” note offers Reload', p.toast(), { msg: STALE, show: true, button: 'Reload' });
    vm.runInContext('showToast("Saved")', p.ctx);
    advance(5000);
    check('…another toast covers it: no “new version is ready” afterwards', p.toast().show, false);
    vm.runInContext('showToast("That link is from a newer version. Reload to open it", reloadForUpdate, "Reload", 15000)', p.ctx);
    vm.runInContext('showToast("Saved")', p.ctx);
    advance(5000);
    check('…nor after one covers the newer-link note', p.toast().show, false);
    vm.runInContext('warnStaleCopy()', p.ctx);
    p.resume();
    check('…and resuming with the note up offers nothing new', p.toast().msg, STALE);
  }
  {
    const p = updatePage();
    p.updated();
    vm.runInContext('warnStaleCopy()', p.ctx);
    check('a new version waiting, then the “can’t be saved” note covers it', p.toast().msg, STALE);
    vm.runInContext('hideTrackerToast()', p.ctx);
    check('…switching to another person hides the note, and the Reload offer comes back', p.toast(), OFFER);
  }
}

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
