// Checks Bilt's 2027 changes (from index.html) against a small fake page and a fake clock: Bilt Palladium's credits
// following each person's card anniversary (hotel credit ending, Anniversary Bilt Cash starting, "I kept 4% Bilt
// Cash"), the Jan 1, 2026 Bilt Cash lasting through Jan 31, 2027, the choice surviving saves, backups, links and
// people; the 2027 Bilt levels, Bilt Cash's expiry note, Copa transfers, the card picker's note and What's new; and
// marking the Palladium bonus earned (a targeted Undo, then an offer to add Bilt Gold).
// Usage: node tests/run-fixes-bilt-tests.mjs  — exits non-zero if any check fails.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(process.env.HTML_PATH || `${root}index.html`, 'utf8');
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
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

// A small DOM: elements with attributes, simple selectors ("#id", ".class", "tag", "[data-x]", "[data-x=\"y\"]" and
// descendants), events that bubble, focus, and a location and history the page's #credits route can use.
const fakeDom = `
  class El {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.listeners = []; this.attrs = {};
      this.hidden = false; this.className = ''; this.textContent = ''; this.dataset = {}; this.id = ''; this.value = ''; this.checked = false; this.disabled = false;
      this.style = { setProperty() {} };
      const cl = () => this.className.split(' ').filter(Boolean);
      this.classList = { add: (...n) => { this.className = [...new Set([...cl(), ...n])].join(' '); }, remove: (...n) => { this.className = cl().filter((c) => !n.includes(c)).join(' '); },
        toggle: (n, on) => { const has = cl().includes(n); if (on ?? !has) this.classList.add(n); else this.classList.remove(n); return on ?? !has; }, contains: (n) => cl().includes(n) };
    }
    setAttribute(k, v) {
      v = String(v); this.attrs[k] = v;
      if (k === 'id') this.id = v; if (k === 'class') this.className = v; if (k === 'checked') this.checked = true; if (k === 'disabled') this.disabled = true;
      if (k === 'value') this.value = v;
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = v;
    }
    getAttribute(k) { return k === 'id' ? (this.id || null) : k === 'class' ? this.className : (k in this.attrs ? this.attrs[k] : null); }
    removeAttribute(k) { delete this.attrs[k]; }
    append(...kids) { for (const k of kids) { if (k == null) continue; if (typeof k === 'string') { const t = new El('#text'); t.textContent = k; t.parentNode = this; this.children.push(t); continue; } if (k.parentNode) k.parentNode.children = k.parentNode.children.filter((c) => c !== k); k.parentNode = this; this.children.push(k); } }
    replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
    get parentElement() { return this.parentNode; }
    get isConnected() { for (let n = this; n; n = n.parentNode) if (n === body) return true; return false; }
    get text() { return this.tagName === '#TEXT' ? this.textContent : [this.textContent, ...this.children.map((c) => c.text)].join(''); }
    contains(el) { for (let n = el; n; n = n.parentNode) if (n === this) return true; return false; }
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }
    dispatch(type) { const e = { type, target: this, preventDefault() {} }; for (let n = this; n; n = n.parentNode) for (const l of [...n.listeners]) if (l.type === type) l.fn(e); }
    matches(sel) {
      if (this.tagName === '#TEXT') return false;
      if (sel.includes(',')) return sel.split(',').some((one) => this.matches(one.trim()));
      const m = /^([a-z]+)?((?:[#.][\\w-]+)*)((?:\\[[^\\]]+\\])*)$/i.exec(sel);
      if (!m) throw new Error('selector not supported here: ' + sel);
      if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
      for (const t of m[2].match(/[#.][\\w-]+/g) || []) if (t[0] === '#' ? this.id !== t.slice(1) : !this.classList.contains(t.slice(1))) return false;
      for (const a of m[3].match(/\\[[^\\]]+\\]/g) || []) {
        const [, name, want] = /^\\[([\\w-]+)(?:="(.*)")?\\]$/.exec(a);
        const got = this.getAttribute(name);
        if (got == null || (want !== undefined && got !== want)) return false;
      }
      return true;
    }
    closest(sel) { for (let n = this; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n; return null; }
    querySelectorAll(sel) {
      const parts = sel.trim().split(/\\s+(?![^\\[]*\\])/);
      let found = [this];
      for (const part of parts) {
        const next = [];
        for (const root of found) { const walk = (el) => { for (const c of el.children) { if (c.matches(part) && !next.includes(c)) next.push(c); walk(c); } }; walk(root); }
        found = next;
      }
      return found;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    focus() { document.activeElement = this; } blur() {} scrollIntoView() { shown.scrolled.push(this); }
    get offsetWidth() { return 0; }
    getBoundingClientRect() { return { top: 0 }; }
  }
  const body = new El('body');
  const shown = { toasts: [], scrolled: [], cardsOpened: 0, scrollTo: [] };
  const document = {
    body, title: 'Points & Status Tracker', activeElement: null, documentElement: new El('html'),
    createElement: (tag) => new El(tag),
    querySelector(sel) {
      const found = body.querySelector(sel);
      if (found || !/^#[\\w-]+$/.test(sel)) return found;
      const el = new El('div'); el.setAttribute('id', sel.slice(1)); body.append(el); return el; // anything else the app looks up
    },
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener() {},
  };
  const tracker = new El('main'); body.append(tracker);
  const page = new El('main'); page.setAttribute('id', 'credits-page'); page.hidden = true; body.append(page);
  const windowListeners = {};
  const addEventListener = (type, fn) => { (windowListeners[type] || (windowListeners[type] = [])).push(fn); };
  const fire = (type) => { for (const fn of windowListeners[type] || []) fn({ type }); };
  const location = { hash: '', pathname: '/', search: '' };
  const pages = [''];
  const history = {
    pushState(s, t, url) { pages.push(url); location.hash = url; },
    replaceState(s, t, url) { pages[pages.length - 1] = url.startsWith('#') ? url : ''; location.hash = url.startsWith('#') ? url : ''; },
    back() { pages.pop(); location.hash = pages[pages.length - 1] || ''; fire('popstate'); fire('hashchange'); },
  };
  let scrollY = 0;
  const scrollTo = (x, y) => { shown.scrollTo.push(y); scrollY = y; };
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {};
  const stored = new Map();
  const localStorage = { getItem: (k) => (stored.has(k) ? stored.get(k) : null), setItem: (k, v) => { stored.set(k, String(v)); }, removeItem: (k) => { stored.delete(k); }, key: () => null, length: 0 };
  const CSS = { escape: (s) => s };
  const setTimeout = () => 0; const clearTimeout = () => {};
  const requestAnimationFrame = (fn) => fn();
`;

