// Checks the Credits page (from index.html, opened at #credits) against a small fake page and a fake clock: a box
// per month, quarter, half or year of each credit, ticking and unticking them (this period and past ones), partial
// amounts, the totals at the top, the record kept in creditsLog and how it agrees with the main page's "Mark used",
// old saved data, backups, a new year, skipped and added credits, and the "Add your cards" chips.
// Usage: node tests/run-fixes-creditpage-tests.mjs  — exits non-zero if any check fails.
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
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
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
  const renderPrograms = () => {}; const renderUpcoming = () => {}; const renderCertSuggest = () => {};
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
  globalThis.ui = { shown, normalize, comingUpLine, document, setRenewal, forgetCreditParts: typeof forgetCreditParts !== 'undefined' ? forgetCreditParts : () => {},
    creditUseText: typeof creditUseText !== 'undefined' ? creditUseText : null, creditStatusText: typeof creditStatusText !== 'undefined' ? creditStatusText : null, heldCredits, creditBoxes, cardCreditDefs, creditsPageModel, setCreditBox, renderCredits, openCreditsPage, closeCreditsPage,
    syncCreditsRoute, fire, page, tracker, location, body, CREDITS_PAGE_CARDS,
    getState: () => state, setState: (s) => { state = s; }, saves: () => saves };`, ctx);
const app = ctx.ui;
const { shown, page } = app;

const setup = (fields = {}) => { app.setState(app.normalize({ programs: [], ...fields })); shown.toasts.length = 0; };
const def = (cardId, id) => app.cardCreditDefs(cardId).find((c) => c.id === id);
const boxes = (cardId, id, year = now.getFullYear()) => app.creditBoxes(cardId, def(cardId, id), year);
const summary = (list) => list.map((b) => [b.key, b.short, b.phase, b.amount]);
const state = () => app.getState();

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
app.openCreditsPage();
check('opening: #credits, the page shown and the tracker hidden, scrolled to the top', [app.location.hash, page.hidden, app.tracker.hidden, shown.scrollTo.at(-1)], ['#credits', false, true, 0]);
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
app.openCreditsPage();
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
page.querySelector('[data-cp-back]').dispatch('click');
check('← Tracker: back to the tracker, no #credits', [app.location.hash, page.hidden, app.tracker.hidden], ['', true, false]);
app.location.hash = '#credits';
app.fire('hashchange');
check('a #credits link opens it', [page.hidden, app.tracker.hidden], [false, true]);
page.querySelector('[data-cp-back]').dispatch('click');
check('…and ← Tracker clears the hash', [app.location.hash, page.hidden], ['', true]);
app.openCreditsPage();
app.location.hash = ''; app.fire('popstate');
check('the browser’s Back closes it', [page.hidden, app.tracker.hidden], [true, false]);
check('…and the page went back where it was', shown.scrollTo.length > 0, true);
// A day later with the page open: drawn again for November
app.openCreditsPage();
now = new Date(2026, 10, 1, 9);
app.renderCredits();
check('Nov 1 (the day changed): November is now the highlighted box', pageBox('amex-gold:uber', '2026-11').parentNode.classList.contains('cp-current'), true);
check('…and October is missed', pageBox('amex-gold:uber', '2026-10').parentNode.classList.contains('cp-missed'), true);
now = new Date(2026, 9, 31, 12);

// 13. Expiring soon: tapping one goes to its row
setup({ cards: ['amex-gold'] });
app.openCreditsPage();
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
app.openCreditsPage();
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

// Focus goes back to what opened the page
const browserBack = () => { app.location.hash = ''; app.fire('popstate'); };
browserBack();
check('…and next time it opens, with some of the five held, no panel', (app.openCreditsPage(), page.querySelectorAll('[data-cp-add-card]').length), 0);
browserBack();
const opener = app.body.querySelector('#credits-open');
opener.focus();
app.openCreditsPage();
browserBack();
check('closing: focus back on the button that opened it', [page.hidden, app.document.activeElement === opener], [true, true]);
app.document.activeElement = null;
app.location.hash = '#credits'; app.fire('hashchange');
browserBack();
check('…opened from a link: focus on the header’s Credits button', app.document.activeElement === app.body.querySelector('#credits-btn'), true);

// Styles: wide layout as columns, the header button under the title on phones
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const wide = style.slice(style.indexOf('/* The Credits page on wide screens'));
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
app.openCreditsPage();
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
app.openCreditsPage();
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

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
