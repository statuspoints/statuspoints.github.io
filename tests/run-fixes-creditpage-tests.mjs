// Checks the Credits page (from index.html, opened at #credits) against a small fake page and a fake clock: a box
// per month, quarter, half or year of each credit, ticking and unticking them (this period and past ones), partial
// amounts, the totals at the top, the record kept in creditsLog and how it agrees with the main page's "Mark used",
// old saved data, backups, a new year, skipped and added credits, the "Add your cards" chips, and (section 17) the
// page as time passes: rollovers, people, damaged files, and a fuzz that every total agrees, in several time zones.
// Usage: node tests/run-fixes-creditpage-tests.mjs  — exits non-zero if any check fails.
import { spawnSync } from 'node:child_process';
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
  const lineExpired = () => false; const mergedLines = () => []; const hasStatus = () => false; const entryOnly = () => false; const dependsOn = () => '';
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
let startedOn = null;
{
  setup({ cards: ['amex-gold'] });
  app.renderCredits();
  startedOn = page.querySelector('[data-cp-filter="all"]').getAttribute('aria-pressed');
}

// 1. The boxes for each kind of credit
setup({ cards: ['amex-platinum', 'sapphire-reserve'] });
const uber = boxes('amex-platinum', 'uber');
check('monthly: 12 boxes, Jan–Dec, keyed as creditPeriod keys them', uber.map((b) => b.key), ['2026-1', '2026-2', '2026-3', '2026-4', '2026-5', '2026-6', '2026-7', '2026-8', '2026-9', '2026-10', '2026-11', '2026-12']);
check('…short labels', uber.map((b) => b.short).join(' '), 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec');
check('…Jan–Sep past, October now (its last day), Nov–Dec not yet', uber.map((b) => b.phase[0]).join(''), 'pppppppppcff');
check('…October: 0 days left, editable; December: $35 and not editable', [uber[9].days, uber[9].editable, uber[11].amount, uber[11].editable, uber[0].amount], [0, true, 35, false, 15]);
check('…a past month is still editable (used it and forgot to tick)', uber[2].editable, true);
check('quarterly: Q1–Q4, Q4 now with 61 days left', [summary(boxes('amex-platinum', 'resy')), boxes('amex-platinum', 'resy')[3].days],
  [[['2026-Q1', 'Q1', 'past', 100], ['2026-Q2', 'Q2', 'past', 100], ['2026-Q3', 'Q3', 'past', 100], ['2026-Q4', 'Q4', 'current', 100]], 61]);
check('every 6 months: Jan–Jun and Jul–Dec', summary(boxes('amex-platinum', 'hotel')), [['2026-H1', 'Jan–Jun', 'past', 300], ['2026-H2', 'Jul–Dec', 'current', 300]]);
check('yearly (calendar): one box', summary(boxes('amex-platinum', 'airline')), [['2026', '2026', 'current', 200]]);
check('card year with no fee date: the calendar year', summary(boxes('sapphire-reserve', 'travel')), [['2026', '2026', 'current', 300]]);
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
check('card year from a Mar 15 fee date: a box for each card year in 2026, with its dates', summary(boxes('sapphire-reserve', 'travel')),
  [['A2025-03-15', 'Mar 15, 2025 – Mar 14, 2026', 'past', 300], ['A2026-03-15', 'Mar 15, 2026 – Mar 14, 2027', 'current', 300]]);
check('…only the one that’s mostly in 2026 counts toward 2026', boxes('sapphire-reserve', 'travel').map((b) => [b.key, b.counts]), [['A2025-03-15', false], ['A2026-03-15', true]]);
check('…last year: the card years in 2025', summary(boxes('sapphire-reserve', 'travel', 2025)), [['A2024-03-15', 'Mar 15, 2024 – Mar 14, 2025', 'past', 300], ['A2025-03-15', 'Mar 15, 2025 – Mar 14, 2026', 'past', 300]]);
check('…not editable last year', boxes('sapphire-reserve', 'travel', 2025).map((b) => b.editable), [false, false]);
check('select hotels (through Dec 31, 2026): one 2026 box', summary(boxes('sapphire-reserve', 'select-hotels')), [['2026', '2026', 'current', 250]]);
now = new Date(2027, 5, 15, 12);
setup({ cards: ['aadvantage-executive', 'sapphire-reserve'] });
check('Grubhub through Aug 31, 2027: in 2027 only Jan–Aug', boxes('aadvantage-executive', 'grubhub').map((b) => b.short).join(' '), 'Jan Feb Mar Apr May Jun Jul Aug');
check('select hotels in 2027: no boxes this year, one last year', [boxes('sapphire-reserve', 'select-hotels').length, boxes('sapphire-reserve', 'select-hotels', 2026).length], [0, 1]);
now = new Date(2026, 9, 31, 12);

// 2. Ticking boxes on the page
const pageBox = (key, period) => page.querySelector(`[data-cp-box="${key}"][data-cp-period="${period}"]`);
const tick = (key, period, on = true) => { const el = pageBox(key, period); if (!el) throw new Error(`no box ${key} ${period}`); el.checked = on; el.dispatch('change'); };
setup({ cards: ['amex-platinum', 'amex-gold'] });
openPage();
check('on the first page: shown, with the tracker still there, and nothing in the address', [app.location.hash, page.hidden, app.tracker.hidden], ['', false, false]);
check('it starts on All, so no credit is out of sight', startedOn, 'true');
check('going to it scrolls there rather than changing page', shown.scrolled.at(-1) === page, true);
check('a box is a checkbox labeled with the credit, period and dollars', pageBox('amex-platinum:uber', '2026-10').getAttribute('aria-label'), 'Uber Cash, October, $15');
check('…a past one left unticked says missed', pageBox('amex-platinum:uber', '2026-9').getAttribute('aria-label'), 'Uber Cash, September, $15, missed');
check('…and looks it', pageBox('amex-platinum:uber', '2026-9').parentNode.classList.contains('cp-missed'), true);
check('…this month is highlighted', pageBox('amex-platinum:uber', '2026-10').parentNode.classList.contains('cp-current'), true);
check('…future months are disabled', [pageBox('amex-platinum:uber', '2026-11').disabled, pageBox('amex-platinum:uber', '2026-10').disabled], [true, false]);
tick('amex-platinum:uber', '2026-10');
check('ticking October: kept in creditsLog', state().creditsLog['amex-platinum:uber'], { '2026-10': true });
check('…and the main page’s Mark used agrees', [state().creditsUsed['amex-platinum:uber'], state().creditsUsedOn['amex-platinum:uber'], app.heldCredits().find((x) => x.key === 'amex-platinum:uber').used], ['2026-10', '2026-10-31', true]);
check('…saved', app.saves() > 0, true);
check('…and the box is ticked after the page redraws', pageBox('amex-platinum:uber', '2026-10').checked, true);
tick('amex-platinum:uber', '2026-10', false);
check('unticking: gone from both', ['amex-platinum:uber' in state().creditsLog, 'amex-platinum:uber' in state().creditsUsed, 'amex-platinum:uber' in state().creditsUsedOn], [false, false, false]);
check('…with Undo', [shown.toasts.at(-1).message, typeof shown.toasts.at(-1).undo], ['Unchecked Uber Cash for October', 'function']);
shown.toasts.at(-1).undo();
check('Undo: ticked again, in both', [state().creditsLog['amex-platinum:uber'], state().creditsUsed['amex-platinum:uber']], [{ '2026-10': true }, '2026-10']);
tick('amex-platinum:uber', '2026-9');
check('ticking September (past): kept, Mark used still means October', [state().creditsLog['amex-platinum:uber'], state().creditsUsed['amex-platinum:uber']], [{ '2026-10': true, '2026-9': true }, '2026-10']);
check('…no longer missed', pageBox('amex-platinum:uber', '2026-9').getAttribute('aria-label'), 'Uber Cash, September, $15');
const future = pageBox('amex-platinum:uber', '2026-12');
future.checked = true; future.dispatch('change');
check('a future box can’t be ticked', '2026-12' in state().creditsLog['amex-platinum:uber'], false);
tick('amex-platinum:uber', '2026-9', false);
check('unticking a past month keeps October', state().creditsLog['amex-platinum:uber'], { '2026-10': true });

// …and the main page's Mark used writes the same record
const toggleUsed = (key) => {
  const list = app.body.querySelector('#credits-list');
  for (const l of list.listeners) if (l.type === 'click') l.fn({ target: { closest: (sel) => (sel === 'button' ? { dataset: { creditUse: key }, closest: () => null } : null) } });
};
setup({ cards: ['amex-gold'] });
toggleUsed('amex-gold:uber');
check('main page Mark used: ticked in creditsLog for October', state().creditsLog['amex-gold:uber'], { '2026-10': true });
check('…and shows ticked on the page', pageBox('amex-gold:uber', '2026-10').checked, true);
toggleUsed('amex-gold:uber');
check('main page unmarked: unticked', 'amex-gold:uber' in state().creditsLog, false);

// 3. Partial use: yearly and half-yearly credits of $50 or more
const amt = (key, period) => page.querySelector(`[data-cp-amt="${key}"][data-cp-period="${period}"]`);
const typeAmt = (key, period, value) => { const el = amt(key, period); if (!el) throw new Error(`no amount field ${key}`); el.value = value; el.dispatch('change'); };
setup({ cards: ['amex-platinum'] });
app.renderCredits();
check('amount field on the Hotel credit (half, $300) for Jul–Dec, not on monthly or past ones',
  [!!amt('amex-platinum:hotel', '2026-H2'), !!amt('amex-platinum:hotel', '2026-H1'), !!amt('amex-platinum:uber', '2026-10'), !!amt('amex-platinum:airline', '2026')], [true, false, false, true]);
typeAmt('amex-platinum:hotel', '2026-H2', '120');
check('$120 of $300: kept as an amount', state().creditsLog['amex-platinum:hotel'], { '2026-H2': 120 });
check('…not ticked, not used on the main page', [pageBox('amex-platinum:hotel', '2026-H2').checked, 'amex-platinum:hotel' in state().creditsUsed], [false, false]);
check('…$180 left on the main page', app.heldCredits().find((x) => x.key === 'amex-platinum:hotel').left, 180);
const m1 = app.creditsPageModel();
const hotelRow = m1.cards[0].rows.find((r) => r.key === 'amex-platinum:hotel');
check('…counts $120 used and $180 still available', [hotelRow.boxes[1].used, hotelRow.left], [120, 180]);
typeAmt('amex-platinum:hotel', '2026-H2', '$300');
check('the full $300: ticked, and used on the main page', [state().creditsLog['amex-platinum:hotel'], state().creditsUsed['amex-platinum:hotel']], [{ '2026-H2': true }, '2026-H2']);
typeAmt('amex-platinum:hotel', '2026-H2', '');
check('emptied: cleared', ['amex-platinum:hotel' in state().creditsLog, 'amex-platinum:hotel' in state().creditsUsed], [false, false]);
typeAmt('amex-platinum:hotel', '2026-H2', '12,50');
check('"12,50" reads as $12.50', state().creditsLog['amex-platinum:hotel'], { '2026-H2': 12.5 });
tick('amex-platinum:hotel', '2026-H2');
check('ticking a part-used box: fully used', state().creditsLog['amex-platinum:hotel'], { '2026-H2': true });

// 4. Totals at the top
setup({ cards: ['amex-gold'] }); // Resy $50 every 6 months; Dining $10, Uber $10, Dunkin' $7 a month
let m = app.creditsPageModel();
check('Amex Gold: $424 a year, nothing used', [m.cards[0].total, m.cards[0].used, m.used], [424, 0, 0]);
check('…$77 still available now ($50 Resy + $27 this month)', m.available, 77);
check('…$293 missed ($50 Resy Jan–Jun + 9 months × $27)', m.missed, 293);
check('expiring soon: this month’s, last day today (Resy ends Dec 31, past 14 days)', m.soon.map((s) => [s.name, s.amount, s.days]), [['Dining credit', 10, 0], ['Uber Cash', 10, 0], ['Dunkin’', 7, 0]]);
for (const p of ['2026-1', '2026-2', '2026-3', '2026-4', '2026-5', '2026-6', '2026-7', '2026-8', '2026-9']) app.setCreditBox('amex-gold:dining', p, true);
app.setCreditBox('amex-gold:resy', '2026-H2', 20);
m = app.creditsPageModel();
check('Jan–Sep dining ticked, $20 Resy: $110 used, $203 missed, $57 available', [m.used, m.missed, m.available], [110, 203, 57]);
check('…card line: $110 used of $424', [m.cards[0].used, m.cards[0].total], [110, 424]);
check('…drawn as “$110 used of $424 this year”', (app.renderCredits(), page.querySelector('[data-cp-card="amex-gold"]').text.includes('$110 used of $424 this year')), true);
now = new Date(2026, 11, 20, 12);
m = app.creditsPageModel();
check('Dec 20: Resy (ends Dec 31, 11 days) is expiring soon with $30 left, beside December’s monthly ones',
  m.soon.map((s) => [s.name, s.amount, s.days]), [['Resy dining', 30, 11], ['Dining credit', 10, 11], ['Uber Cash', 10, 11], ['Dunkin’', 7, 11]]);
now = new Date(2026, 9, 31, 12);
setup({ cards: ['sapphire-reserve'] });
check('a card-year credit with no fee date is never expiring soon', app.creditsPageModel().soon.some((s) => s.key === 'sapphire-reserve:travel'), false);

// Filters
setup({ cards: ['amex-platinum'] });
app.setCreditBox('amex-platinum:entertainment', '2026-10', true);
const shownKeys = (filter) => app.creditsPageModel({ filter }).cards[0].shown.map((r) => r.key.split(':')[1]);
check('Due this month: unused monthly credits only', shownKeys('month'), ['uber', 'walmart']);
check('Not used yet: everything with something left now', shownKeys('unused'), ['hotel', 'airbnb-experiences', 'airline', 'resy', 'lululemon', 'uber', 'walmart', 'uber-one', 'equinox', 'oura', 'clear']);
check('All: every credit', shownKeys('all').length, 12);

// 5. Old saved data: the one remembered period shows ticked
setup({ cards: ['amex-gold'], creditsUsed: { 'amex-gold:uber': '2026-10', 'amex-gold:resy': '2026-H1', 'nope:x': '2026-10', 'amex-gold:dunkin': 'soon' } });
check('creditsUsed moved into creditsLog on load (bad ones left out)', state().creditsLog, { 'amex-gold:uber': { '2026-10': true }, 'amex-gold:resy': { '2026-H1': true } });
check('…October shows ticked on the page', (app.renderCredits(), pageBox('amex-gold:uber', '2026-10').checked), true);
check('…creditsUsed itself unchanged', state().creditsUsed['amex-gold:uber'], '2026-10');

// 6. Cleaning what's saved or imported
const clean = (log, extra = {}) => app.normalize({ programs: [], cards: [], creditsLog: log, ...extra }).creditsLog;
check('kept: ticks and amounts in this year and last', clean({ 'amex-gold:uber': { '2026-10': true, '2025-3': true }, 'amex-platinum:hotel': { '2026-H2': 120.456 }, 'sapphire-reserve:travel': { 'A2025-03-15': true } }),
  { 'amex-gold:uber': { '2026-10': true, '2025-3': true }, 'amex-platinum:hotel': { '2026-H2': 120.46 }, 'sapphire-reserve:travel': { 'A2025-03-15': true } });
check('unknown cards and odd keys dropped', clean({ 'nope:uber': { 2026: true }, 'amex-gold': { 2026: true }, 'amex-gold:': { 2026: true }, 'amex-gold:<b>': { 2026: true } }), {});
check('periods that aren’t period keys dropped', clean({ 'amex-gold:uber': { '2026-13': true, '2026-0': true, '2026-Q5': true, '2026-H3': true, Oct: true, '2026-10-01': true, A2026: true, 'A2026-02-30': true, '2026-Q4': true } }), { 'amex-gold:uber': { '2026-Q4': true } });
check('values other than true or $0–$100,000 dropped', clean({ 'amex-gold:uber': { '2026-1': false, '2026-2': 0, '2026-3': -5, '2026-4': 'x', '2026-5': null, '2026-6': 100001, '2026-7': 100000, '2026-8': 'true', '2026-9': {} } }), { 'amex-gold:uber': { '2026-7': 100000 } });
const flood = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`amex-gold:c${i}`, { 2026: true }]));
check('at most 60 credits a card', Object.keys(clean(flood)).length, 60);
const manyKeys = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2026-${i + 1}`, true]).concat(Array.from({ length: 12 }, (_, i) => [`2025-${i + 1}`, true]), [['2026-Q1', true], ['2026-Q2', true], ['2026-Q3', true], ['2026-Q4', true], ['2025-Q1', true], ['2025-Q2', true], ['2025-Q3', true], ['2025-Q4', true], ['2026-H1', true], ['2026-H2', true], ['2025-H1', true], ['2025-H2', true], ['2026', true], ['2025', true], ['A2026-01-01', true], ['A2026-01-02', true], ['A2026-01-03', true], ['A2026-01-04', true], ['A2026-01-05', true]]));
check('at most 40 periods a credit', Object.keys(clean({ 'amex-gold:uber': manyKeys })['amex-gold:uber']).length, 40);
check('older than last year pruned on load (a card year that ran into last year stays)', clean({ 'amex-gold:uber': { '2024-12': true, '2025-1': true, 2024: true }, 'sapphire-reserve:travel': { 'A2024-11-15': true, 'A2023-11-15': true } }),
  { 'amex-gold:uber': { '2025-1': true }, 'sapphire-reserve:travel': { 'A2024-11-15': true } });
check('not an object: empty', [clean('x'), clean([1, 2]), clean(null), app.normalize({ programs: [], cards: [] }).creditsLog], [{}, {}, {}, {}]);
check('a hostile __proto__ key changes nothing', JSON.stringify(clean(JSON.parse('{"__proto__": {"2026": true}, "amex-gold:uber": {"__proto__": true, "2026-1": true}}'))), '{"amex-gold:uber":{"2026-1":true}}');

// 7. Backups and Send to another device carry it (both are the whole state through normalize)
setup({ cards: ['amex-gold', 'amex-platinum'] });
app.setCreditBox('amex-gold:uber', '2026-10', true);
app.setCreditBox('amex-gold:uber', '2026-3', true);
app.setCreditBox('amex-platinum:hotel', '2026-H2', 75);
const backup = JSON.parse(JSON.stringify({ app: 'points-status-tracker', exportedAt: 'x', data: { ...state(), backedUp: '2026-10-31', changed: '' } }));
check('backup → restore: creditsLog the same', app.normalize(backup.data).creditsLog, state().creditsLog);
const link = JSON.parse(JSON.stringify({ app: 'points-status-tracker', v: 1, name: 'Me', data: state() }));
check('send link → open: the same', app.normalize(link.data).creditsLog, state().creditsLog);

// 8. A new year: last year stays viewable, read-only
setup({ cards: ['amex-gold'] });
now = new Date(2026, 11, 31, 23, 30);
app.setCreditBox('amex-gold:uber', '2026-12', true);
app.setCreditBox('amex-gold:uber', '2026-11', true);
m = app.creditsPageModel();
check('Dec 31: this year is 2026, December ticked', [m.year, m.cards[0].rows.find((r) => r.key === 'amex-gold:uber').current.full], [2026, true]);
now = new Date(2027, 0, 1, 0, 30);
app.setState(app.normalize(JSON.parse(JSON.stringify(state())))); // reopened on Jan 1
m = app.creditsPageModel();
check('Jan 1: this year is 2027 with nothing used yet', [m.year, m.used, m.cards[0].rows.find((r) => r.key === 'amex-gold:uber').current.key], [2027, 0, '2027-1']);
const last = app.creditsPageModel({ past: true });
const lastUber = last.cards[0].rows.find((r) => r.key === 'amex-gold:uber');
check('…2026 still there: Nov and Dec ticked, all past, only December (ended yesterday) still changeable', [last.year, lastUber.boxes.filter((b) => b.full).map((b) => b.short), lastUber.boxes.every((b) => b.phase === 'past'), lastUber.boxes.filter((b) => b.editable).map((b) => b.short)], [2026, ['Nov', 'Dec'], true, ['Dec']]);
check('…its totals: $20 used, nothing available', [last.used, last.available], [20, 0]);
check('…the main page’s Mark used has moved on to January', app.heldCredits().find((x) => x.key === 'amex-gold:uber').used, false);
openPage();
app.renderCredits(); // the new day's redraw
const yearBtn = page.querySelector('[data-cp-year="past"]');
check('a 2026 toggle', yearBtn && yearBtn.text, '2026');
yearBtn.dispatch('click');
check('…shows last year’s boxes, all but December disabled', [!!pageBox('amex-gold:uber', '2026-12'), pageBox('amex-gold:uber', '2026-12').checked, pageBox('amex-gold:uber', '2026-12').disabled, pageBox('amex-gold:uber', '2026-11').disabled], [true, true, false, true]);
page.querySelector('[data-cp-year="now"]').dispatch('click');
check('…and back to 2027', !!pageBox('amex-gold:uber', '2027-1'), true);
now = new Date(2026, 9, 31, 12);

// 9. Skipped and added credits
setup({ cards: ['amex-gold'], creditsSkipped: { 'amex-gold:dunkin': true }, customCredits: { 'amex-gold': [['cgym', 'Gym', 25, 'month']] } });
m = app.creditsPageModel();
check('skipped: listed apart, left out of the totals', [m.cards[0].skipped.map((r) => r.key), m.cards[0].rows.some((r) => r.key === 'amex-gold:dunkin'), m.cards[0].total], [['amex-gold:dunkin'], false, 424 - 84 + 300]);
check('added credit: a row like the others, 12 boxes', [m.cards[0].rows.find((r) => r.key === 'amex-gold:cgym').boxes.length, m.cards[0].rows.find((r) => r.key === 'amex-gold:cgym').credit.custom], [12, true]);
app.renderCredits();
check('“Not tracking (1)” on the page', page.querySelector('[data-cp-card="amex-gold"]').text.includes('Not tracking (1)'), true);
page.querySelector('[data-cp-unskip="amex-gold:dunkin"]').dispatch('click');
check('Track again: tracked', 'amex-gold:dunkin' in state().creditsSkipped, false);
page.querySelector('[data-cp-skip="amex-gold:dunkin"]').dispatch('click');
check('Stop tracking from the page: skipped, with Undo', [state().creditsSkipped['amex-gold:dunkin'], typeof shown.toasts.at(-1).undo], [true, 'function']);

// 10. Add your cards
setup({ cards: [] });
app.renderCredits();
check('none of the five: five chips', [...page.querySelectorAll('[data-cp-add-card]')].map((b) => b.dataset.cpAddCard), ['sapphire-reserve', 'amex-platinum', 'amex-gold', 'delta-gold', 'bilt-palladium']);
check('…and nothing added without a tap', state().cards, []);
page.querySelector('[data-cp-add-card="amex-gold"]').dispatch('click');
check('tapping Amex Gold adds it like Your cards does (its Hertz status too)', [state().cards, state().programs.some((p) => p.id === 'hertz' && p.status.some((s) => s.card === 'amex-gold'))], [['amex-gold'], true]);
check('…its credits are on the page', !!pageBox('amex-gold:uber', '2026-10'), true);
check('…the chips stay while the page is open, Amex Gold shown as added', [page.querySelectorAll('[data-cp-add-card]').length,
  page.querySelector('[data-cp-add-card="amex-gold"]').getAttribute('aria-disabled'), page.querySelector('[data-cp-add-card="amex-gold"]').text], [5, 'true', '✓ Amex Gold added']);
check('…saved, with Undo', [app.saves() > 0, typeof shown.toasts.at(-1).undo], [true, 'function']);
shown.toasts.at(-1).undo();
check('Undo: the card and the status it added come off', [state().cards, state().programs.some((p) => p.id === 'hertz')], [[], false]);
page.querySelector('[data-cp-choose]').dispatch('click');
check('Choose cards opens the picker', shown.cardsOpened, 1);
setup({ cards: ['freedom-flex'] });
check('another card only: still the chips', app.creditsPageModel().suggest.length, 5);
setup({ cards: ['delta-gold'] });
check('one of the five held: no chips', app.creditsPageModel().suggest, []);

// 11. Annual fee date on the page, and a card-year credit's tick following it
setup({ cards: ['sapphire-reserve'] });
app.renderCredits();
check('Sapphire Reserve has an annual fee date field (card-year travel credit)', !!page.querySelector('[data-cp-renewal="sapphire-reserve"]'), true);
tick('sapphire-reserve:travel', '2026');
const fee = page.querySelector('[data-cp-renewal="sapphire-reserve"]');
fee.value = '2025-03-15';
fee.dispatch('change');
check('fee date saved', state().renewals['sapphire-reserve'], '2025-03-15');
check('…the tick moved to the card year, in both records', [state().creditsLog['sapphire-reserve:travel'], state().creditsUsed['sapphire-reserve:travel']], [{ 'A2026-03-15': true }, 'A2026-03-15']);
check('…and the box shows its dates, ticked', [pageBox('sapphire-reserve:travel', 'A2026-03-15').checked, page.text.includes('Mar 15, 2026 – Mar 14, 2027')], [true, true]);
setup({ cards: ['amex-gold'] });
app.renderCredits();
check('no card-year credits: no fee date field', page.querySelector('[data-cp-renewal]'), null);

// 12. Opening and closing
setup({ cards: ['amex-gold'] });
app.renderCredits();
shown.scrolled.length = 0;
app.location.hash = '#credits';
app.fire('hashchange');
check('a #credits link goes to it, on the same page', [shown.scrolled.at(-1) === page, page.hidden, app.tracker.hidden, app.document.activeElement === page.querySelector('#cp-title')], [true, false, false, true]);
app.location.hash = '';
shown.scrolled.length = 0;
app.fire('hashchange');
check('leaving the link: stays put', [shown.scrolled.length, page.hidden], [0, false]);
app.setState({ ...state(), programs: null });
check('before setup: going to it does nothing', (app.renderCredits(), page.hidden), true);
setup({ cards: ['amex-gold'] });
// A day later with the page open: drawn again for November
openPage();
now = new Date(2026, 10, 1, 9);
app.renderCredits();
check('Nov 1 (the day changed): November is now the highlighted box', pageBox('amex-gold:uber', '2026-11').parentNode.classList.contains('cp-current'), true);
check('…and October is missed', pageBox('amex-gold:uber', '2026-10').parentNode.classList.contains('cp-missed'), true);
now = new Date(2026, 9, 31, 12);

// 13. Expiring soon: tapping one goes to its row
setup({ cards: ['amex-gold'] });
openPage();
app.renderCredits();
shown.scrolled.length = 0;
page.querySelector('[data-cp-jump="amex-gold:uber"]').dispatch('click');
const row = page.querySelector('[data-cp-row="amex-gold:uber"]');
check('tapping Uber Cash under Expiring soon scrolls to its row and highlights it', [shown.scrolled.includes(row), row.classList.contains('cp-flash')], [true, true]);
check('…the summary says when it ends', page.querySelector('[data-cp-jump="amex-gold:uber"]').text.includes('last day today'), true);

// A long Expiring soon list (all five cards on the last day of a month): five shown, the rest behind "N more"
setup({ cards: ['sapphire-reserve', 'amex-platinum', 'amex-gold', 'delta-gold', 'bilt-palladium'] });
app.renderCredits();
const soonAll = app.creditsPageModel({}).soon.length;
const more = page.querySelector('.cp-soon-more');
check('Expiring soon: five shown up top', page.querySelector('.cp-soon').children.find((k) => k.tagName === 'UL').children.length, 5);
check('…the rest in “N more”, each still a jump button', [soonAll > 5, more.querySelector('summary').text, more.querySelectorAll('[data-cp-jump]').length], [true, `${soonAll - 5} more`, soonAll - 5]);
more.setAttribute('open', '');
app.renderCredits();
check('…left open across a redraw', page.querySelector('.cp-soon-more').getAttribute('open') !== null, true);
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2026-03-15' } });
app.renderCredits();
check('the card year’s line starts with a capital: “The card year to Mar 14, 2027: …”', page.querySelector('[data-cp-row="sapphire-reserve:travel"] .cp-now').text.startsWith('The card year to Mar 14, 2027'), true);
check('StubHub: its end date once (“through Dec 31, 2027”), not again in the note', (() => { const t = page.querySelector('[data-cp-row="sapphire-reserve:stubhub"]').text; return [t.includes('through Dec 31, 2027'), t.includes('12/31/27'), t.includes('activate first')]; })(), [true, false, true]);

// 14. Repair round 1
const cents2 = (n) => Math.round(n * 100) / 100;
const call = (f, ...args) => { try { return f(...args); } catch (e) { return `threw: ${e.message}`; } };
const reload = () => app.setState(app.normalize(JSON.parse(JSON.stringify(state()))));
const held = (key) => app.heldCredits().find((x) => x.key === key);

// Unticking a past month the main page marked stays unticked after a reload
setup({ cards: ['amex-gold'] });
toggleUsed('amex-gold:uber');
now = new Date(2026, 10, 2, 12);
app.setCreditBox('amex-gold:uber', '2026-10', null);
reload();
check('unticked October (marked on the main page) stays unticked after a reload', [state().creditsLog['amex-gold:uber'] || null, state().creditsUsed['amex-gold:uber'] || null], [null, null]);
now = new Date(2026, 9, 31, 12);

// Card years count toward one calendar year
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
now = new Date(2026, 4, 10, 12);
app.setCreditBox('sapphire-reserve:travel', 'A2026-03-15', true);
now = new Date(2026, 11, 31, 12);
check('Dec 31 2026: $300 travel used this year', app.creditsPageModel().used, 300);
app.renderCredits();
check('…the card year from 2025 on the page says it counts toward 2025 (not missed in 2026)', [pageBox('sapphire-reserve:travel', 'A2025-03-15').getAttribute('aria-label'), pageBox('sapphire-reserve:travel', 'A2025-03-15').parentNode.classList.contains('cp-missed')], ['Travel credit, the card year to Mar 14, 2026, $300, counts toward 2025', false]);
now = new Date(2027, 0, 1, 12);
reload();
m = app.creditsPageModel();
const travel27 = m.cards[0].rows.find((r) => r.key === 'sapphire-reserve:travel');
check('Jan 1 2027: not counted again in 2027', m.used, 0);
check('…the card year on now is still there, ticked and editable', [travel27.boxes.map((b) => b.key), travel27.current.key, travel27.current.full, travel27.current.editable, travel27.left], [['A2026-03-15', 'A2027-03-15'], 'A2026-03-15', true, true, 0]);
const last26 = app.creditsPageModel({ past: true });
const travel26 = last26.cards[0].rows.find((r) => r.key === 'sapphire-reserve:travel');
check('…2026 still shows $300 used, the card year you used ticked', [last26.used, travel26.boxes.filter((b) => b.full).map((b) => b.key)], [300, ['A2026-03-15']]);
now = new Date(2026, 9, 31, 12);
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-12-31' } });
now = new Date(2026, 5, 1, 12);
app.setCreditBox('sapphire-reserve:travel', 'A2025-12-31', true);
now = new Date(2026, 11, 31, 12);
m = app.creditsPageModel();
check('Dec 31 fee date: on Dec 31 2026 the card year that covered 2026 still counts for 2026', [m.used, m.cards[0].rows.find((r) => r.key === 'sapphire-reserve:travel').boxes.map((b) => [b.key, b.counts])],
  [300, [['A2025-12-31', true], ['A2026-12-31', false]]]);
now = new Date(2026, 9, 31, 12);

// Coming up and the text export use what's left
setup({ cards: ['amex-platinum'] });
app.setCreditBox('amex-platinum:hotel', '2026-H2', 280);
const hotel = held('amex-platinum:hotel');
check('Coming up: “Use your $20 Lodging credit” after $280 of it was used', call(app.creditUseText, hotel), 'Use your $20 Lodging credit');
check('…the text summary’s line too', call(app.comingUpLine, { kind: 'credit', x: hotel, date: hotel.period.end, days: hotel.days }), '- Use your $20 Lodging credit (Amex Platinum) by Dec 31, 2026');
check('…and its card list says how much is used', [call(app.creditStatusText, hotel), call(app.creditStatusText, held('amex-platinum:airline'))], ['$280 of $300 used', 'not used yet']);

// Undo after unticking puts back the day it was used
setup({ cards: ['sapphire-reserve'] });
now = new Date(2026, 1, 1, 12);
toggleUsed('sapphire-reserve:travel');
now = new Date(2026, 9, 31, 12);
openPage();
app.renderCredits();
tick('sapphire-reserve:travel', '2026', false);
shown.toasts.at(-1).undo();
check('Undo after unticking: used on Feb 1 again', [state().creditsUsed['sapphire-reserve:travel'], state().creditsUsedOn['sapphire-reserve:travel']], ['2026', '2026-02-01']);
app.setRenewal('sapphire-reserve', '2025-03-15');
check('…so a fee date of Mar 15 puts it in the card year it was used in (to Mar 14, 2026), not this one', [state().creditsLog['sapphire-reserve:travel'], held('sapphire-reserve:travel').used], [{ 'A2025-03-15': true }, false]);

// A part-used amount moves with the fee date only into a card year it was spent in
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
now = new Date(2026, 3, 10, 12);
app.setCreditBox('sapphire-reserve:travel', 'A2026-03-15', 120);
now = new Date(2026, 9, 31, 12);
reload();
app.setRenewal('sapphire-reserve', '2025-10-15');
check('$120 typed Apr 10: the card year to Oct 14, 2026 gets it, not the one that began Oct 15', state().creditsLog['sapphire-reserve:travel'], { 'A2025-10-15': 120 });
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
now = new Date(2026, 9, 20, 12);
app.setCreditBox('sapphire-reserve:travel', 'A2026-03-15', 120);
now = new Date(2026, 9, 31, 12);
app.setRenewal('sapphire-reserve', '2025-10-15');
check('$120 typed Oct 20: the card year that began Oct 15 does', state().creditsLog['sapphire-reserve:travel'], { 'A2026-10-15': 120 });
check('…the day it was typed is kept in a backup', [app.normalize(JSON.parse(JSON.stringify(state()))).creditsPartOn, app.normalize({ programs: [], cards: [], creditsPartOn: { 'sapphire-reserve:travel': '2026-10-20', 'amex-gold:uber': 'Oct' } }).creditsPartOn],
  [{ 'sapphire-reserve:travel': '2026-10-20' }, {}]);
app.setCreditBox('sapphire-reserve:travel', 'A2025-10-15', true);
check('…ticking the card year before leaves that day alone', state().creditsPartOn['sapphire-reserve:travel'], '2026-10-20');
setup({ cards: ['sapphire-reserve'] });
now = new Date(2026, 3, 10, 12);
app.setCreditBox('sapphire-reserve:travel', '2026', 120);
now = new Date(2026, 9, 31, 12);
app.setRenewal('sapphire-reserve', '2025-03-15');
check('$120 typed Apr 10 with no fee date: adding Mar 15 moves it into that card year', state().creditsLog['sapphire-reserve:travel'], { 'A2026-03-15': 120 });

// An amount at or over the credit's value is used on both pages
setup({ cards: ['amex-platinum'], creditsLog: { 'amex-platinum:hotel': { '2026-H2': 300 } } });
check('a logged $300 of $300: used on the main page too', [held('amex-platinum:hotel').used, held('amex-platinum:hotel').left], [true, 0]);

// Mark used on the main page, then unmark: the part-used amount comes back
setup({ cards: ['amex-platinum'] });
app.setCreditBox('amex-platinum:hotel', '2026-H2', 120);
toggleUsed('amex-platinum:hotel');
check('Mark used over $120: used', state().creditsLog['amex-platinum:hotel'], { '2026-H2': true });
toggleUsed('amex-platinum:hotel');
check('…unmarked: the $120 is back', state().creditsLog['amex-platinum:hotel'], { '2026-H2': 120 });

// Last year with a filter left on
setup({ cards: ['amex-gold'] });
check('last year ignores the filter', [app.creditsPageModel({ past: true, filter: 'unused' }).cards[0].shown.length, app.creditsPageModel({ past: true, filter: 'month' }).cards[0].shown.length], [4, 4]);
app.renderCredits();
page.querySelector('[data-cp-filter="unused"]').dispatch('click');
page.querySelector('[data-cp-year="past"]').dispatch('click');
check('…on the page: every row', page.querySelectorAll('[data-cp-row]').length, 4);

// Last year doesn't call everything missed
check('…no box looks or reads missed', [page.querySelectorAll('.cp-missed').length, pageBox('amex-gold:uber', '2025-9').getAttribute('aria-label')], [0, 'Uber Cash, September, $10']);
check('…no missed total, and the one tile spans the strip', [page.querySelector('.cp-summary').text.includes('missed'), page.querySelector('.cp-summary').children.length, page.querySelector('.cp-summary').children[0].classList.contains('cp-tile-solo')], [false, 1, true]);
page.querySelector('[data-cp-year="now"]').dispatch('click');
page.querySelector('[data-cp-filter="all"]').dispatch('click');

// Every credit on a card hidden: no dollars or bar
setup({ cards: ['delta-gold'], creditsSkipped: { 'delta-gold:stays': true, 'delta-gold:rideshare': true } });
app.renderCredits();
const dg = page.querySelector('[data-cp-card="delta-gold"]');
check('all hidden: no “$0 used of $0” and no bar', [!!dg.querySelector('.cp-card-sum'), !!dg.querySelector('.cp-bar'), dg.text.includes('Not tracking (2)')], [false, false, true]);

// Add your cards: tap each of the five in turn
setup({ cards: [] });
app.renderCredits();
page.querySelector('[data-cp-add-card="amex-gold"]').dispatch('click');
page.querySelector('[data-cp-add-card="sapphire-reserve"]').dispatch('click');
check('two chips tapped: both cards added, the panel still there', [state().cards, page.querySelectorAll('[data-cp-add-card]').length], [['amex-gold', 'sapphire-reserve'], 5]);
page.querySelector('[data-cp-add-card="amex-gold"]').dispatch('click');
check('…tapping an added one does nothing', state().cards, ['amex-gold', 'sapphire-reserve']);

// Styles: wide layout as columns, the header button under the title on phones
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const wide = style.slice(style.indexOf('/* The credits checklist on wide screens'));
check('wide: cards flow in columns, a card never split', [/\.cp-cards \{ display: block; columns: 420px 3;/.test(wide), /\.cp-card \{[^}]*break-inside: avoid/.test(wide)], [true, true]);
const phone = style.slice(style.indexOf('@media (max-width: 480px) { /* the switcher'));
check('phones: Credits sits on the second line under the date', /\.hero-link \{ order: 3; margin-left: 52px; \}/.test(phone.slice(0, phone.indexOf('\n  }'))), true);

// 15. Repair round 2
const sorted = (o) => Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => (a < b ? -1 : 1)));

// Unmarking on the main page never brings back a stale part-used amount, or someone else's
setup({ cards: ['amex-platinum'] });
app.setCreditBox('amex-platinum:hotel', '2026-H2', 120);
toggleUsed('amex-platinum:hotel');
app.setCreditBox('amex-platinum:hotel', '2026-H2', null); // unticked on the Credits page
app.setCreditBox('amex-platinum:hotel', '2026-H2', 50);
app.setCreditBox('amex-platinum:hotel', '2026-H2', true);
toggleUsed('amex-platinum:hotel');
check('$120 covered by Mark used, then changed on the Credits page: unmarking doesn’t bring back $120',
  [null, '{"2026-H2":50}'].includes(state().creditsLog['amex-platinum:hotel'] ? JSON.stringify(state().creditsLog['amex-platinum:hotel']) : null), true);
setup({ cards: ['amex-platinum'] });
app.setCreditBox('amex-platinum:hotel', '2026-H2', 120);
toggleUsed('amex-platinum:hotel'); // person A
app.setState(app.normalize({ programs: [], cards: ['amex-platinum'], creditsUsed: { 'amex-platinum:hotel': '2026-H2' }, creditsUsedOn: { 'amex-platinum:hotel': '2026-08-01' } }));
app.forgetCreditParts(); // what switching person does
toggleUsed('amex-platinum:hotel'); // person B unmarks
check('another person’s Hotel credit unmarked: cleared, not A’s $120', [state().creditsLog['amex-platinum:hotel'] || null, state().creditsPartOn['amex-platinum:hotel'] || null], [null, null]);
check('…switching person, restoring a backup (and its Undo) and another window’s save all forget it', [
  piece('  function switchPerson', '  function saveRename').includes('forgetCreditParts()'),
  (piece('  function replaceTracker', '  /* ---------- Send to another device').match(/forgetCreditParts\(\)/g) || []).length >= 2,
  piece("  addEventListener('storage'", '  // Flush a pending save').includes('forgetCreditParts()')], [true, true, true]);

// Changing the fee date keeps earlier card years' ticks
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-01' } });
app.setCreditBox('sapphire-reserve:travel', 'A2025-03-01', true);
app.setCreditBox('sapphire-reserve:travel', 'A2026-03-01', true);
app.setRenewal('sapphire-reserve', '2025-03-15');
check('fee date Mar 1 → Mar 15: both card years stay ticked under the new dates', sorted(state().creditsLog['sapphire-reserve:travel']), { 'A2025-03-15': true, 'A2026-03-15': true });
check('…2025 still shows $300 used', app.creditsPageModel({ past: true }).used, 300);
setup({ cards: ['sapphire-reserve'], creditsLog: { 'sapphire-reserve:travel': { 2025: true } } });
app.setRenewal('sapphire-reserve', '2025-03-15');
check('a fee date added for the first time: last year’s tick moves to the card year mostly in 2025', sorted(state().creditsLog['sapphire-reserve:travel']), { 'A2025-03-15': true });
app.setRenewal('sapphire-reserve', '');
check('…and back to 2025 when the date is cleared', sorted(state().creditsLog['sapphire-reserve:travel']), { 2025: true });
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-01' }, creditsLog: { 'sapphire-reserve:travel': { 'A2025-03-01': 120 } } });
app.setRenewal('sapphire-reserve', '2025-03-15');
check('…a part-used amount on an earlier card year moves too', sorted(state().creditsLog['sapphire-reserve:travel']), { 'A2025-03-15': 120 });

// After Jan 1, last year's last periods can still be ticked for a while
now = new Date(2027, 0, 1, 0, 1);
setup({ cards: ['amex-gold', 'amex-platinum'] });
check('Jan 1 2027: December 2026, Q4 and Jul–Dec can still be ticked; November can’t',
  [boxes('amex-gold', 'uber', 2026)[11].editable, boxes('amex-gold', 'uber', 2026)[10].editable, boxes('amex-platinum', 'resy', 2026)[3].editable, boxes('amex-platinum', 'hotel', 2026)[1].editable, boxes('amex-platinum', 'hotel', 2026)[0].editable], [true, false, true, true, false]);
openPage();
page.querySelector('[data-cp-year="past"]').dispatch('click');
tick('amex-gold:uber', '2026-12');
check('…ticking December 2026 in last year’s view: kept, and Mark used still means January', [state().creditsLog['amex-gold:uber'], state().creditsUsed['amex-gold:uber'] || null], [{ '2026-12': true }, null]);
check('…still ticked after the redraw', pageBox('amex-gold:uber', '2026-12').checked, true);
page.querySelector('[data-cp-year="now"]').dispatch('click');
now = new Date(2027, 1, 15, 12);
check('Feb 15 2027: December 2026 is view-only', boxes('amex-gold', 'uber', 2026)[11].editable, false);
now = new Date(2026, 9, 31, 12);

// Sapphire Reserve DoorDash was $5 a month before Oct 2026
setup({ cards: ['sapphire-reserve'] });
const dd = boxes('sapphire-reserve', 'doordash');
check('DoorDash: Jan–Sep $5, Oct–Dec $15', dd.map((b) => b.amount), [5, 5, 5, 5, 5, 5, 5, 5, 5, 15, 15, 15]);
app.renderCredits();
check('…January’s box says $5', pageBox('sapphire-reserve:doordash', '2026-1').getAttribute('aria-label'), 'DoorDash, January, $5, missed');
const srRows = app.creditsPageModel().cards[0].rows;
check('…its row counts $90 a year ($45 + $45)', cents2(srRows.find((r) => r.key === 'sapphire-reserve:doordash').boxes.reduce((n, b) => n + b.amount, 0)), 90);

// Last year: only credits the card had then
const last25 = app.creditsPageModel({ past: true });
check('2025: no Select hotels credit (new in 2026), DoorDash at $5', [last25.cards[0].rows.some((r) => r.key === 'sapphire-reserve:select-hotels'),
  last25.cards[0].rows.find((r) => r.key === 'sapphire-reserve:doordash').boxes.every((b) => b.amount === 5)], [false, true]);
check('…this year still has it', boxes('sapphire-reserve', 'select-hotels').length, 1);
page.querySelector('[data-cp-year="past"]').dispatch('click');
const sr25 = page.querySelector('[data-cp-card="sapphire-reserve"]');
check('…the card says what was ticked, not “of $Y” from this year’s list, and no bar', [sr25.text.includes('$0 used in 2025'), sr25.text.includes(' of $'), !!sr25.querySelector('.cp-bar')], [true, false, false]);

// Last year's boxes look read-only
check('…its boxes are marked locked, with a note under the year', [pageBox('sapphire-reserve:doordash', '2025-3').parentNode.classList.contains('cp-locked'), page.text.includes('Viewing 2025 (read-only)')], [true, true]);
page.querySelector('[data-cp-year="now"]').dispatch('click');
check('…this year’s past boxes aren’t', [pageBox('sapphire-reserve:doordash', '2026-3').parentNode.classList.contains('cp-locked'), page.text.includes('read-only')], [false, false]);
check('…locked boxes get no pointer or hover border', [/\.cp-box\.cp-locked \{[^}]*cursor: default/.test(style), /\.cp-box:not\(\.cp-future\):not\(\.cp-locked\):hover/.test(style)], [true, true]);

// A card year that counts toward last year isn't "missed" this year
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2026-03-15' } });
app.renderCredits();
const prevYear = pageBox('sapphire-reserve:travel', 'A2025-03-15');
check('fee date Mar 15 2026: the card year to Mar 14, 2026 isn’t struck through or called missed', [prevYear.parentNode.classList.contains('cp-missed'), prevYear.getAttribute('aria-label').includes('missed')], [false, false]);

// No "missed" dollars at the top
setup({ cards: ['amex-gold'] });
app.renderCredits();
check('the summary shows used, available and expiring soon, not a missed total', [app.creditsPageModel().missed > 0, page.querySelector('.cp-summary').text.includes('missed')], [true, false]);

// 16. Repair round 3
const SR = 'sapphire-reserve:travel';
const lastToast = () => shown.toasts.at(-1) || { undo: null };
const undoLast = () => { const t = lastToast(); if (t.undo) t.undo(); };
const feeOnPage = (date) => { const el = page.querySelector('[data-cp-renewal="sapphire-reserve"]'); el.value = date; el.dispatch('change'); };

// A fee date added after a use from before the new card year began: the tick goes to the card year it was used in
now = new Date(2026, 1, 10, 12);
setup({ cards: ['sapphire-reserve'] });
app.setCreditBox(SR, '2026', true);
now = new Date(2026, 9, 31, 12);
app.setRenewal('sapphire-reserve', '2025-03-15');
check('ticked Feb 10 with no fee date, then Mar 15 added: the card year Mar 15, 2025 – Mar 14, 2026 is ticked', state().creditsLog[SR], { 'A2025-03-15': true });
check('…the $300 counts in 2025, not 2026, and this card year’s credit is still unused', [app.creditsPageModel().used, app.creditsPageModel({ past: true }).used, held(SR).used], [0, 300, false]);
reload();
check('…a reload doesn’t tick 2026 again', state().creditsLog[SR], { 'A2025-03-15': true });
now = new Date(2026, 3, 1, 12);
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
app.setCreditBox(SR, 'A2026-03-15', 120);
now = new Date(2026, 9, 31, 12);
app.setRenewal('sapphire-reserve', '2025-06-01');
check('$120 typed Apr 1, fee date moved to Jun 1: on the card year Jun 1, 2025 – May 31, 2026 (a box you can see)', state().creditsLog[SR], { 'A2025-06-01': 120 });

// A tick on the Credits page, then the fee date corrected to one that just passed
setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
openPage();
app.renderCredits();
tick(SR, 'A2026-03-15');
feeOnPage('2025-10-15');
check('ticked Oct 31 for Mar 15, 2026 on, fee date set to Oct 15, 2025: the card year to Oct 14, 2026 is ticked', state().creditsLog[SR], { 'A2025-10-15': true });
check('…still $300 used in 2026, and that box isn’t missed', [app.creditsPageModel().used, pageBox(SR, 'A2025-10-15').checked, pageBox(SR, 'A2025-10-15').parentNode.classList.contains('cp-missed')], [300, true, false]);

// Trying a few fee dates and going back to the first puts every tick back
const lost = [];
const visible = () => boxes('sapphire-reserve', 'travel').map((b) => `${b.key}${b.value != null ? `=${b.value}` : ''}`).join(' ');
const fees = ['', '2025-03-15', '2025-11-01', '2025-06-01', '2025-01-01', '2025-12-31', '2025-10-31', '2025-07-15', '2025-01-15'];
for (const f0 of fees.slice(1)) for (const f1 of fees) for (const f2 of fees) {
  if (f1 === f0 || f2 === f1 || f2 === f0) continue;
  setup({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': f0 } });
  for (const b of boxes('sapphire-reserve', 'travel')) if (b.phase !== 'future') app.setCreditBox(SR, b.key, true);
  const was = visible();
  app.setRenewal('sapphire-reserve', f1);
  app.setRenewal('sapphire-reserve', f2);
  app.setRenewal('sapphire-reserve', f0);
  if (visible() !== was) lost.push(`${f0} → ${f1 || 'none'} → ${f2 || 'none'} → back`);
}
check('fee date changed twice and back (336 ways): every tick back where it was', lost.slice(0, 3), []);

// Ticking a part-used box on the Credits page, then unticking it: the amount comes back
setup({ cards: ['amex-platinum'] });
app.renderCredits();
typeAmt('amex-platinum:hotel', '2026-H2', '120');
tick('amex-platinum:hotel', '2026-H2');
tick('amex-platinum:hotel', '2026-H2', false);
check('$120, ticked, unticked: back to $120 used, $180 left, the field says 120', [state().creditsLog['amex-platinum:hotel'], held('amex-platinum:hotel').left, amt('amex-platinum:hotel', '2026-H2').value], [{ '2026-H2': 120 }, 180, '120']);
undoLast();
check('…Undo: ticked again', state().creditsLog['amex-platinum:hotel'], { '2026-H2': true });

// Text that isn't an amount leaves the amount alone; clearing one can be undone
setup({ cards: ['amex-platinum', 'amex-gold'] });
app.renderCredits();
typeAmt('amex-platinum:hotel', '2026-H2', '120');
for (const typo of ['1200o', '120 dollars', '-20']) {
  shown.toasts.length = 0;
  typeAmt('amex-platinum:hotel', '2026-H2', typo);
  check(`“${typo}”: $120 kept, the field back to 120, and a note says why`, [state().creditsLog['amex-platinum:hotel'], amt('amex-platinum:hotel', '2026-H2').value, shown.toasts.length], [{ '2026-H2': 120 }, '120', 1]);
}
typeAmt('amex-gold:resy', '2026-H2', '30');
typeAmt('amex-gold:resy', '2026-H2', '3O');
check('Resy $30, then “3O”: still $30', state().creditsLog['amex-gold:resy'], { '2026-H2': 30 });
typeAmt('amex-gold:resy', '2026-H2', '');
check('…emptied: cleared, with Undo', ['amex-gold:resy' in state().creditsLog, typeof lastToast().undo], [false, 'function']);
undoLast();
check('…Undo: $30 again', state().creditsLog['amex-gold:resy'], { '2026-H2': 30 });

// Ticking under a filter: the row stays (with focus) until the filter changes
setup({ cards: ['amex-gold'] });
app.renderCredits();
page.querySelector('[data-cp-filter="unused"]').dispatch('click');
pageBox('amex-gold:dining', '2026-10').focus();
tick('amex-gold:dining', '2026-10');
const dining = pageBox('amex-gold:dining', '2026-10');
check('Not used yet, Dining ticked: its row stays, ticked, and keeps focus', [!!dining && dining.checked, app.document.activeElement === dining], [true, true]);
page.querySelector('[data-cp-filter="month"]').dispatch('click');
check('…picking a filter again hides it', !!page.querySelector('[data-cp-row="amex-gold:dining"]'), false);
page.querySelector('[data-cp-filter="all"]').dispatch('click');

// Focus after Stop tracking, Track again and Choose cards
setup({ cards: ['amex-gold'] });
app.renderCredits();
const order = [...page.querySelectorAll('[data-cp-row]')].map((r) => r.dataset.cpRow);
page.querySelector(`[data-cp-skip="${order[0]}"]`).focus();
page.querySelector(`[data-cp-skip="${order[0]}"]`).dispatch('click');
check('Stop tracking: focus on the next row’s ✕', app.document.activeElement === page.querySelector(`[data-cp-skip="${order[1]}"]`), true);
page.querySelector(`[data-cp-unskip="${order[0]}"]`).focus();
page.querySelector(`[data-cp-unskip="${order[0]}"]`).dispatch('click');
const back0 = page.querySelector(`[data-cp-row="${order[0]}"] .cp-current input`);
check('Track again: focus on that credit’s box for now', [!!back0, app.document.activeElement === back0], [true, true]);
setup({ cards: ['amex-gold'], creditsSkipped: { 'amex-gold:dunkin': true, 'amex-gold:resy': true } });
app.renderCredits();
page.querySelector('[data-cp-card="amex-gold"] details').setAttribute('open', '');
page.querySelector('[data-cp-unskip="amex-gold:dunkin"]').dispatch('click');
check('…and “Not tracking” stays open for the next one', page.querySelector('[data-cp-card="amex-gold"] details').getAttribute('open'), '');
setup({ cards: [] });
app.renderCredits();
page.querySelector('[data-cp-choose]').focus();
page.querySelector('[data-cp-choose]').dispatch('click');
app.renderCredits(); // a card picked in the sheet redraws the page
app.document.activeElement = app.body;
app.document.querySelector('#cards-sheet').dispatch('close');
check('Choose cards closed: focus back on the link', app.document.activeElement === page.querySelector('[data-cp-choose]'), true);

// No cards with credits: just Add your cards
setup({ cards: [] });
app.renderCredits();
check('no cards: Add your cards, no totals, filters or year switch', [!!page.querySelector('.cp-add'), !!page.querySelector('.cp-summary'), !!page.querySelector('[data-cp-filter]'), !!page.querySelector('[data-cp-year]')], [true, false, false, false]);
page.querySelector('[data-cp-add-card="amex-gold"]').dispatch('click');
const kids = page.children;
check('…after adding one: the panel above the totals', kids.findIndex((k) => k.classList.contains('cp-add')) < kids.findIndex((k) => k.classList.contains('cp-summary')), true);

// 17. As time passes: rollovers, a page left open, people, damaged data, and every total agreeing
const at = (y, m, d, h = 12, min = 0) => { now = new Date(y, m - 1, d, h, min); };
const midnight = (y, m, d) => { at(y, m, d, 0, 0); now = new Date(now.getTime() + 5000); app.refreshDay(); }; // the page's own redraw just after midnight
const open = (fields) => { setup(fields); app.closeCreditsPage(); app.location.hash = ''; openPage(); app.renderUpcoming(); app.renderCredits(); };
const rowOf = (key, past = false) => app.creditsPageModel({ past }).cards.flatMap((c) => c.rows).find((r) => r.key === key);
const heldOf = (key) => app.heldCredits().find((x) => x.key === key);
app.document.querySelector('#upcoming').append(app.document.querySelector('#up-list'));
const comingUp = () => { app.renderUpcoming(); return app.document.querySelector('#upcoming').hidden ? [] : app.document.querySelector('#up-list').querySelectorAll('[data-credit-row]').map((b) => b.dataset.creditRow); };
const pastView = (on = true) => page.querySelector(`[data-cp-year="${on ? 'past' : 'now'}"]`).dispatch('click');
const backToOct = () => { now = new Date(2026, 9, 31, 12); page.hidden = true; app.location.hash = ''; };

// Oct 31 to Nov 1, with the page open
open({ cards: ['amex-gold', 'amex-platinum'] });
at(2026, 10, 31, 23, 59);
app.renderCredits();
tick('amex-gold:uber', '2026-10');
check('Oct 31: October’s Uber Cash ticked, here and on the main page', [rowOf('amex-gold:uber').current.key, rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used], ['2026-10', 0, true]);
const q4Left = rowOf('amex-platinum:resy').left;
midnight(2026, 11, 1);
check('…Nov 1: the box on now is November, unused on both pages, October stays ticked', [rowOf('amex-gold:uber').current.key, rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used, pageBox('amex-gold:uber', '2026-10').checked, pageBox('amex-gold:uber', '2026-11').checked], ['2026-11', 10, false, true, false]);
check('…a quarterly credit is still Q4, with what it had', [rowOf('amex-platinum:resy').current.key, rowOf('amex-platinum:resy').left], ['2026-Q4', q4Left]);

check('…and the date at the top of the tracker has moved on', app.document.querySelector('#today').textContent, 'Sunday, November 1, 2026');

// Nov 30 to Dec 1: Uber Cash is $35 in December only
at(2026, 11, 30, 23, 59);
open({ cards: ['amex-platinum'] });
const availNov = app.creditsPageModel().available;
const totalNov = app.creditsPageModel().cards[0].total;
check('Nov 30: Uber Cash $15 on both pages', [rowOf('amex-platinum:uber').left, heldOf('amex-platinum:uber').left], [15, 15]);
midnight(2026, 12, 1);
check('Dec 1: $35 on both pages, available up $20, the year’s total the same', [rowOf('amex-platinum:uber').left, heldOf('amex-platinum:uber').left, app.creditsPageModel().available - availNov, app.creditsPageModel().cards[0].total], [35, 35, 20, totalNov]);
check('…the main page’s rate says this month, the page’s both', [app.creditRate(heldOf('amex-platinum:uber').credit), page.querySelector('[data-cp-row="amex-platinum:uber"] small').text], ['$35 this month', '$15 a month · $35 in December']);
tick('amex-platinum:uber', '2026-11');
tick('amex-platinum:uber', '2026-12');
check('…November ticked late is $15, December $35: $50 used', app.creditsPageModel().used, 50);
midnight(2027, 1, 1);
check('Jan 1: back to $15, and the $35 December still in 2026', [rowOf('amex-platinum:uber').left, heldOf('amex-platinum:uber').left, rowOf('amex-platinum:uber', true).boxes.at(-1).used, app.creditsPageModel({ past: true }).used], [15, 15, 35, 50]);

// Dec 31 to Jan 1, with the page open: the year toggle, half-year keys, credits that end, Bilt Cash
at(2026, 12, 31, 23, 59);
open({ cards: ['sapphire-reserve', 'bilt-palladium'], renewals: { 'sapphire-reserve': '2025-03-15' } });
check('Dec 31: the toggle reads 2026 and 2025', [page.querySelector('[data-cp-year="now"]').text, page.querySelector('[data-cp-year="past"]').text], ['2026', '2025']);
tick('sapphire-reserve:select-hotels', '2026');
tick('bilt-palladium:bilt-cash', '2026');
typeAmt('bilt-palladium:hotel', '2026-H2', '50');
check('…select hotels is on Coming up’s day-of list until used; ticked, it’s gone', comingUp().includes('sapphire-reserve:select-hotels'), false);
const used2026 = app.creditsPageModel().used;
midnight(2027, 1, 1);
check('Jan 1: the toggle reads 2027 and 2026, showing 2027', [page.querySelector('[data-cp-year="now"]').text, page.querySelector('[data-cp-year="past"]').text, page.querySelector('[data-cp-year="now"]').getAttribute('aria-pressed')], ['2027', '2026', 'true']);
check('…select hotels (through Dec 31, 2026) has left this year and the main page', [rowOf('sapphire-reserve:select-hotels'), heldOf('sapphire-reserve:select-hotels')], [undefined, undefined]);
check('…Bilt Cash doesn’t post again on Jan 1 (it lasts 12 months now): the 2026 box, ticked, is still the one on, counted toward 2026', [rowOf('bilt-palladium:bilt-cash').current.key, rowOf('bilt-palladium:bilt-cash').left, rowOf('bilt-palladium:bilt-cash', true).boxes[0].full, rowOf('bilt-palladium:bilt-cash').current.counts], ['2026', 0, true, false]);
check('…half-year: 2027-H1 with nothing used, the $50 stays on 2026-H2', [rowOf('bilt-palladium:hotel').current.key, rowOf('bilt-palladium:hotel').left, rowOf('bilt-palladium:hotel', true).boxes[1].value], ['2027-H1', 200, 50]);
check('…a card year doesn’t change at New Year', [rowOf('sapphire-reserve:travel').current.key, heldOf('sapphire-reserve:travel').period.key], ['A2026-03-15', 'A2026-03-15']);
check('…last year’s total is what it was on Dec 31 (the card year counts where most of it falls)', app.creditsPageModel({ past: true }).used, used2026);
check('…and this year’s starts at nothing', app.creditsPageModel().used, 0);
pastView();
check('…2026 keeps select hotels, ticked; December-ending boxes can still be changed', [pageBox('sapphire-reserve:select-hotels', '2026').checked, pageBox('sapphire-reserve:select-hotels', '2026').disabled], [true, false]);
tick('bilt-palladium:bilt-cash', '2026', false);
check('…unticking last year’s leaves this year’s total alone', [app.creditsPageModel({ past: true }).used, app.creditsPageModel().used], [used2026 - 200, 0]);
pastView(false);
reload();
check('…a reload on Jan 1 keeps last year', rowOf('sapphire-reserve:select-hotels', true).boxes[0].full, true);
at(2028, 1, 1);
reload();
check('…a reload on Jan 1, 2028: 2026’s ticks have gone', state().creditsLog, {});
at(2027, 1, 1);
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2025-12': true, '2026-1': true, '2027-1': true }, 'sapphire-reserve:travel': { 'A2025-03-15': true, 'A2024-03-15': true } } });
check('Two-year retention on Jan 1, 2027: 2026 and 2027 stay, a card year that ran into 2026 too', state().creditsLog, { 'amex-gold:uber': { '2026-1': true, '2027-1': true }, 'sapphire-reserve:travel': { 'A2025-03-15': true } });

// Jun 30 to Jul 1
at(2027, 6, 30, 23, 59);
open({ cards: ['bilt-palladium'] });
typeAmt('bilt-palladium:hotel', '2027-H1', '50');
check('Jun 30: H1’s last day: $150 left, last day today, on Coming up with what’s left', [rowOf('bilt-palladium:hotel').left, rowOf('bilt-palladium:hotel').current.days, comingUp().includes('bilt-palladium:hotel'), heldOf('bilt-palladium:hotel').left], [150, 0, true, 150]);
midnight(2027, 7, 1);
check('Jul 1: H2 with $200, the amount stays on H1, off Coming up', [rowOf('bilt-palladium:hotel').current.key, rowOf('bilt-palladium:hotel').left, rowOf('bilt-palladium:hotel').boxes[0].used, comingUp().includes('bilt-palladium:hotel')], ['2027-H2', 200, 50, false]);

// Feb 28 and Feb 29, 2028, and a fee date of Feb 29
at(2028, 2, 28);
open({ cards: ['amex-gold'] });
check('Feb 28, 2028: February has a day left', [rowOf('amex-gold:uber').current.key, rowOf('amex-gold:uber').current.days], ['2028-2', 1]);
midnight(2028, 2, 29);
check('Feb 29: its last day', [rowOf('amex-gold:uber').current.key, rowOf('amex-gold:uber').current.days, pageBox('amex-gold:uber', '2028-2').disabled], ['2028-2', 0, false]);
midnight(2028, 3, 1);
check('Mar 1: March', rowOf('amex-gold:uber').current.key, '2028-3');
at(2027, 2, 27);
open({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2024-02-29' } });
const cardYear = () => { const b = rowOf('sapphire-reserve:travel').current; return [b.key, app.isoOf(b.end), heldOf('sapphire-reserve:travel').period.key]; };
check('fee date Feb 29: on Feb 27, 2027, the card year began Feb 28, 2026', cardYear(), ['A2026-02-28', '2027-02-27', 'A2026-02-28']);
at(2027, 2, 28);
check('…Feb 28, 2027 starts the next (no Feb 29 that year)', cardYear(), ['A2027-02-28', '2028-02-28', 'A2027-02-28']);
at(2028, 2, 28);
check('…Feb 28, 2028 is its last day', cardYear(), ['A2027-02-28', '2028-02-28', 'A2027-02-28']);
at(2028, 2, 29);
app.renderCredits();
check('…Feb 29, 2028 starts the next, ending Feb 27, 2029', cardYear(), ['A2028-02-29', '2029-02-27', 'A2028-02-29']);
tick('sapphire-reserve:travel', 'A2028-02-29');
reload();
check('…its tick survives a reload', [state().creditsLog['sapphire-reserve:travel'], rowOf('sapphire-reserve:travel').left, heldOf('sapphire-reserve:travel').left], [{ 'A2028-02-29': true }, 0, 0]);
check('…each calendar year has its card years with no gap and one counted', [2027, 2028, 2029].map((y) => boxes('sapphire-reserve', 'travel', y).map((b) => [b.key, b.counts])), [[['A2026-02-28', false], ['A2027-02-28', true]], [['A2027-02-28', false], ['A2028-02-29', true]], [['A2028-02-29', false], ['A2029-02-28', true]]]);

// A fee date still to come
at(2026, 11, 1);
open({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2027-03-15' } });
check('fee date in the future: this card year runs up to it', [rowOf('sapphire-reserve:travel').current.key, app.isoOf(rowOf('sapphire-reserve:travel').current.end), heldOf('sapphire-reserve:travel').period.key], ['A2026-03-15', '2027-03-14', 'A2026-03-15']);
at(2027, 3, 15);
app.renderCredits();
check('…on that day, the next one', [rowOf('sapphire-reserve:travel').current.key, heldOf('sapphire-reserve:travel').period.key], ['A2027-03-15', 'A2027-03-15']);

// A page drawn yesterday, tapped today (asleep through midnight)
at(2026, 10, 31, 23, 59);
open({ cards: ['amex-gold'] });
const stale = pageBox('amex-gold:uber', '2026-10');
at(2026, 11, 1, 0, 1);
stale.checked = true;
stale.dispatch('change');
check('October’s box, tapped just after midnight: October’s, not November’s, and the main page’s November stays unused', [state().creditsLog['amex-gold:uber'], heldOf('amex-gold:uber').used, state().creditsUsed['amex-gold:uber']], [{ '2026-10': true }, false, undefined]);
at(2026, 12, 31, 23, 59);
open({ cards: ['bilt-palladium'] });
const staleAmt = amt('bilt-palladium:hotel', '2026-H2');
at(2027, 1, 1, 0, 1);
staleAmt.value = '40';
staleAmt.dispatch('change');
check('an amount typed across New Year goes on the half-year it was typed for', [state().creditsLog['bilt-palladium:hotel'], heldOf('bilt-palladium:hotel').left], [{ '2026-H2': 40 }, 200]);
at(2027, 1, 31, 23, 59);
open({ cards: ['amex-gold'] });
pastView();
const lastDec = pageBox('amex-gold:uber', '2026-12');
check('December can be ticked up to Jan 31…', lastDec.disabled, false);
at(2027, 2, 1, 0, 1);
lastDec.checked = true;
lastDec.dispatch('change');
check('…tapped after that midnight, it isn’t, and the box goes back', [state().creditsLog['amex-gold:uber'], pageBox('amex-gold:uber', '2026-12').checked, pageBox('amex-gold:uber', '2026-12').disabled], [undefined, false, true]);

// Under a filter across midnight: rows kept since it was picked don't outlast the day
at(2026, 12, 31, 23, 59);
open({ cards: ['bilt-palladium', 'amex-gold'] });
page.querySelector('[data-cp-filter="month"]').dispatch('click');
const dueDec = () => page.querySelectorAll('[data-cp-row]').map((r) => r.dataset.cpRow);
check('Dec 31, Due this month: the half-year credit is due', dueDec().includes('bilt-palladium:hotel'), true);
midnight(2027, 1, 1);
check('…Jan 1: it isn’t any more (it ends in June), and January’s monthly is', [dueDec().includes('bilt-palladium:hotel'), dueDec().includes('amex-gold:uber')], [false, true]);
page.querySelector('[data-cp-filter="all"]').dispatch('click');

// People: another person's tracker coming in with the page open
at(2026, 11, 15);
const person = (id, fields) => app.stored.set(app.storageKey(id), JSON.stringify(app.normalize({ programs: [], ...fields })));
app.people.list.splice(0, app.people.list.length, { id: 'me', name: 'Sam Sample' }, { id: 'p2', name: 'Pat Example' }, { id: 'p3', name: 'New Person' });
person('me', { cards: ['hilton-aspire'] });
person('p2', { cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-11': true } }, creditsUsed: { 'amex-gold:uber': '2026-11' } });
person('p3', { cards: [] });
app.setState(app.normalize(JSON.parse(app.stored.get(app.storageKey('me')))));
page.hidden = true; app.location.hash = '';
openPage();
app.renderCredits();
page.querySelector('[data-cp-filter="unused"]').dispatch('click');
pastView();
check('Sam holds none of the five: Add your cards, looking at last year', [!!page.querySelector('.cp-add'), page.querySelector('[data-cp-year="past"]').getAttribute('aria-pressed')], [true, 'true']);
app.switchPerson('p2');
check('…to Pat with the page open: Pat’s card, no chips, this year, All', [page.querySelectorAll('[data-cp-card]').map((c) => c.dataset.cpCard), !!page.querySelector('.cp-add'), page.querySelector('[data-cp-year="now"]').getAttribute('aria-pressed'), page.querySelector('[data-cp-filter="all"]').getAttribute('aria-pressed')], [['amex-gold'], false, 'true', 'true']);
check('…Pat’s own tick on both pages', [pageBox('amex-gold:uber', '2026-11').checked, heldOf('amex-gold:uber').used], [true, true]);
app.switchPerson('p3');
check('New person: the chips, none added', page.querySelectorAll('[data-cp-add-card]').map((b) => b.text.startsWith('+')), [true, true, true, true, true]);
page.querySelector('[data-cp-add-card="amex-gold"]').dispatch('click');
check('…a chip adds the card to them, with no ticks of Pat’s', [state().cards, pageBox('amex-gold:uber', '2026-11').checked, JSON.parse(app.stored.get(app.storageKey('p2'))).cards], [['amex-gold'], false, ['amex-gold']]);
tick('amex-gold:uber', '2026-10');
check('…and their tick is theirs, Pat’s unchanged', [state().creditsLog, JSON.parse(app.stored.get(app.storageKey('p2'))).creditsLog], [{ 'amex-gold:uber': { '2026-10': true } }, { 'amex-gold:uber': { '2026-11': true } }]);
app.switchPerson('p2');
check('Back to Pat: their own tick, and no chips left over from the last person', [pageBox('amex-gold:uber', '2026-11').checked, pageBox('amex-gold:uber', '2026-10').checked, !!page.querySelector('.cp-add')], [true, false, false]);
app.switchPerson('me');
check('Sam again: the Hilton Aspire’s page, chips offered', [page.querySelectorAll('[data-cp-card]').map((c) => c.dataset.cpCard), !!page.querySelector('.cp-add')], [['hilton-aspire'], true]);
app.people.list.splice(0, app.people.list.length, { id: 'me', name: '' });
app.closeCreditsPage();

// Last year's view doesn't outlast the cards: no year switch to come back with
at(2026, 11, 15);
open({ cards: ['hilton-aspire'] });
pastView();
state().cards = [];
app.renderCredits();
page.querySelector('[data-cp-add-card="amex-gold"]').dispatch('click');
check('Looking at last year, every card taken off, one added back: this year', [page.querySelector('[data-cp-year="now"]').getAttribute('aria-pressed'), !!pageBox('amex-gold:uber', '2026-11')], ['true', true]);
check('A restored backup or a link starts the page over too, as switching person does', [piece('  function switchPerson', '  function saveRename').includes('resetCreditsView()'), piece('  function replaceTracker', '  /* ---------- Send to another device').includes('resetCreditsView()')], [true, true]);

// An old backup, a damaged one, and what comes through a link
at(2026, 11, 15);
open({ cards: ['amex-gold'], creditsUsed: { 'amex-gold:uber': '2026-11', 'amex-gold:dining': '2026-10' }, creditsUsedOn: { 'amex-gold:uber': '2026-11-02' } });
check('an old backup (no creditsLog): its marks are ticks', [state().creditsLog, pageBox('amex-gold:uber', '2026-11').checked, heldOf('amex-gold:uber').used, heldOf('amex-gold:dining').used], [{ 'amex-gold:uber': { '2026-11': true }, 'amex-gold:dining': { '2026-10': true } }, true, true, false]);
for (const junk of ['oops', 5, null, true, [], [['amex-gold:uber', {}]]]) {
  setup({ cards: ['amex-gold'], creditsLog: junk });
  check(`creditsLog ${JSON.stringify(junk)}: nothing kept`, state().creditsLog, {});
}
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': 'x', 'amex-gold:dining': ['2026-11'], 'amex-gold:resy': { '2026-11': 'yes', '2026-10': -5, '2026-9': 0, '2026-8': 1e9, '2026-7': null, '2026-6': [1], '2026-5': false, 'not a key': true, '2026-13': true, '2026-01': true } } });
check('wrong types, huge or negative amounts, malformed keys: dropped', state().creditsLog, {});
setup({ cards: ['amex-gold'], creditsLog: { 'made-up-card:x': { '2026-11': true }, 'amex-gold': { '2026-11': true }, ':x': { '2026-11': true } } });
check('an unknown card, or no credit in the key: dropped', state().creditsLog, {});
const pollute = `{"programs":[],"cards":["amex-gold"],"creditsLog":{"__proto__":{"2026-11":true,"polluted":true},"constructor:x":{"2026-11":true},"amex-gold:uber":{"__proto__":{"polluted":true},"constructor":true,"2026-11":true}},"creditsUsed":{"__proto__":"2026-11"},"creditsPartOn":{"__proto__":"2026-11-01"},"creditsSkipped":{"__proto__":true,"amex-gold:__proto__":true},"customCredits":{"__proto__":[["c1","Bad",1,"month"]]}}`;
app.setState(app.normalize(JSON.parse(pollute)));
check('"__proto__" keys: nothing polluted, the good tick kept', [state().creditsLog, ({}).polluted, vm.runInContext('({}).polluted || ({})["2026-11"]', ctx), Object.getPrototypeOf(state().creditsLog) === Object.getPrototypeOf(state().creditsUsed)], [{ 'amex-gold:uber': { '2026-11': true } }, undefined, undefined, true]);
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-11': 1e5, '2026-10': 3 } } });
check('a huge amount on a $10 credit counts as the $10, on both pages', [rowOf('amex-gold:uber').current.used, rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used, heldOf('amex-gold:uber').left, app.creditsPageModel().used], [10, 0, true, 0, 13]);

// Ticks for periods not started yet (a damaged file, or a clock that was wrong) count for nothing until they start
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-12': true, '2099-1': true, 'A2099-01-01': true, 2099: true }, 'amex-gold:resy': { 2027: true } } });
check('a tick on December in November: not counted, not shown ticked', [app.creditsPageModel().used, app.creditsPageModel().cards[0].used, pageBox('amex-gold:uber', '2026-12').checked, boxes('amex-gold', 'uber')[11].used], [0, 0, false, 0]);
check('…years ahead are junk and go; next year’s stays', Object.keys(state().creditsLog['amex-gold:uber']), ['2026-12']);
at(2026, 12, 2);
app.renderCredits();
check('…when December comes, it counts, on both pages alike', [rowOf('amex-gold:uber').current.full, heldOf('amex-gold:uber').used, app.creditsPageModel().used, app.heldCredits().filter((x) => !x.used).reduce((n, x) => n + x.left, 0) === app.creditsPageModel().available], [true, true, 10, true]);
at(2026, 11, 15);

// The two pages keep one record: a tick is "used" on both however it got there
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-11': true } } });
check('a tick with no main-page mark (a hand-edited file): used on both', [rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used, heldOf('amex-gold:uber').left], [0, true, 0]);
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-11': 4 } }, creditsUsed: { 'amex-gold:uber': '2026-11' } });
check('a main-page mark over a part-used amount: used on both', [rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used, heldOf('amex-gold:uber').left, state().creditsLog['amex-gold:uber']], [0, true, 0, { '2026-11': true }]);
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-10': true } } });
tick('amex-gold:uber', '2026-10', false);
tick('amex-gold:uber', '2026-11');
shown.toasts.at(-1).undo();
check('October unticked, November ticked, then Undo: October back, November still used on both pages, and marked', [state().creditsLog['amex-gold:uber'], rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used, state().creditsUsed['amex-gold:uber']], [{ '2026-11': true, '2026-10': true }, 0, true, '2026-11']);
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-10': true, '2026-11': true } }, creditsUsed: { 'amex-gold:uber': '2026-11' } });
tick('amex-gold:uber', '2026-10', false);
app.document.querySelector('#credits-list').querySelector('[data-credit-use="amex-gold:uber"]').dispatch('click');
shown.toasts.at(-1).undo();
check('October unticked, November unmarked on the main page, then Undo: October back, November stays unmarked on both', [state().creditsLog['amex-gold:uber'], rowOf('amex-gold:uber').left, heldOf('amex-gold:uber').used, state().creditsUsed['amex-gold:uber']], [{ '2026-10': true }, 10, false, undefined]);
reload();
check('…and a reload doesn’t tick November again', state().creditsLog['amex-gold:uber'], { '2026-10': true });

// A damaged added credit
setup({ cards: ['amex-gold'], customCredits: { 'amex-gold': [['c1', 'Zero', 0, 'month'], ['c2', 'Huge', 1e308, 'year'], ['c3', 'Fine', 5, 'month']] } });
check('added credits: $0 ones go, huge ones stop at $100,000', state().customCredits['amex-gold'], [['c2', 'Huge', 100000, 'year'], ['c3', 'Fine', 5, 'month']]);

// Off and back on
open({ cards: ['amex-gold'], renewals: {} });
tick('amex-gold:uber', '2026-11');
tick('amex-gold:uber', '2026-3');
typeAmt('amex-gold:resy', '2026-H2', '30');
const ticksBefore = JSON.stringify(state().creditsLog);
app.removeCard(state(), 'amex-gold');
app.renderCredits();
check('a card taken off: gone from the totals and the page', [app.creditsPageModel().used, app.creditsPageModel().available, app.heldCredits().length], [0, 0, 0]);
reload();
app.addHeldCard('amex-gold');
app.renderCredits();
check('…added back (even after a reload): its ticks and amounts, on both pages', [JSON.stringify(state().creditsLog) === ticksBefore, heldOf('amex-gold:uber').used, rowOf('amex-gold:resy').left, heldOf('amex-gold:resy').left], [true, true, rowOf('amex-gold:resy').current.amount - 30, rowOf('amex-gold:resy').current.amount - 30]);

// A card not on the five-card list
at(2026, 12, 20);
open({ cards: ['hilton-aspire'] });
const aspire = app.creditsPageModel().cards[0];
check('Hilton Aspire: its own credits and boxes', aspire.rows.map((r) => [r.key, r.boxes.length, r.current.key]), [['hilton-aspire:resort', 2, '2026-H2'], ['hilton-aspire:flight', 4, '2026-Q4'], ['hilton-aspire:clear', 1, '2026']]);
check('…the year’s total is $400 + $200 + $219', aspire.total, 819);
check('…what’s left, Expiring soon, Coming up and the main page line up', [app.creditsPageModel().available, app.creditsPageModel().soon.map((s) => s.key).sort(), comingUp().sort(), app.document.querySelector('#c-meta').text], [469, ['hilton-aspire:clear', 'hilton-aspire:flight', 'hilton-aspire:resort'], ['hilton-aspire:clear', 'hilton-aspire:flight', 'hilton-aspire:resort'], '$469 unused right now']);
typeAmt('hilton-aspire:resort', '2026-H2', '120');
tick('hilton-aspire:flight', '2026-Q4');
check('…a part-used amount and a tick, everywhere', [app.creditsPageModel().used, app.creditsPageModel().available, heldOf('hilton-aspire:resort').left, comingUp().sort(), app.document.querySelector('#c-meta').text, page.querySelector('.cp-card-sum').text], [170, 299, 80, ['hilton-aspire:clear', 'hilton-aspire:resort'], '$299 unused right now', '$170 used of $819 this year']);
const aspireFirst = page.querySelector('[data-cp-card="hilton-aspire"]');
check('…with no fee-date field (none of its credits runs on a card year)', !!aspireFirst.querySelector('[data-cp-renewal]'), false);

// Coming up goes to the credit's row on the page
at(2026, 12, 20);
setup({ cards: ['hilton-aspire'] });
app.closeCreditsPage(); app.location.hash = '';
app.renderCredits();
app.renderUpcoming();
const upBtn = app.document.querySelector('#up-list').querySelector('[data-credit-row="hilton-aspire:clear"]');
check('Coming up lists a credit ending soon, for the row it goes to', [!!upBtn, upBtn.text.includes('Use your $219 CLEAR+')], [true, true]);
shown.scrolled.length = 0;
upBtn.dispatch('click');
const upRow = page.querySelector('[data-cp-row="hilton-aspire:clear"]');
check('…tapped: that row scrolled to and highlighted, its box ready, on the same page', [page.hidden, app.location.hash, shown.scrolled.at(-1) === upRow, upRow.classList.contains('cp-flash'), app.document.activeElement === pageBox('hilton-aspire:clear', '2026')], [false, '', true, true, true]);
pageBox('hilton-aspire:clear', '2026').checked = true;
pageBox('hilton-aspire:clear', '2026').dispatch('change');
check('…ticked there, it leaves Coming up', comingUp().includes('hilton-aspire:clear'), false);
app.closeCreditsPage();
open({ cards: ['hilton-aspire'] });
page.querySelector('[data-cp-filter="month"]').dispatch('click');
app.closeCreditsPage();
app.renderUpcoming();
const filtered = app.document.querySelector('#up-list').querySelector('[data-credit-row="hilton-aspire:flight"]');
filtered.dispatch('click');
check('…with a filter left on that hides nothing it needs: still its row', page.querySelector('[data-cp-row="hilton-aspire:flight"]').classList.contains('cp-flash'), true);
page.querySelector('[data-cp-filter="all"]').dispatch('click');
app.closeCreditsPage();

// Every total agrees, whatever happens: the two tiles, the per-card lines, the main page's Card credits, Coming up
const disagreements = () => {
  const m = app.creditsPageModel();
  const held = app.heldCredits();
  const rows = m.cards.flatMap((c) => c.rows);
  const bad = [];
  const say = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${what}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };
  for (const r of rows) {
    if (!r.current) continue;
    const x = held.find((h) => h.key === r.key);
    say(`${r.key} on the main page`, !!x, true);
    if (!x) continue;
    say(`${r.key} period`, x.period.key, r.current.key);
    say(`${r.key} left`, x.left, r.left);
    say(`${r.key} used`, x.used, r.current.full);
    say(`${r.key} amount`, x.credit.amount, r.current.amount);
    say(`${r.key} days`, x.days, r.current.days);
  }
  for (const x of held) if (!x.skipped && !x.used) say(`${x.key} has a row`, rows.some((r) => r.key === x.key && r.current), true);
  const unused = held.filter((x) => !x.used && !x.skipped).reduce((n, x) => n + x.left, 0);
  say('still available', app.cents(unused), m.available);
  say('used this year', app.cents(rows.reduce((n, r) => n + r.boxes.reduce((b, box) => b + (box.counts ? box.used : 0), 0), 0)), m.used);
  say('the cards’ used', app.cents(m.cards.reduce((n, c) => n + c.used, 0)), m.used);
  for (const c of m.cards) if (c.used > c.total + 0.001) bad.push(`${c.card.id} used ${c.used} of ${c.total}`);
  for (const r of rows) for (const b of r.boxes) if (b.phase === 'future' && b.used) bad.push(`${r.key} ${b.key} counted before it starts`);
  say('Coming up', comingUp().sort(), rows.filter((r) => r.left > 0 && r.dated && r.credit.period !== 'month' && r.current.days <= 21).map((r) => r.key).sort());
  if (!page.hidden && !page.querySelector('[data-cp-year="past"][aria-pressed="true"]') && m.cards.length) {
    const tiles = page.querySelectorAll('.cp-tile-v').map((t) => t.text);
    say('the tiles', tiles, [app.money(m.used), app.money(m.available)]);
    for (const c of m.cards) {
      const line = page.querySelector(`[data-cp-card="${c.card.id}"] .cp-card-sum`);
      if (c.total) say(`${c.card.id} line`, line && line.text, `${app.money(c.used)} used of ${app.money(c.total)} this year`);
    }
    if (held.length) say('Card credits', app.document.querySelector('#c-meta').text, `${app.money(unused)} unused right now`);
  }
  return bad;
};
const seeded = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const FUZZ_CARDS = ['sapphire-reserve', 'amex-platinum', 'amex-gold', 'delta-gold', 'bilt-palladium', 'hilton-aspire', 'aadvantage-executive', 'united-club', 'sapphire-preferred', 'ihg-premier', 'bilt-blue'];
const FUZZ_FEES = ['2025-03-15', '2024-02-29', '2026-12-31', '2027-01-01', '2023-07-02', '2025-07-03', '2028-02-29', '2026-11-30', '2030-06-15'];
const FUZZ_DAYS = [[2026, 10, 31], [2026, 11, 30], [2026, 12, 31], [2027, 1, 1], [2027, 6, 30], [2028, 2, 28], [2028, 2, 29], [2027, 2, 27], [2026, 12, 1], [2027, 12, 31]];
const FUZZ_RUNS = Number(process.env.CREDITPAGE_FUZZ) || 15; // CREDITPAGE_FUZZ=500 for a long look
let fuzzFailure = null;
for (let seed = 1; seed <= FUZZ_RUNS && !fuzzFailure; seed++) {
  const r = seeded(seed * 7919);
  const pick = (a) => a[Math.floor(r() * a.length)];
  at(...pick(FUZZ_DAYS));
  const cards = [...new Set([pick(FUZZ_CARDS), pick(FUZZ_CARDS), pick(FUZZ_CARDS)])];
  const renewals = Object.fromEntries(cards.filter(() => r() < 0.6).map((c) => [c, pick(FUZZ_FEES)]));
  open({ cards, renewals, customCredits: r() < 0.3 ? { [cards[0]]: [['cmade1', 'Made-up credit', pick([12.95, 60]), pick(['month', 'quarter', 'half', 'year'])]] } : {} });
  app.forgetCreditParts();
  const did = [];
  const onPage = (sel) => page.querySelectorAll(sel).filter((el) => !el.disabled);
  const moves = {
    tick() { const els = onPage('[data-cp-box]'); if (!els.length) return; const el = pick(els); did.push(`tick ${el.dataset.cpBox} ${el.dataset.cpPeriod}`); el.checked = !el.checked; el.dispatch('change'); },
    amount() { const els = onPage('[data-cp-amt]'); if (!els.length) return; const el = pick(els); el.value = pick(['', '10', '0.5', '49.99', '100000', '12,50', '300', 'abc']); did.push(`type ${el.value} ${el.dataset.cpAmt}`); el.dispatch('change'); },
    mark() { const els = app.document.querySelector('#credits-list').querySelectorAll('[data-credit-use]'); if (!els.length) return; const el = pick(els); did.push(`mark ${el.dataset.creditUse}`); el.dispatch('click'); },
    undo() { const t = shown.toasts.at(-1); if (t && t.undo) { did.push(`undo ${t.message}`); t.undo(); } shown.toasts.length = 0; },
    skip() { const els = onPage('[data-cp-skip]'); if (!els.length) return; const el = pick(els); did.push(`skip ${el.dataset.cpSkip}`); el.dispatch('click'); },
    unskip() { const els = onPage('[data-cp-unskip]'); if (!els.length) return; const el = pick(els); did.push(`track ${el.dataset.cpUnskip}`); el.dispatch('click'); },
    fee() { if (r() > 0.3) return; const els = onPage('[data-cp-renewal]'); if (!els.length) return; const el = pick(els); el.value = pick(['', ...FUZZ_FEES]); did.push(`fee ${el.dataset.cpRenewal} ${el.value}`); el.dispatch('change'); app.renderCredits(); },
    clock() { const days = pick([1, 1, 1, 3, 15, 31, 45]); now = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12); did.push(`to ${app.isoOf(now)}`); app.renderCredits(); },
    reload() {
      const seen = () => JSON.stringify([false, true].map((past) => app.creditsPageModel({ past }).cards.flatMap((c) => c.rows.map((row) => [row.key, row.left, row.boxes.map((b) => [b.key, b.used])]))));
      const before = seen();
      did.push('reload');
      app.setState(app.normalize(JSON.parse(JSON.stringify(state()))));
      app.forgetCreditParts();
      app.renderCredits();
      if (seen() !== before) throw new Error('a reload changed what’s shown');
    },
    lastYear() { const el = page.querySelector('[data-cp-year="past"]'); if (!el) return; el.dispatch('click'); const els = onPage('[data-cp-box]'); if (els.length) { const b = pick(els); did.push(`last year ${b.dataset.cpBox} ${b.dataset.cpPeriod}`); b.checked = !b.checked; b.dispatch('change'); } page.querySelector('[data-cp-year="now"]').dispatch('click'); },
    offAndOn() { const c = pick(state().cards.length ? state().cards : cards); const log = JSON.stringify(state().creditsLog); did.push(`off and on ${c}`); app.removeCard(state(), c); app.renderCredits(); app.addHeldCard(c); app.renderCredits(); if (JSON.stringify(state().creditsLog) !== log) throw new Error('taking a card off changed its ticks'); },
  };
  const names = ['tick', 'tick', 'tick', 'amount', 'mark', 'undo', 'skip', 'unskip', 'fee', 'clock', 'clock', 'reload', 'lastYear', 'offAndOn'];
  for (let step = 0; step < 40 && !fuzzFailure; step++) {
    try {
      moves[pick(names)]();
      app.renderUpcoming();
      const bad = disagreements();
      if (bad.length) fuzzFailure = { seed, bad: bad.slice(0, 3), did: did.slice(-6), day: app.isoOf(now) };
    } catch (err) {
      fuzzFailure = { seed, threw: err.message, did: did.slice(-6), day: app.isoOf(now) };
    }
  }
  app.closeCreditsPage();
  page.hidden = true; app.location.hash = '';
}
check(`fuzz: ${FUZZ_RUNS} trackers, 40 random ticks, amounts, marks, undos, skips, fee dates, reloads and new days each: every total agrees`, fuzzFailure, null);

// The same with a hand-damaged file: anything may be in it, nothing throws, and the totals still agree
const JUNK = [true, false, null, 0, -1, 5, 12.5, 1e5, 1e9, 0.001, 0.004, 0.005, 'x', '', [], {}, [true], { a: 1 }];
const JUNK_KEYS = ['2026-11', '2026-Q4', '2026-H2', '2026', 'A2026-03-15', '2027-1', '2030', '2026-13', 'A2026-02-30', '__proto__', 'constructor', 'toString', ''];
const JUNK_CREDITS = ['amex-gold:uber', 'amex-gold:dining', 'amex-gold:made-up', 'sapphire-reserve:travel', 'made-up:uber', 'constructor:x', 'amex-gold', '', '__proto__'];
fuzzFailure = null;
for (let seed = 1; seed <= FUZZ_RUNS * 2 && !fuzzFailure; seed++) {
  const r = seeded(seed * 104729);
  const pick = (a) => a[Math.floor(r() * a.length)];
  at(...pick(FUZZ_DAYS));
  const log = {};
  for (let i = 0; i < 6; i++) { const periods = {}; for (let j = 0; j < 4; j++) Object.defineProperty(periods, pick(JUNK_KEYS), { value: pick(JUNK), enumerable: true, writable: true, configurable: true }); Object.defineProperty(log, pick(JUNK_CREDITS), { value: r() < 0.85 ? periods : pick(JUNK), enumerable: true, writable: true, configurable: true }); }
  const fields = JSON.parse(JSON.stringify({ cards: ['amex-gold', 'sapphire-reserve', 'made-up'], creditsLog: log, creditsUsed: r() < 0.5 ? { 'amex-gold:uber': pick(JUNK_KEYS), 'sapphire-reserve:travel': pick(JUNK) } : pick(JUNK), creditsUsedOn: { 'amex-gold:uber': pick(JUNK) }, creditsPartOn: { 'amex-gold:uber': pick(JUNK) }, creditsSkipped: pick(JUNK), customCredits: r() < 0.5 ? { 'amex-gold': [['c1', 'Added', pick(JUNK), pick(['month', 'year', 'nope'])], pick(JUNK)] } : pick(JUNK), renewals: r() < 0.5 ? { 'sapphire-reserve': pick(['2025-03-15', '2024-02-29', 'nope', 5]) } : pick(JUNK) }));
  try {
    open(fields);
    const cleaned = (st) => JSON.stringify([st.creditsLog, st.creditsPartOn, st.customCredits]);
    const once = cleaned(state());
    const bad = disagreements();
    const again = cleaned(app.normalize(JSON.parse(JSON.stringify(state()))));
    if (bad.length || once !== again) fuzzFailure = { seed, bad: bad.slice(0, 3), once, again, day: app.isoOf(now) };
    app.closeCreditsPage();
  } catch (err) {
    fuzzFailure = { seed, threw: err.message, fields };
  }
  page.hidden = true; app.location.hash = '';
}
check('damaged files: nothing throws, the totals agree, and cleaning twice changes nothing', [fuzzFailure, ({}).polluted], [null, undefined]);
now = new Date(2026, 9, 31, 12);

// Undo over a box changed since: the two pages and a reload must agree, whatever moved in the meantime
const metaLine = () => app.document.querySelector('#c-meta').text;
const useBtn = (key) => app.document.querySelector('#credits-list').querySelector(`[data-credit-use="${key}"]`);
const asideLog = (key) => ({ log: state().creditsLog[key], mark: state().creditsUsed[key], part: state().creditsPartOn[key] });
at(2026, 11, 15);
for (const [how, use] of [['ticks the box', () => tick('hilton-aspire:resort', '2026-H2')], ['taps Mark used', () => useBtn('hilton-aspire:resort').dispatch('click')]]) {
  open({ cards: ['hilton-aspire'] });
  typeAmt('hilton-aspire:resort', '2026-H2', '120');
  typeAmt('hilton-aspire:resort', '2026-H2', '');
  const clearedToast = shown.toasts.at(-1);
  use();
  clearedToast.undo();
  check(`an amount cleared, then ${how}, then Undo: the amount back and no mark over it`, asideLog('hilton-aspire:resort'), { log: { '2026-H2': 120 }, mark: undefined, part: '2026-11-15' });
  check('…$80 left on both pages', [rowOf('hilton-aspire:resort').left, heldOf('hilton-aspire:resort').left, heldOf('hilton-aspire:resort').used, metaLine()], [80, 80, false, '$349 unused right now']);
  reload();
  app.renderCredits();
  check('…and a reload changes nothing', [asideLog('hilton-aspire:resort').log, rowOf('hilton-aspire:resort').left, heldOf('hilton-aspire:resort').left, metaLine()], [{ '2026-H2': 120 }, 80, 80, '$349 unused right now']);
}
open({ cards: ['hilton-aspire'], creditsLog: { 'hilton-aspire:resort': { '2026-H1': true, '2026-H2': 120 } }, creditsUsed: { 'hilton-aspire:resort': '2026-H1' } });
typeAmt('hilton-aspire:resort', '2026-H2', '');
const overOldMark = shown.toasts.at(-1);
tick('hilton-aspire:resort', '2026-H2');
overOldMark.undo();
check('…with an older box marked before: that mark comes back too', asideLog('hilton-aspire:resort').log, { '2026-H1': true, '2026-H2': 120 });
check('…on it', state().creditsUsed['hilton-aspire:resort'], '2026-H1');
open({ cards: ['hilton-aspire'], creditsLog: { 'hilton-aspire:resort': { '2026-H1': true, '2026-H2': 120 } }, creditsUsed: { 'hilton-aspire:resort': '2026-H1' } });
typeAmt('hilton-aspire:resort', '2026-H2', '');
const overGoneMark = shown.toasts.at(-1);
tick('hilton-aspire:resort', '2026-H1', false);
tick('hilton-aspire:resort', '2026-H2');
overGoneMark.undo();
reload();
check('…unless that box has been unticked since: a reload doesn’t tick it again', state().creditsLog['hilton-aspire:resort'], { '2026-H2': 120 });

open({ cards: ['hilton-aspire'], creditsLog: { 'hilton-aspire:resort': { '2026-H1': true, '2026-H2': 120 } }, creditsPartOn: { 'hilton-aspire:resort': '2026-11-02' } });
tick('hilton-aspire:resort', '2026-H1', false);
const pastBoxToast = shown.toasts.at(-1);
typeAmt('hilton-aspire:resort', '2026-H2', '');
pastBoxToast.undo();
check('an earlier box unticked, this period’s amount cleared, then Undo: no day left behind for an amount that’s gone', asideLog('hilton-aspire:resort'), { log: { '2026-H1': true }, mark: undefined, part: undefined });
open({ cards: ['hilton-aspire'], creditsLog: { 'hilton-aspire:resort': { '2026-H1': true } } });
tick('hilton-aspire:resort', '2026-H1', false);
const pastBoxToast2 = shown.toasts.at(-1);
typeAmt('hilton-aspire:resort', '2026-H2', '120');
pastBoxToast2.undo();
check('…an amount typed instead: it keeps its day', asideLog('hilton-aspire:resort'), { log: { '2026-H2': 120, '2026-H1': true }, mark: undefined, part: '2026-11-15' });

// Undo after the fee date has moved: the tick goes to the card year holding it now, not a box that's gone
const SR_TRAVEL = 'sapphire-reserve:travel';
const feeTo = (date) => { const el = page.querySelector('[data-cp-renewal="sapphire-reserve"]'); el.value = date; el.dispatch('change'); };
const undoAfterFee = (first, date) => {
  open({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
  first();
  const toast = shown.toasts.at(-1);
  feeTo(date);
  toast.undo();
  app.renderCredits();
};
undoAfterFee(() => { tick(SR_TRAVEL, 'A2026-03-15'); tick(SR_TRAVEL, 'A2026-03-15', false); }, '2025-06-20');
check('unticked, the fee date changed, then Undo: the tick is on the card year holding it now', [state().creditsLog[SR_TRAVEL], state().creditsUsed[SR_TRAVEL]], [{ 'A2026-06-20': true }, 'A2026-06-20']);
check('…its box ticked, used on both pages', [pageBox(SR_TRAVEL, 'A2026-06-20').checked, rowOf(SR_TRAVEL).left, heldOf(SR_TRAVEL).used, heldOf(SR_TRAVEL).left], [true, 0, true, 0]);
reload();
check('…and a reload changes nothing', [state().creditsLog[SR_TRAVEL], heldOf(SR_TRAVEL).used], [{ 'A2026-06-20': true }, true]);
undoAfterFee(() => { typeAmt(SR_TRAVEL, 'A2026-03-15', '120'); typeAmt(SR_TRAVEL, 'A2026-03-15', ''); }, '2025-06-20');
check('…an amount cleared the same way: the amount, and its day', [state().creditsLog[SR_TRAVEL], state().creditsUsed[SR_TRAVEL], state().creditsPartOn[SR_TRAVEL], rowOf(SR_TRAVEL).left, heldOf(SR_TRAVEL).left], [{ 'A2026-06-20': 120 }, undefined, '2026-07-15', 180, 180]);
undoAfterFee(() => { tick(SR_TRAVEL, 'A2026-03-15'); tick(SR_TRAVEL, 'A2026-03-15', false); }, '');
check('…the fee date cleared: on the calendar year', [state().creditsLog[SR_TRAVEL], state().creditsUsed[SR_TRAVEL], heldOf(SR_TRAVEL).used], [{ 2026: true }, '2026', true]);
open({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' } });
tick(SR_TRAVEL, 'A2026-03-15');
tick(SR_TRAVEL, 'A2026-03-15', false);
const roundTrip = shown.toasts.at(-1);
feeTo('2025-06-20');
feeTo('2025-03-15');
roundTrip.undo();
check('…changed and changed back: where it was', [state().creditsLog[SR_TRAVEL], state().creditsUsed[SR_TRAVEL], state().renewals['sapphire-reserve']], [{ 'A2026-03-15': true }, 'A2026-03-15', '2025-03-15']);
open({ cards: ['sapphire-reserve'], renewals: { 'sapphire-reserve': '2025-03-15' }, creditsLog: { 'sapphire-reserve:select-hotels': { 2026: true } }, creditsUsed: { 'sapphire-reserve:select-hotels': '2026' }, creditsUsedOn: { 'sapphire-reserve:select-hotels': '2026-05-01' } });
tick('sapphire-reserve:select-hotels', '2026', false);
const notCardYear = shown.toasts.at(-1);
feeTo('2025-06-20');
notCardYear.undo();
check('…a calendar-year credit on that card just comes back', [state().creditsLog['sapphire-reserve:select-hotels'], state().creditsUsed['sapphire-reserve:select-hotels'], state().creditsUsedOn['sapphire-reserve:select-hotels'], state().renewals['sapphire-reserve']], [{ 2026: true }, '2026', '2026-05-01', '2025-06-20']);

// Amounts under half a cent are $0 once rounded, so they're dropped like $0, not kept as $0
at(2026, 12, 20);
for (const tiny of [0.001, 0.004]) {
  setup({ cards: ['amex-gold'], customCredits: { 'amex-gold': [['c1', 'Tiny', tiny, 'year'], ['c2', 'Fine', 5, 'month']] } });
  check(`an added credit of ${tiny}: gone at the first cleaning`, state().customCredits['amex-gold'], [['c2', 'Fine', 5, 'month']]);
  check('…not on either page, and nothing to use in Coming up', [!!heldOf('amex-gold:c1'), comingUp().includes('amex-gold:c1')], [false, false]);
  setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-11': tiny } } });
  check(`a log amount of ${tiny}: gone at the first cleaning`, state().creditsLog, {});
}
setup({ cards: ['amex-gold'], customCredits: { 'amex-gold': [['c1', 'Tiny', 0.005, 'year']] }, creditsLog: { 'amex-gold:resy': { '2026-H2': 0.005 } }, creditsPartOn: { 'amex-gold:resy': '2026-11-02' } });
check('half a cent rounds up to a cent: kept', [state().customCredits['amex-gold'], state().creditsLog, state().creditsPartOn], [[['c1', 'Tiny', 0.01, 'year']], { 'amex-gold:resy': { '2026-H2': 0.01 } }, { 'amex-gold:resy': '2026-11-02' }]);
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:resy': { '2026-H2': 0.001 } }, creditsPartOn: { 'amex-gold:resy': '2026-11-02' } });
check('…and an amount that goes takes its day with it', state().creditsPartOn, {});
const cleanTwice = { programs: [], cards: ['amex-gold'], customCredits: { 'amex-gold': [['c1', 'Tiny', 0.001, 'month']] }, creditsLog: { 'amex-gold:uber': { '2026-11': 0.001, '2026-10': 3.333 } } };
const onceCleaned = app.normalize(cleanTwice);
const twiceCleaned = app.normalize(JSON.parse(JSON.stringify(onceCleaned)));
check('…cleaning twice changes nothing', [twiceCleaned.customCredits, twiceCleaned.creditsLog], [onceCleaned.customCredits, onceCleaned.creditsLog]);

// A credit crowded with valid-looking periods by a damaged file: what you do on it still survives a reload
at(2026, 11, 15);
const CROWD = [...Array.from({ length: 12 }, (_, i) => `2025-${i + 1}`), ...Array.from({ length: 12 }, (_, i) => `2026-${i + 1}`), '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4', '2026-H1', '2026-H2', ...Array.from({ length: 9 }, (_, i) => `A2026-0${i + 1}-01`), 'A2026-10-01', 'A2026-11-01'];
const crowdOf = (...without) => Object.fromEntries(CROWD.filter((k) => !without.includes(k)).map((k) => [k, true]));
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': crowdOf() } });
check('at most 40 periods a credit, the earliest written going first', [Object.keys(state().creditsLog['amex-gold:uber']).length, '2025-1' in state().creditsLog['amex-gold:uber'], 'A2026-11-01' in state().creditsLog['amex-gold:uber']], [40, false, true]);
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': crowdOf('2026-11') } });
useBtn('amex-gold:uber').dispatch('click');
check('Mark used on a crowded credit: used', heldOf('amex-gold:uber').used, true);
reload();
app.renderCredits();
check('…still used after a reload, on both pages', [heldOf('amex-gold:uber').used, rowOf('amex-gold:uber').left, state().creditsLog['amex-gold:uber']['2026-11'], Object.keys(state().creditsLog['amex-gold:uber']).length], [true, 0, true, 40]);
const crowdedOnce = JSON.stringify(state().creditsLog);
reload();
check('…and again', JSON.stringify(state().creditsLog), crowdedOnce);
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-11': 3, ...crowdOf('2026-11') } }, creditsUsed: { 'amex-gold:uber': '2026-11' } });
check('a mark written first still stays, as a tick', [state().creditsLog['amex-gold:uber']['2026-11'], Object.keys(state().creditsLog['amex-gold:uber']).length], [true, 40]);
setup({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': crowdOf('2026-11') }, creditsUsed: { 'amex-gold:uber': '2026-11' } });
check('a mark with nothing logged takes a place too, never the 41st', [state().creditsLog['amex-gold:uber']['2026-11'], Object.keys(state().creditsLog['amex-gold:uber']).length], [true, 40]);
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': crowdOf('2026-10', '2026-11') } });
tick('amex-gold:uber', '2026-10');
reload();
check('a past box ticked on a crowded credit (no mark there): still ticked after a reload', state().creditsLog['amex-gold:uber']['2026-10'], true);
open({ cards: ['hilton-aspire'], creditsLog: { 'hilton-aspire:resort': crowdOf('2026-H2') } });
typeAmt('hilton-aspire:resort', '2026-H2', '120');
reload();
check('an amount typed on a crowded credit: still there after a reload', [state().creditsLog['hilton-aspire:resort']['2026-H2'], heldOf('hilton-aspire:resort').left], [120, 80]);
const crowdedCard = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`amex-gold:junk${i}`, { '2026-11': true }]));
open({ cards: ['amex-gold'], creditsLog: crowdedCard });
check('at most 60 credits a card, the earliest written going first', [Object.keys(state().creditsLog).length, 'amex-gold:junk0' in state().creditsLog, 'amex-gold:junk69' in state().creditsLog], [60, false, true]);
useBtn('amex-gold:uber').dispatch('click');
reload();
check('…Mark used on a card crowded with credits: still used after a reload', [heldOf('amex-gold:uber').used, Object.keys(state().creditsLog).length], [true, 60]);
open({ cards: ['amex-gold'], creditsLog: { 'amex-gold:uber': { '2026-3': true }, ...crowdedCard } });
tick('amex-gold:resy', '2026-H1');
reload();
check('…a past box too', state().creditsLog['amex-gold:resy'], { '2026-H1': true });

// Focused fuzz: clear, tick, mark, Undo (any Undo still showing, even an older one) and fee dates on one card's credits.
// Whatever the order, a reload changes nothing and no tick hides on a box that isn't there.
fuzzFailure = null;
const CREDIT_FUZZ_FEES = ['2025-03-15', '2025-06-20', '2025-09-01', '2024-02-29', ''];
for (let seed = 1; seed <= FUZZ_RUNS * 8 && !fuzzFailure; seed++) {
  const r = seeded(seed * 15485863);
  const pick = (a) => a[Math.floor(r() * a.length)];
  at(2026, 11, 15);
  const cardId = pick(['sapphire-reserve', 'hilton-aspire']);
  open(cardId === 'sapphire-reserve' ? { cards: [cardId], renewals: { [cardId]: '2025-03-15' } } : { cards: [cardId] });
  const undos = [];
  const did = [];
  const keepUndos = () => { const t = shown.toasts.at(-1); if (t && t.undo && !undos.includes(t)) undos.push(t); };
  const onPage = (sel) => page.querySelectorAll(sel).filter((el) => !el.disabled);
  const moves = [
    () => { const els = onPage('[data-cp-box]'); if (!els.length) return; const el = pick(els); did.push(`tick ${el.dataset.cpBox} ${el.dataset.cpPeriod}`); el.checked = !el.checked; el.dispatch('change'); },
    () => { const els = onPage('[data-cp-amt]'); if (!els.length) return; const el = pick(els); el.value = pick(['', '', '120', '40', '9999']); did.push(`type ${el.value} ${el.dataset.cpAmt} ${el.dataset.cpPeriod}`); el.dispatch('change'); },
    () => { const els = app.document.querySelector('#credits-list').querySelectorAll('[data-credit-use]'); if (!els.length) return; const el = pick(els); did.push(`mark ${el.dataset.creditUse}`); el.dispatch('click'); },
    () => { if (!undos.length) return; const t = undos.splice(Math.floor(r() * undos.length), 1)[0]; did.push(`undo ${t.message}`); t.undo(); },
    () => { const els = onPage('[data-cp-renewal]'); if (!els.length) return; const el = pick(els); el.value = pick(CREDIT_FUZZ_FEES); did.push(`fee ${el.value}`); el.dispatch('change'); },
    () => { did.push('reload'); app.setState(app.normalize(JSON.parse(JSON.stringify(state())))); app.forgetCreditParts(); app.renderCredits(); },
  ];
  for (let step = 0; step < 14 && !fuzzFailure; step++) {
    try {
      pick(moves)();
      keepUndos();
      app.renderCredits();
      app.renderUpcoming();
      const bad = disagreements();
      const reloaded = app.normalize(JSON.parse(JSON.stringify(state())));
      const sorted = (log) => JSON.stringify(Object.keys(log).sort().map((k) => [k, Object.entries(log[k]).sort()]));
      if (sorted(reloaded.creditsLog) !== sorted(state().creditsLog)) bad.push(`a reload changes the record: ${JSON.stringify(state().creditsLog)} to ${JSON.stringify(reloaded.creditsLog)}`);
      for (const [key, periods] of Object.entries(state().creditsLog)) {
        const id = key.split(':')[1];
        const shownKeys = [now.getFullYear(), now.getFullYear() - 1].flatMap((y) => boxes(cardId, id, y).map((b) => b.key));
        for (const period of Object.keys(periods)) if (!shownKeys.includes(period)) bad.push(`${key} ${period} has no box`);
      }
      if (bad.length) fuzzFailure = { seed, bad: bad.slice(0, 3), did: did.slice(-8) };
    } catch (err) {
      fuzzFailure = { seed, threw: err.message, did: did.slice(-8) };
    }
  }
  app.closeCreditsPage();
  page.hidden = true; app.location.hash = '';
}
check(`fuzz: ${FUZZ_RUNS * 8} runs of clear, tick, mark, any Undo, fee dates and reloads: a reload changes nothing, no tick without a box`, fuzzFailure, null);
now = new Date(2026, 9, 31, 12);

// Every check above again in other time zones: dates are local, so nothing may shift a day
if (!process.env.CREDITPAGE_TZ) {
  for (const tz of ['America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata']) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: tz, CREDITPAGE_TZ: tz, CREDITPAGE_FUZZ: '5' }, encoding: 'utf8' });
    check(`all of the above in ${tz}`, [run.status, (run.stdout.match(/^✗.*$/gm) || []).slice(0, 3)], [0, []]);
  }
}

// 18. Credits with no month or year to tick: on the checklist, each with what it is, outside the dollar totals
now = new Date(2026, 10, 1, 12);
setup({ cards: ['sapphire-reserve', 'amex-platinum', 'amex-gold', 'delta-gold', 'bilt-palladium'] });
app.closeCreditsPage();
app.renderCredits();
const totalsBefore = page.querySelector('.cp-summary').text;
const others = (card) => page.querySelector(`[data-cp-card="${card}"]`).querySelectorAll('[data-cp-other-row]').map((r) => r.dataset.cpOtherRow);
check('Sapphire Reserve: Global Entry, Apple, DashPass, The Edit stays and the two spend credits', others('sapphire-reserve'),
  ['sapphire-reserve:trusted-traveler', 'sapphire-reserve:apple', 'sapphire-reserve:dashpass', 'sapphire-reserve:edit-property', 'sapphire-reserve:southwest-bonus', 'sapphire-reserve:shops-bonus']);
check('Amex Platinum: Global Entry and the two hotel stay credits', others('amex-platinum'), ['amex-platinum:trusted-traveler', 'amex-platinum:fhr-property', 'amex-platinum:thc-property']);
check('Amex Gold: The Hotel Collection', others('amex-gold'), ['amex-gold:thc-property']);
check('Delta Gold: the $200 flight credit', others('delta-gold'), ['delta-gold:flight-bonus']);
check('Bilt Palladium: nothing else to list', others('bilt-palladium'), []);
const otherBox = (key) => page.querySelector(`[data-cp-other="${key}"]`);
check('a per-stay or spend credit has nothing to tick', [otherBox('amex-gold:thc-property'), otherBox('delta-gold:flight-bonus')], [null, null]);
check('its line says how it comes', [page.querySelector('[data-cp-other-row="amex-gold:thc-property"]').text.includes('$100 each stay'), page.querySelector('[data-cp-other-row="delta-gold:flight-bonus"]').text.includes('$200 after spending')], [true, true]);
otherBox('sapphire-reserve:trusted-traveler').checked = true;
otherBox('sapphire-reserve:trusted-traveler').dispatch('change');
check('ticked: today saved, and when it comes around again', [state().creditsOther['sapphire-reserve:trusted-traveler'], page.querySelector('[data-cp-other-row="sapphire-reserve:trusted-traveler"]').text.includes('again from Nov 1, 2030')], ['2026-11-01', true]);
check('…the dollar totals don’t move', page.querySelector('.cp-summary').text, totalsBefore);
const otherDate = page.querySelector('[data-cp-other-date="sapphire-reserve:trusted-traveler"]');
otherDate.value = '2024-03-10';
otherDate.dispatch('change');
check('the day you really used it can be set', [state().creditsOther['sapphire-reserve:trusted-traveler'], page.querySelector('[data-cp-other-row="sapphire-reserve:trusted-traveler"]').text.includes('again from Mar 10, 2028')], ['2024-03-10', true]);
const badDate = page.querySelector('[data-cp-other-date="sapphire-reserve:trusted-traveler"]');
badDate.value = '2027-01-01';
badDate.dispatch('change');
check('…not a day ahead of today', state().creditsOther['sapphire-reserve:trusted-traveler'], '2024-03-10');
now = new Date(2028, 2, 10, 12);
app.renderCredits();
check('four years on it can be used again: unticked, with when it last was', [otherBox('sapphire-reserve:trusted-traveler').checked, page.querySelector('[data-cp-other-row="sapphire-reserve:trusted-traveler"]').text.includes('Last used Mar 10, 2024')], [false, true]);
now = new Date(2026, 10, 1, 12);
app.renderCredits();
otherBox('sapphire-reserve:apple').checked = true;
otherBox('sapphire-reserve:apple').dispatch('change');
check('an activate-once perk stays ticked, with no “again”', [otherBox('sapphire-reserve:apple').checked, page.querySelector('[data-cp-other-row="sapphire-reserve:apple"]').text.includes('Activated Nov 1, 2026'), page.querySelector('[data-cp-other-row="sapphire-reserve:apple"]').text.includes('again')], [true, true, false]);
shown.toasts.length = 0;
otherBox('sapphire-reserve:apple').checked = false;
otherBox('sapphire-reserve:apple').dispatch('change');
check('unticked: gone, with Undo', ['sapphire-reserve:apple' in state().creditsOther, shown.toasts.length > 0], [false, true]);
shown.toasts.at(-1).undo?.();
check('…Undo puts the day back', state().creditsOther['sapphire-reserve:apple'], '2026-11-01');
const dirtyOthers = app.normalize({ programs: [], cards: ['sapphire-reserve'], creditsOther: { 'sapphire-reserve:trusted-traveler': '2025-02-03', 'sapphire-reserve:nope': '2025-02-03', 'nope:apple': '2025-02-03', 'sapphire-reserve:apple': 'soon', 'sapphire-reserve:dashpass': '2099-01-01', 'amex-gold:thc-property': '2025-02-03', '__proto__': '2025-02-03' } });
check('a saved file keeps only real days on credits that have a box', dirtyOthers.creditsOther, { 'sapphire-reserve:trusted-traveler': '2025-02-03' });
check('…and an old backup without them loads', app.normalize({ programs: [], cards: [] }).creditsOther, {});

// A filter says what it's leaving out
setup({ cards: ['amex-platinum'] });
app.closeCreditsPage();
app.renderCredits();
page.querySelector('[data-cp-filter="month"]').dispatch('click');
const later = page.querySelector('.cp-filter-note');
const stillShown = page.querySelectorAll('[data-cp-row]').length;
check('Due this month says how many end later, and links to All', [later.text.includes(`${app.creditsPageModel({ filter: 'month' }).later} more end later`), app.creditsPageModel({ filter: 'month' }).later > 0, stillShown > 0, !!later.querySelector('[data-cp-filter="all"]')], [true, true, true, true]);
check('…those extra credits show under All only', page.querySelectorAll('[data-cp-other-row]').length, 0);
later.querySelector('[data-cp-filter="all"]').dispatch('click');
check('…the link goes to All', [page.querySelectorAll('[data-cp-row]').length > stillShown, page.querySelector('.cp-filter-note')], [true, null]);
now = new Date(2026, 9, 31, 12);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