let now = new Date(2026, 9, 31, 12); // Sat Oct 31, 2026
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now.getTime(); }
}
const ctx = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Error, Promise });
vm.runInContext(`${fakeDom}
  ${head}
  svgIcon = () => null; // no <template> here
  let state = normalize({ programs: [], cards: [] });
  let saves = 0;
  const showToast = (message, onUndo) => shown.toasts.push({ message, undo: onUndo || null });
  const scheduleSave = () => { saves++; }; const saveNow = () => {};
  const renderPrograms = () => {}; const renderCertSuggest = () => {};
  const bonusShort = () => null; const bonusProgress = () => null; const bonuses = () => ({}); const bonusBox = () => null;
  const openCards = () => { shown.cardsOpened++; };
  const jumpTo = (el) => { if (el) el.scrollIntoView(); };
  ${piece('  function parseISODate', '  function expiryLine')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  ${piece('  // The next time a card', '  const perksLine')}
  ${piece('  function renewalText', '  /* ---------- Welcome bonuses')}
  ${piece('  // Puts a card on your list', "  $('#cards-picker').addEventListener('click'")}
  ${piece('  const MONTH_NAMES', '  /* ---------- Certificates from your cards')}
  ${piece('  // One "Coming up" item as a line', '  // A plain-text summary meant for reading')}
  // The real Coming up (nothing but credits and fee dates in these trackers) and the real switch between people.
  const lineExpired = () => false; const mergedLines = () => []; const hasStatus = () => false; const dependsOn = () => '';
  const medallionProgram = () => null; const medallionFor = () => ({ current: null }); const effectiveMedallion = () => null;
  const backupDue = () => null; const renderBackupStatus = () => {}; const updateBadge = () => {};
  const openDetail = () => {}; const addAllToCalendar = () => {}; const backUp = () => {}; let bonusReturn = null;
  ${piece('  function statusItem', '  // Number on the home-screen icon')}
  ${piece("  $('#upcoming').addEventListener('click'", "  $('#cal-btn').addEventListener")}
  let saveTimer = 0; let editMode = false; let filter = 'all'; let planOpen = false; let planMqd = 0; let planSpend = 0; let intro = false; let renaming = null;
  const picked = new Set(); const pickedCards = new Set();
  const stopScanning = () => {}; const dropTyped = () => {}; const hideTrackerToast = () => { shown.toasts.length = 0; }; const showNote = () => {}; const renderPeople = () => {};
  const rollOver = () => false;
  const renderSafely = (prepare) => { if (prepare) prepare(); renderUpcoming(); renderCredits(); return true; };
  ${piece('  function switchPerson', '  function saveRename')}
  const detail = { open: false }; const renderDetail = () => {}; const renderVouchers = () => {}; const openFresh = (err) => { throw err; };
  ${piece('  function renderToday', '  function renderAll')}
  ${piece('  let drawnDay', '  // Just after each midnight')}
  globalThis.ui = { refreshDay, shown, stored, storageKey, people, switchPerson, renderUpcoming, removeCard, addHeldCard, creditRate, isoOf, cents, money, normalize, comingUpLine, document, setRenewal, forgetCreditParts: typeof forgetCreditParts !== 'undefined' ? forgetCreditParts : () => {},
    creditUseText: typeof creditUseText !== 'undefined' ? creditUseText : null, creditStatusText: typeof creditStatusText !== 'undefined' ? creditStatusText : null, heldCredits, creditBoxes, cardCreditDefs, creditsPageModel, setCreditBox, renderCredits, openCreditsPage, closeCreditsPage: () => { resetCreditsView(); },
    syncCreditsRoute, fire, page, tracker, location, body, CREDITS_PAGE_CARDS,
    getState: () => state, setState: (s) => { state = s; }, saves: () => saves };`, ctx);
const app = ctx.ui;
const { shown, page } = app;

const setup = (fields = {}) => { app.setState(app.normalize({ programs: [], ...fields })); shown.toasts.length = 0; };
const def = (cardId, id) => app.cardCreditDefs(cardId).find((c) => c.id === id);
const boxes = (cardId, id, year = now.getFullYear()) => app.creditBoxes(cardId, def(cardId, id), year);
const summary = (list) => list.map((b) => [b.key, b.short, b.phase, b.amount]);
const state = () => app.getState();
// The checklist is always on the first page: draw it and go to it.
const openPage = () => { app.renderCredits(); app.openCreditsPage(); };
const at = (y, m, d, h = 12, min = 0) => { now = new Date(y, m - 1, d, h, min); };
const pageBox = (key, period) => page.querySelector(`[data-cp-box="${key}"][data-cp-period="${period}"]`);
const tick = (key, period, on = true) => { const el = pageBox(key, period); if (!el) throw new Error(`no box ${key} ${period}`); el.checked = on; el.dispatch('change'); };
const open = (fields) => { setup(fields); app.closeCreditsPage(); app.location.hash = ''; openPage(); app.renderUpcoming(); app.renderCredits(); };
const rowOf = (key, past = false) => app.creditsPageModel({ past }).cards.flatMap((c) => c.rows).find((r) => r.key === key);
const heldOf = (key) => app.heldCredits().find((x) => x.key === key);
const comingUp = () => { app.renderUpcoming(); return app.document.querySelector('#upcoming').hidden ? [] : app.document.querySelector('#up-list').querySelectorAll('[data-credit-row]').map((b) => b.dataset.creditRow); };
const reload = () => app.setState(app.normalize(JSON.parse(JSON.stringify(state()))));
const BP = 'bilt-palladium';
const HOTEL = `${BP}:hotel`;
const CASH = `${BP}:bilt-cash`;
const ANNIV = `${BP}:anniversary-cash`;
const ends = (x) => x && [x.period.key, app.isoOf(x.period.end), x.left];
const keys = (list) => list.map((b) => [b.key, app.isoOf(b.end), b.counts]);
const panel = () => page.querySelector(`[data-cp-card="${BP}"] .cp-bilt`);
const keep4Box = () => page.querySelector(`[data-cp-keep4="${BP}"]`);

/* ---------- 1. Bilt Cash lasts 12 months: the Jan 1, 2026 $200 is good through Jan 31, 2027 ---------- */

at(2026, 12, 10);
open({ cards: [BP] });
check('Dec 10, 2026: the $200 Bilt Cash runs to Jan 31, 2027 (52 days), not Dec 31', [ends(heldOf(CASH)), heldOf(CASH).days], [['2026', '2027-01-31', 200], 52]);
check('…so Coming up doesn’t say to use it by Dec 31', comingUp().includes(CASH), false);
check('…and the note says so, with no Dec 31 in it', [/Jan 31, 2027/.test(def(BP, 'bilt-cash').note), /Dec 31/.test(def(BP, 'bilt-cash').note)], [true, false]);
at(2026, 12, 31);
check('Dec 31, 2026: still 31 days left, nothing ending today', [heldOf(CASH).days, comingUp().includes(CASH)], [31, false]);
at(2027, 1, 1);
check('Jan 1, 2027: no new $200 posts; the 2026 one is still on, 30 days left', ends(heldOf(CASH)), ['2026', '2027-01-31', 200]);
check('…the 2027 checklist has just that box, counted toward 2026 (so not this year’s total)', keys(boxes(BP, 'bilt-cash', 2027)), [['2026', '2027-01-31', false]]);
check('…it’s what’s available on it now', rowOf(CASH).left, 200);
at(2027, 1, 15);
check('Jan 15, 2027: in its last three weeks, it’s on Coming up', comingUp().includes(CASH), true);
at(2027, 2, 1);
check('Feb 1, 2027: gone from the main page', heldOf(CASH), undefined);
check('…and on the checklist it’s past, not missed (it counts toward 2026)', rowOf(CASH).boxes.map((b) => [b.phase, b.counts]), [['past', false]]);
at(2026, 11, 7);
open({ cards: [BP] });
check('2026’s checklist: one 2026 box, no phantom 2025 one carried in', keys(boxes(BP, 'bilt-cash', 2026)), [['2026', '2027-01-31', true]]);
check('…its rate doesn’t say “through Dec 31”', page.querySelector(`[data-cp-row="${CASH}"] small`).text.includes('through'), false);
tick(CASH, '2026');
check('ticking it on the checklist marks it used on the main page too', [state().creditsLog[CASH], heldOf(CASH).used, state().creditsUsed[CASH]], [{ 2026: true }, true, '2026']);

/* ---------- 2. With a fee date: the hotel credit ends at the first 2027 anniversary, $600 starts ---------- */

const FEE = { [BP]: '2026-03-10' };
at(2026, 11, 7);
open({ cards: [BP], renewals: FEE });
check('Nov 7, 2026 (fee date Mar 10): hotel credit for Jul–Dec as before, no $600 yet', [ends(heldOf(HOTEL)), heldOf(ANNIV)], [['2026-H2', '2026-12-31', 200], undefined]);
check('…the hotel note says when it ends and that what’s left then is lost', [/Mar 10, 2027/.test(heldOf(HOTEL).credit.note), /lost/.test(heldOf(HOTEL).credit.note)], [true, true]);
check('…the Bilt section says what changes on that day', [/From Mar 10, 2027/.test(panel().text), /\$600 Bilt Cash/.test(panel().text), /not used by Mar 9, 2027 is lost/.test(panel().text)], [true, true, true]);
check('…its annual fee date can be changed right there', !!page.querySelector(`[data-cp-renewal="${BP}"]`), true);
at(2027, 1, 15);
check('Jan 15, 2027: Jan–Jun’s hotel credit stops at Mar 9', [ends(heldOf(HOTEL)), heldOf(HOTEL).period.label], [['2027-H1', '2027-03-09', 200], 'Jan–Mar 9']);
at(2027, 2, 20);
check('Feb 20: its last three weeks, on Coming up', comingUp().includes(HOTEL), true);
at(2027, 3, 9);
check('Mar 9: last day for it', heldOf(HOTEL).days, 0);
at(2027, 3, 10);
check('Mar 10, 2027 (the anniversary): no hotel credit any more', heldOf(HOTEL), undefined);
check('…$600 Anniversary Bilt Cash for the card year', [ends(heldOf(ANNIV)), heldOf(ANNIV).credit.amount], [['A2027-03-10', '2028-03-31', 600], 600]);
check('…2027’s checklist: the hotel credit’s one box to Mar 9, the $600 from Mar 10, the 2026 Bilt Cash', [keys(boxes(BP, 'hotel', 2027)), keys(boxes(BP, 'anniversary-cash', 2027)), keys(boxes(BP, 'bilt-cash', 2027))],
  [[['2027-H1', '2027-03-09', true]], [['A2027-03-10', '2028-03-31', true]], [['2026', '2027-01-31', false]]]);
check('…the hotel row says “through Mar 9, 2027”', rowOf(HOTEL).last, '2027-03-09');
check('…2027’s total: $200 hotel + $600 Bilt Cash', app.creditsPageModel().cards.find((c) => c.card.id === BP).total, 800);
at(2027, 9, 1);
check('Sep 1, 2027: no Jul–Dec hotel credit, still the $600', [heldOf(HOTEL), ends(heldOf(ANNIV))], [undefined, ['A2027-03-10', '2028-03-31', 600]]);
at(2028, 2, 20);
check('Feb 20, 2028: the $600 from Mar 10, 2027 lasts to Mar 31, 2028 (Bilt Cash lasts 12 months), not Mar 9', [ends(heldOf(ANNIV)), heldOf(ANNIV).days], [['A2027-03-10', '2028-03-31', 600], 40]);
check('…so it isn’t on Coming up three weeks early', comingUp().includes(ANNIV), false);
check('…and the main page says when it’s good through, with no Mar 9 in it', [heldOf(ANNIV).period.label, /Mar 9/.test(heldOf(ANNIV).period.label + heldOf(ANNIV).credit.note)], ['card year from Mar 10, 2027, good through Mar 31, 2028', false]);
at(2028, 3, 15);
check('Mar 15, 2028 (the next $600 has posted): last year’s is still on the main page, it runs out first', ends(heldOf(ANNIV)), ['A2027-03-10', '2028-03-31', 600]);
check('…in its last three weeks, it’s on Coming up, to use by Mar 31', [comingUp().includes(ANNIV), /use by Mar 31, 2028/.test(app.document.querySelector('#up-list').text)], [true, true]);
check('…2028’s checklist has both: last year’s to Mar 31 (counted toward 2027) and this year’s', keys(boxes(BP, 'anniversary-cash', 2028)), [['A2027-03-10', '2028-03-31', false], ['A2028-03-10', '2029-03-31', true]]);
check('…the boxes show those dates', boxes(BP, 'anniversary-cash', 2028).map((b) => b.short), ['Mar 10, 2027 – Mar 31, 2028', 'Mar 10, 2028 – Mar 31, 2029']);
check('…and the checklist’s “now” is last year’s', rowOf(ANNIV).current.key, 'A2027-03-10');
app.renderCredits();
tick(ANNIV, 'A2027-03-10');
check('…ticking it marks it used on the main page too', [heldOf(ANNIV).period.key, heldOf(ANNIV).used, comingUp().includes(ANNIV)], ['A2027-03-10', true, false]);
at(2028, 4, 1);
check('Apr 1, 2028: last year’s has run out; this year’s, to Mar 31, 2029', ends(heldOf(ANNIV)), ['A2028-03-10', '2029-03-31', 600]);
at(2026, 11, 7);
check('2026’s checklist: no $600 box (it starts in 2027)', boxes(BP, 'anniversary-cash', 2026), []);
at(2027, 1, 20);
open({ cards: [BP], renewals: { [BP]: '2025-01-05' } });
check('A Jan 5 fee date: the hotel credit ended Jan 4, 2027; the $600 and the 2026 $200 are both on', [heldOf(HOTEL), ends(heldOf(ANNIV)), ends(heldOf(CASH))], [undefined, ['A2027-01-05', '2028-01-31', 600], ['2026', '2027-01-31', 200]]);
// The hotel credit's last stretch, when it ends in January: a day range, not "Jan–Jan 31".
at(2026, 11, 7);
open({ cards: [BP], renewals: { [BP]: '2026-02-01' } });
check('A Feb 1 fee date: 2027’s hotel credit box reads “Jan 1–31”', boxes(BP, 'hotel', 2027).map((b) => [b.key, b.short, b.long, app.isoOf(b.end)]), [['2027-H1', 'Jan 1–31', 'Jan 1–31', '2027-01-31']]);
at(2027, 1, 1);
check('…and on the main page on Jan 1, 2027', heldOf(HOTEL).period.label, 'Jan 1–31');
at(2026, 11, 7);
open({ cards: [BP], renewals: { [BP]: '2026-01-02' } });
check('A Jan 2 fee date: its one day reads “Jan 1”', boxes(BP, 'hotel', 2027).map((b) => [b.short, app.isoOf(b.end)]), [['Jan 1', '2027-01-01']]);
check('…a Mar 10 fee date still reads “Jan–Mar 9”', (open({ cards: [BP], renewals: FEE }), boxes(BP, 'hotel', 2027).map((b) => b.short)), ['Jan–Mar 9']);
// No opening date is kept, so a card opened in 2027 (fee date Mar 5, 2028) looks like an old one: the words say what to do.
at(2027, 4, 1);
open({ cards: [BP], renewals: { [BP]: '2028-03-05' } });
check('Opened in 2027: the Bilt section says 2027 cards get the $600 only, and to stop tracking the hotel credit', [/Opened this card in 2027\? You get the \$600 only/.test(panel().text), /stop tracking the hotel credit/.test(panel().text)], [true, true]);
check('…and so does the hotel credit’s note', /Opened this card in 2027\? You get the \$600 only/.test(def(BP, 'hotel').note), true);
check('…before they do, its Jan–Mar 4 shows as missed', app.creditsPageModel().cards.find((c) => c.card.id === BP).missed, 200);
page.querySelector(`[data-cp-skip="${HOTEL}"]`).dispatch('click');
check('…after ✕ on it: not counted, nothing missed, just the $600', (({ total, missed }) => [total, missed])(app.creditsPageModel().cards.find((c) => c.card.id === BP)), [600, 0]);

/* ---------- 3. "I kept 4% Bilt Cash" ---------- */

at(2026, 11, 7);
open({ cards: [BP], renewals: FEE });
check('the choice is a checkbox on the Bilt Palladium’s section, off to start, saying who can have it', [keep4Box().checked, /opened by Dec 31, 2026/.test(panel().text)], [false, true]);
keep4Box().checked = true;
keep4Box().dispatch('change');
check('ticked: stored for that card', state().creditsKeep4, { [BP]: true });
check('…the panel says the hotel credit stays, and to check the Bilt app', [/hotel credit each half-year stays/.test(panel().text), /Bilt app/.test(panel().text)], [true, true]);
at(2027, 9, 1);
app.renderCredits();
check('Sep 1, 2027: the hotel credit carries on (Jul–Dec)', ends(heldOf(HOTEL)), ['2027-H2', '2027-12-31', 200]);
check('…and Anniversary Bilt Cash is $200 from Mar 10', [ends(heldOf(ANNIV)), heldOf(ANNIV).credit.amount, /kept 4% Bilt Cash/.test(heldOf(ANNIV).credit.note)], [['A2027-03-10', '2028-03-31', 200], 200, true]);
reload();
check('…it survives a reload', [state().creditsKeep4, heldOf(HOTEL) && heldOf(HOTEL).period.key], [{ [BP]: true }, '2027-H2']);
at(2026, 11, 7);
open({ cards: [BP], renewals: FEE, creditsKeep4: { [BP]: true } });
keep4Box().checked = false;
keep4Box().dispatch('change');
check('unticked: gone, and the switch is back', [state().creditsKeep4, /From Mar 10, 2027/.test(panel().text)], [{}, true]);

/* ---------- 4. No fee date: today’s rows, and a plain ask for the date ---------- */

at(2027, 9, 1);
open({ cards: [BP] });
check('Sep 1, 2027 with no fee date: the hotel credit carries on, no Anniversary Bilt Cash', [ends(heldOf(HOTEL)), heldOf(ANNIV), rowOf(ANNIV)], [['2027-H2', '2027-12-31', 200], undefined, undefined]);
check('…the notes and the Bilt section ask for the annual fee date, and say 2027 cards get $600 only', [/add your annual fee date/.test(heldOf(HOTEL).credit.note), /Add your annual fee date/.test(panel().text), /Cards opened from Jan 1, 2027 get the \$600 only/.test(panel().text)], [true, true, true]);
check('…with the fee date box right there', !!page.querySelector(`[data-cp-renewal="${BP}"]`), true);
page.querySelector(`[data-cp-renewal="${BP}"]`).value = '2026-03-10';
page.querySelector(`[data-cp-renewal="${BP}"]`).dispatch('change');
check('…typing it in: the hotel credit is gone (it ended Mar 9) and the $600 is on', [heldOf(HOTEL), ends(heldOf(ANNIV))], [undefined, ['A2027-03-10', '2028-03-31', 600]]);

/* ---------- 5. The choice goes with saves, backups, links, second cards and each person ---------- */

const clean = (fields) => app.normalize(JSON.parse(JSON.stringify({ programs: [], cards: [BP], ...fields }))).creditsKeep4;
check('saved, backed up or sent by link (all read back through normalize): kept', clean({ creditsKeep4: { [BP]: true } }), { [BP]: true });
check('…a second Palladium’s own choice too', clean({ creditsKeep4: { [`${BP}~2`]: true } }), { [`${BP}~2`]: true });
check('…anything else is dropped: other cards, unknown cards, values that aren’t true', clean({ creditsKeep4: { 'amex-gold': true, 'no-such-card': true, [`${BP}~3`]: true, 'bilt-obsidian': true } }), {});
for (const junk of ['oops', 5, null, true, [], { [BP]: 'yes' }]) check(`…a damaged creditsKeep4 (${JSON.stringify(junk)}) is just empty`, clean({ creditsKeep4: junk }), {});
check('an old save without it: empty', clean({}), {});
at(2026, 11, 7);
const person = (id, fields) => app.stored.set(app.storageKey(id), JSON.stringify(app.normalize({ programs: [], ...fields })));
app.people.list.splice(0, app.people.list.length, { id: 'me', name: 'Sam Sample' }, { id: 'p2', name: 'Pat Example' });
person('me', { cards: [BP], renewals: FEE, creditsKeep4: { [BP]: true } });
person('p2', { cards: [BP], renewals: FEE });
app.setState(app.normalize(JSON.parse(app.stored.get(app.storageKey('me')))));
openPage();
check('Sam kept 4%', keep4Box().checked, true);
app.switchPerson('p2');
check('…Pat didn’t: their own choice', [keep4Box().checked, state().creditsKeep4], [false, {}]);
keep4Box().checked = true;
keep4Box().dispatch('change');
app.stored.set(app.storageKey('p2'), JSON.stringify(state())); // what saving Pat's tracker writes
app.switchPerson('me');
check('…Pat ticking it is theirs: Sam’s stays as it was', [state().creditsKeep4, keep4Box().checked], [{ [BP]: true }, true]);
app.switchPerson('p2');
check('…and back on Pat’s, ticked', [state().creditsKeep4, keep4Box().checked], [{ [BP]: true }, true]);
app.people.list.splice(0, app.people.list.length, { id: 'me', name: '' });
app.closeCreditsPage();

/* ---------- 6. The levels, expiry, transfers, card picker and What's new ---------- */

const dataCtx = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Error, Promise });
vm.runInContext(`${fakeDom}\n${head}
  globalThis.data = { BENEFITS, BENEFITS_2027, EXPIRY, CHECKED_ON, TRANSFERS, TRANSFERS_AS_OF, CATALOG_BY_ID, benefitsFor, programFromCatalog };`, dataCtx);
const { data } = dataCtx;
const levels = (table) => table.bilt.map((t) => [t.name, t.earn]);
check('Bilt in 2027: the same three levels, taking the same', levels(data.BENEFITS_2027), levels(data.BENEFITS));
const perks2027 = data.BENEFITS_2027.bilt.map((t) => t.perks.join(' | '));
check('…Silver and Gold: SIXT ONE Gold and Hertz Five Star, on request', [0, 1].map((i) => /Hertz Five Star and SIXT ONE Gold status match, when you ask/.test(perks2027[i])), [true, true]);
check('…Platinum: SIXT ONE Platinum and Hertz President’s Circle', /Hertz President’s Circle and SIXT ONE Platinum/.test(perks2027[2]), true);
check('…Gold and Platinum: Bilt Points on Home Away From Home; Silver not', perks2027.map((p) => /Home Away From Home/.test(p)), [false, true, true]);
check('…all of them: Bilt Cash hotel redemptions twice a year', perks2027.map((p) => /hotel stays twice a year/.test(p)), [true, true, true]);
check('…and they keep 2026’s perks (BLADE, Flying Blue Gold)', [/BLADE/.test(perks2027[1]), /Flying Blue Gold/.test(perks2027[2])], [true, true]);
check('today’s 2026 levels are unchanged (no 2027 perks yet)', data.BENEFITS.bilt.some((t) => /Hertz|SIXT|Home Away/.test(t.perks.join(' '))), false);
const biltProgram = data.programFromCatalog(data.CATALOG_BY_ID.bilt);
now = new Date(2026, 11, 31, 23, 59);
const lateDec = data.benefitsFor(biltProgram)[0].perks.join(' ');
now = new Date(2027, 0, 1, 0, 1);
check('the switch happens at midnight on Jan 1, 2027', [/SIXT/.test(lateDec), /SIXT/.test(data.benefitsFor(biltProgram)[0].perks.join(' '))], [false, true]);
check('Bilt points expiry note: Bilt Cash lasts 12 months', [data.EXPIRY.bilt.months, /Bilt Cash .*12 months/.test(data.EXPIRY.bilt.note)], [18, true]);
check('Bilt checked on Nov 7, 2026', data.CHECKED_ON.bilt, 'Nov 7, 2026');
const partner = (bank, id) => data.TRANSFERS[bank].partners.find((x) => x[0] === id);
check('Copa ConnectMiles: Citi 1:1, Capital One 2:1.5, as of November 2026', [partner('citi', 'Copa'), partner('capitalone', 'Copa'), data.TRANSFERS_AS_OF], [['Copa', 1, 1], ['Copa', 2, 1.5], 'November 2026']);
check('the card picker says the 4% Bilt Cash option is only for cards opened by Dec 31, 2026', /CARD_ISSUER_NOTES = \{ Bilt: 'The 4% Bilt Cash option is only for Bilt cards opened by Dec 31, 2026\.' \}/.test(html), true);
check('What’s new: an item on Bilt’s 2027 changes, and a new id so it shows again', [/<li><b>Bilt’s 2027 changes<\/b>:[^<]*Credits checklist/.test(html), /const NEWS_ID = '2026-11c'/.test(html)], [true, true]);

/* ---------- 7. Marking the Palladium bonus earned: a targeted Undo, then an offer of Bilt Gold ---------- */

const timers = [];
const bonusCtx = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Error, Promise, timers });
vm.runInContext(`${fakeDom.replace('const setTimeout = () => 0; const clearTimeout = () => {};', 'let timerId = 0; const setTimeout = (fn, ms) => { timers.push({ fn, ms, id: ++timerId }); return timerId; }; const clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };')}\n${head}
  let state = normalize({ programs: [], cards: [] });
  const toastEl = $('#toast');
  const toasts = [];
  const showToast = (message, action, label) => { toasts.push({ message, action, label }); toastEl.classList.add('show'); };
  let bonusEditing = null; const cardsSheet = { open: false };
  const saveNow = () => {}; const markChanged = () => {}; const renderAll = () => {}; const renderRenewals = () => {}; const focusBonus = () => {};
  const queueAchievements = () => {};
  const game = () => state.game; const levelOf = (xp) => ({ index: Math.floor(xp / 100) });
  const BADGES = [{ id: 'bonus', test: () => Object.values(state.bonuses).some((x) => x.landed) }];
  ${piece('  function parseISODate', '  function expiryLine')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  ${piece('  const daysLeft = ', '\n')}
  ${piece('  const lineExpired = ', '\n')}
  ${piece('  const bonuses = ', '\n')}
  ${piece('  const bonusFilled', '\n')}
  const BADGE_XP = 50;
  ${piece('  // The bonus posted: a', '  // A balance that just jumped')}
  globalThis.b = { markBonusEarned, toasts, toastEl, normalize, people, getState: () => state, setState: (s) => { state = s; } };`, bonusCtx);
const bz = bonusCtx.b;
const runTimers = () => { for (const t of timers.splice(0)) t.fn(); }; // what's due now (a wait sets up the next one)
const palladiumBonus = { points: 50000, program: 'bilt', spend: 4000, spent: 4000, by: '2026-12-31', landed: '' };
const tracker = (fields = {}) => { bz.setState(bz.normalize(JSON.parse(JSON.stringify({ programs: [{ id: 'bilt', name: 'Bilt Rewards', unit: 'points', status: [] }], cards: [BP], bonuses: { [BP]: palladiumBonus }, ...fields })))); bz.toasts.length = 0; timers.length = 0; bz.toastEl.classList.remove('show'); };
const bs = () => bz.getState();
const biltLines = () => bs().programs.find((p) => p.id === 'bilt').status.map((l) => [l.tier, l.via, l.exp]);

now = new Date(2026, 10, 7, 12);
tracker();
bz.markBonusEarned(BP);
check('marked earned: the date, and the usual toast with Undo', [bs().bonuses[BP].landed, bz.toasts[0].message, typeof bz.toasts[0].action], ['2026-11-07', 'Bilt Palladium bonus marked earned · +50 XP', 'function']);
bs().renewals['amex-platinum'] = '2026-08-01';
bs().balances.bilt = 51000;
bz.toasts[0].action();
check('Undo with other changes made since: just the bonus goes back, the fee date and balance stay', [bs().bonuses[BP].landed, bs().bonuses[BP].spent, bs().renewals['amex-platinum'], bs().balances.bilt], ['', 4000, '2026-08-01', 51000]);
bz.toastEl.classList.remove('show');
runTimers();
check('…and after that Undo, no Bilt Gold offer', bz.toasts.length, 1);

tracker({ game: { xp: 120, badges: {} } });
bz.markBonusEarned(BP);
check('the first bonus earns the badge and its XP', [!!bs().game.badges.bonus, bs().game.xp], [true, 170]);
bz.toasts[0].action();
check('…Undo takes back just that badge and XP', [bs().game.badges.bonus, bs().game.xp], [undefined, 120]);

tracker();
bz.markBonusEarned(BP);
runTimers();
check('while the Undo toast is up, the offer waits', [bz.toasts.length, timers.length], [1, 1]);
bz.toastEl.classList.remove('show');
runTimers();
check('once it’s gone: “Add Bilt Gold from your Palladium bonus?”, with Add', [bz.toasts[1].message, bz.toasts[1].label], ['Add Bilt Gold from your Palladium bonus?', 'Add']);
check('…nothing added until you tap it', biltLines(), []);
bz.toasts[1].action();
check('Add: Bilt Gold on Bilt Rewards, through the end of next year', biltLines(), [['Gold', 'Bilt Palladium welcome offer', '2027-12-31']]);
check('…and it says so', bz.toasts[2].message, 'Added Bilt Gold to Bilt Rewards, good through Dec 31, 2027');
bz.toasts[1].action();
check('…tapping Add twice doesn’t add it twice', biltLines().length, 1);

tracker();
bz.markBonusEarned(BP);
bz.toasts[0].action(); // Undo
bz.markBonusEarned(BP);
bz.toastEl.classList.remove('show');
runTimers();
check('marked earned, Undo, marked again: one Bilt Gold offer', bz.toasts.filter((t) => t.message === 'Add Bilt Gold from your Palladium bonus?').length, 1);
bz.toastEl.classList.remove('show'); // the offer goes by without a tap
runTimers();
runTimers();
check('…and once it goes by unanswered, it doesn’t come back', [bz.toasts.filter((t) => t.message === 'Add Bilt Gold from your Palladium bonus?').length, timers.length], [1, 0]);

for (const [name, status] of [['Gold', [{ tier: 'Gold', via: 'Rent' }]], ['Platinum', [{ tier: 'Platinum', via: 'Spend' }]]]) {
  tracker({ programs: [{ id: 'bilt', name: 'Bilt Rewards', unit: 'points', status }] });
  bz.markBonusEarned(BP);
  bz.toastEl.classList.remove('show');
  runTimers();
  check(`Bilt already shows ${name}: no offer`, bz.toasts.length, 1);
}
tracker({ programs: [{ id: 'bilt', name: 'Bilt Rewards', unit: 'points', status: [{ tier: 'Silver', via: 'Spend' }, { tier: 'Gold', via: 'Old', exp: '2025-12-31' }] }] });
bz.markBonusEarned(BP);
bz.toastEl.classList.remove('show');
runTimers();
check('Silver, or a Gold that has ended: offered', bz.toasts.at(-1).message, 'Add Bilt Gold from your Palladium bonus?');
tracker({ programs: [{ id: 'hyatt', name: 'World of Hyatt', unit: 'points', status: [] }] });
bz.markBonusEarned(BP);
bz.toastEl.classList.remove('show');
runTimers();
bz.toasts.at(-1).action();
check('no Bilt Rewards on the list: Add puts it on, with Gold', bs().programs.map((p) => [p.id, p.status.map((l) => l.tier)]).filter(([id]) => id === 'bilt'), [['bilt', ['Gold']]]);
tracker({ cards: ['amex-gold'], bonuses: { 'amex-gold': { points: 60000, program: 'amex', spend: 6000, spent: 6000, by: '2026-12-31', landed: '' } } });
bz.markBonusEarned('amex-gold');
bz.toastEl.classList.remove('show');
runTimers();
check('another card’s bonus: no Bilt Gold offer', bz.toasts.length, 1);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
