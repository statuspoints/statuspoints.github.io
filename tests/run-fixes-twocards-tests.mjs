// Checks a second copy of a card on the Credits page (from index.html, against a small fake page and a fake clock):
// each copy's own ticks, fee date and added credits, both copies everywhere credits appear, Due this month with two
// Sapphire Reserves, an Amex Gold and a Delta Gold, the "Add a card" row, removing and restoring, old saved data and
// backups, and the three cards' credits as re-checked in November 2026.
// Usage: node tests/run-fixes-twocards-tests.mjs  — exits non-zero if any check fails.
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
  const plain = (v) => JSON.stringify(v, (k, x) => (x && x.tagName ? `<${x.tagName.toLowerCase()}>` : x)); // an element, by its tag
  const ok = plain(got) === plain(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${plain(want)}, got ${plain(got)}`}`);
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
      const m = /^([a-z0-9]+)?((?:[#.][\\w-]+)*)((?:\\[[^\\]]+\\])*)$/i.exec(sel);
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
    getBoundingClientRect() { return { top: shown.top }; }
  }
  const body = new El('body');
  const shown = { toasts: [], scrolled: [], cardsOpened: 0, scrollTo: [], timers: [], top: 0, grows: 0, scrollBy: [] };
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
  const scrollBy = (x, y) => { shown.scrollBy.push(y); };
  const scrollTo = (x, y) => { shown.scrollTo.push(y); scrollY = y; };
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const CSS = { escape: (s) => s };
  const setTimeout = (fn) => { shown.timers.push(fn); return 0; }; const clearTimeout = () => {};
  const requestAnimationFrame = (fn) => fn();
`;

let now = new Date(2026, 10, 1, 12); // Sun Nov 1, 2026
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now.getTime(); }
}
const ctx = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Error, Promise });
vm.runInContext(`${fakeDom}
  ${head}
  svgIcon = () => null; // no <template> here
  shown.bonusBoxes = [];
  let bonusEditing = null;
  const cardsSheet = { open: false }; const renderAll = () => {};
  let state = normalize({ programs: [], cards: [] });
  let saves = 0;
  const showToast = (message, onUndo) => shown.toasts.push({ message, undo: onUndo || null });
  const scheduleSave = () => { saves++; }; const saveNow = () => {};
  const renderPrograms = () => { shown.top += shown.grows; }; const renderUpcoming = () => {}; const renderCertSuggest = () => {};
  const bonusShort = () => null; const bonusProgress = () => null; const bonuses = () => state.bonuses; const bonusBox = (card) => { shown.bonusBoxes.push(card.id); return null; };
  const openCards = () => { shown.cardsOpened++; };
  const jumpTo = (el) => { if (el) el.scrollIntoView(); };
  ${piece('  function parseISODate', '  function expiryLine')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  ${piece('  // "6 statuses and lounge access depend on it"', '  const perksLine')}
  ${piece('  function renewalText', '  /* ---------- Welcome bonuses')}
  ${piece('  // Puts a card on your list', "  $('#cards-done').addEventListener('click'")}
  ${piece('  const MONTH_NAMES', '  /* ---------- Certificates from your cards')}
  ${piece('  // One "Coming up" item as a line', '  // A plain-text summary meant for reading')}
  const CARDS_BLOCK = ${JSON.stringify(piece('    if (state.cards.length) {\n      const credits = heldCredits()', "    if (state.notes.trim()) out.push('', 'NOTE'"))};
  const cardsText = () => { const out = []; new Function('out', 'state', 'heldCredits', 'CARD_BY_ID', 'creditCardIds', 'creditCard', 'bonuses', 'cleanBonus', 'nextRenewal', 'dateFmt', 'fmt', 'money', 'bonusUnit', 'parseISODate', 'bonusText', 'creditRate', 'creditStatusText',
    CARDS_BLOCK)(out, state, heldCredits, CARD_BY_ID, typeof creditCardIds === 'undefined' ? () => state.cards : creditCardIds, typeof creditCard === 'undefined' ? (id) => CARD_BY_ID[id] : creditCard, bonuses, cleanBonus, nextRenewal, dateFmt, () => '', money, () => '', parseISODate, () => '', creditRate, creditStatusText); return out; };
  // Coming up's credit and annual-fee items, as upcomingItems builds them (the rest of it is about programs and vouchers).
  const UPCOMING_BLOCK = ${JSON.stringify(piece('    for (const x of heldCredits()) {\n        if (!x.used', "    // Welcome-bonus spend deadlines"))};
  const upcomingCredits = () => { const items = []; const SOON_DAYS = 30; const inWindow = (days, w) => days >= -30 && days <= w;
    new Function('items', 'inWindow', 'SOON_DAYS', 'state', 'heldCredits', 'nextRenewal', 'daysUntil', 'CARD_BY_ID', 'creditCardIds', 'creditCard', UPCOMING_BLOCK.replace('for (const x of heldCredits()) {', '{ for (const x of heldCredits()) {'))(items, inWindow, SOON_DAYS, state, heldCredits, nextRenewal, daysUntil, CARD_BY_ID, typeof creditCardIds === 'undefined' ? () => state.cards : creditCardIds, typeof creditCard === 'undefined' ? (id) => CARD_BY_ID[id] : creditCard);
    return items; };
  globalThis.ui = { shown, normalize, comingUpLine, document, setRenewal, renderRenewals, forgetCreditParts, heldCredits, creditBoxes, cardCreditDefs, creditsPageModel, setCreditBox, skipCredit, renderCredits, openCreditsPage,
    syncCreditsRoute, fire, page, tracker, location, body, cardsText, upcomingCredits, removeCard, restoreCard, applyCard, clone, CREDITS, CREDIT_LAST_DAY, CREDITS_AS_OF, CARD_BY_ID,
    getState: () => state, setState: (s) => { state = s; }, saves: () => saves, setWho: (id) => { people.active = id; } };`, ctx);
const app = ctx.ui;
const { shown, page } = app;

const SR = 'sapphire-reserve';
const SR2 = 'sapphire-reserve~2';
const setup = (fields = {}) => { app.setState(app.normalize({ programs: [], ...fields })); app.forgetCreditParts(); shown.toasts.length = 0; };
const four = (extra = {}) => setup({ cards: [SR, 'amex-gold', 'delta-gold'], cardCopies: { [SR]: { name: '' } }, ...extra });
const state = () => app.getState();
const def = (cardId, id) => app.cardCreditDefs(cardId).find((c) => c.id === id);
const boxes = (cardId, id, year = now.getFullYear()) => app.creditBoxes(cardId, def(cardId, id), year);
const pageBox = (key, period) => page.querySelector(`[data-cp-box="${key}"][data-cp-period="${period}"]`);
const tick = (key, period, on = true) => { const el = pageBox(key, period); if (!el) throw new Error(`no box ${key} ${period}`); el.checked = on; el.dispatch('change'); };
const click = (sel) => { const el = page.querySelector(sel); if (!el) throw new Error(`nothing at ${sel}`); el.dispatch('click'); };
const section = (id) => page.querySelector(`[data-cp-card="${id}"]`);
const due = (extra = {}) => app.creditsPageModel({ filter: 'month', ...extra }).cards.flatMap((c) => c.shown.map((r) => [r.key, r.left]));
// The checklist sits on the first page, starting on All, and stays where you left it.
const open = (filter = 'all') => { app.renderCredits(); app.openCreditsPage(); if (page.querySelector('[data-cp-year="past"]')) click('[data-cp-year="now"]'); if (page.querySelector('[data-cp-filter]')) click(`[data-cp-filter="${filter}"]`); };
const runTimers = () => { for (const fn of shown.timers.splice(0)) fn(); };

// 1. Due this month: Nov 1, 2026, Sapphire Reserve twice, Amex Gold and Delta Gold
four();
const NOV = [
  [`${SR}:doordash`, 15], [`${SR}:doordash-grocery`, 20], [`${SR}:lyft`, 10], [`${SR}:peloton`, 10],
  [`${SR2}:doordash`, 15], [`${SR2}:doordash-grocery`, 20], [`${SR2}:lyft`, 10], [`${SR2}:peloton`, 10],
  ['amex-gold:dining', 10], ['amex-gold:uber', 10], ['amex-gold:dunkin', 7],
  ['delta-gold:rideshare', 10]];
check('Nov 1: every monthly credit, for each copy, and nothing else', due(), NOV);
check('…$147 in all', due().reduce((n, [, left]) => n + left, 0), 147);
app.setCreditBox(`${SR2}:lyft`, '2026-11', true);
check('Lyft used on the second card: gone for that copy only', [due().some(([k]) => k === `${SR2}:lyft`), due().some(([k]) => k === `${SR}:lyft`)], [false, true]);
app.setCreditBox(`${SR}:doordash`, '2026-11', 6);
check('…$6 used of one DoorDash: $9 left for it, $15 on the other', [due().find(([k]) => k === `${SR}:doordash`)[1], due().find(([k]) => k === `${SR2}:doordash`)[1]], [9, 15]);
app.skipCredit(`${SR}:peloton`);
check('Peloton skipped on the first card: gone for that copy only', [due().some(([k]) => k === `${SR}:peloton`), due().some(([k]) => k === `${SR2}:peloton`)], [false, true]);
four({ renewals: { [SR2]: '2025-11-20' } });
check('second card’s card year ends this month: its Travel credit is due, the other copy’s isn’t', [due().find(([k]) => k === `${SR2}:travel`), due().some(([k]) => k === `${SR}:travel`)], [[`${SR2}:travel`, 300], false]);
four({ renewals: { [SR]: '2025-12-20', [SR2]: '2025-11-20' }, creditsLog: { [`${SR2}:travel`]: { 'A2025-11-20': true } } });
check('…already used: not due', due().some(([k]) => k.endsWith(':travel')), false);
now = new Date(2026, 11, 1, 12);
four();
const dec = due().map(([k]) => k);
check('Dec 1: half and calendar-year credits end this month, for both copies', [`${SR}:dining`, `${SR2}:dining`, `${SR2}:stubhub`, `${SR2}:edit`, `${SR2}:select-hotels`, 'amex-gold:resy', 'delta-gold:stays'].every((k) => dec.includes(k)), true);
check('…but a card-year credit with no fee date has no known end, so it isn’t due', dec.filter((k) => k.endsWith(':travel')), []);
app.setCreditBox(`${SR}:edit`, '2026', 200);
check('…The Edit part used: what’s left', due().find(([k]) => k === `${SR}:edit`), [`${SR}:edit`, 300]);
now = new Date(2027, 0, 15, 12);
four();
check('Jan 2027: select hotels (through 12/31/26) is past its last day on both copies', [boxes(SR2, 'select-hotels').length, due().filter(([k]) => k.includes('select-hotels')), app.creditsPageModel().cards[0].rows.some((r) => r.credit.id === 'select-hotels')], [0, [], false]);
now = new Date(2027, 9, 1, 12);
four();
check('Oct 2027: Lyft (through 9/30/27) is gone from both', [due().filter(([k]) => k.endsWith(':lyft')), app.heldCredits().filter((x) => x.credit.id === 'lyft').length], [[], 0]);
check('…Peloton (through 2027) is still there on both', due().filter(([k]) => k.endsWith(':peloton')).length, 2);
now = new Date(2026, 10, 1, 12);

// 2. Totals and every place credits appear
four();
let m = app.creditsPageModel();
check('both copies listed, one after the other', m.cards.map((c) => c.card.id), [SR, SR2, 'amex-gold', 'delta-gold']);
check('still available now counts both', m.available, 2997);
check('each copy’s total: DoorDash at $5 before Oct 2026 and $15 after', m.cards.slice(0, 2).map((c) => c.total), [2220, 2220]);
app.setCreditBox(`${SR2}:lyft`, '2026-11', true);
m = app.creditsPageModel();
check('a tick on one copy: used counts it once, on that copy', [m.used, m.cards[0].used, m.cards[1].used, m.available], [10, 0, 10, 2987]);
check('the amount before a change, the first day and the last day read the base card', [boxes(SR2, 'doordash').find((b) => b.key === '2026-9').amount, boxes(SR2, 'doordash').find((b) => b.key === '2026-10').amount, boxes(SR2, 'select-hotels', 2025).length, boxes(SR2, 'lyft', 2027).length, m.cards[1].rows.find((r) => r.credit.id === 'lyft').last], [5, 15, 0, 9, '2027-09-30']);
setup({ cards: ['amex-platinum'], cardCopies: { 'amex-platinum': { name: '' } } });
const platCopy = 'amex-platinum~2';
check('the December amount on a second card: boxes and the model', [boxes(platCopy, 'uber').find((b) => b.key === '2026-12').amount, def(platCopy, 'uber').dec], [35, 35]);
now = new Date(2026, 11, 2, 12);
check('…and the main page, in December', app.heldCredits().filter((x) => x.credit.id === 'uber').map((x) => [x.key, x.left]), [['amex-platinum:uber', 35], [`${platCopy}:uber`, 35]]);
now = new Date(2026, 10, 20, 12);
four();
const soon = app.creditsPageModel().soon;
check('Expiring soon: each copy’s monthly credits, told apart by name', soon.filter((s) => s.name === 'Lyft').map((s) => [s.key, s.card.name, s.amount]), [[`${SR}:lyft`, 'Sapphire Reserve 1', 10], [`${SR2}:lyft`, 'Sapphire Reserve 2', 10]]);
const held = app.heldCredits();
check('heldCredits: both copies, each with its own key and card id, base card’s name resolved', held.filter((x) => x.credit.id === 'travel').map((x) => [x.key, x.card.id, x.card.name, x.card.tone]), [[`${SR}:travel`, SR, 'Sapphire Reserve 1', 'sapphire'], [`${SR2}:travel`, SR2, 'Sapphire Reserve 2', 'sapphire']]);
app.renderCredits();
const groups = app.body.querySelectorAll('[data-credit-group]');
check('main page: a Card credits group per copy', groups.map((g) => [g.dataset.creditGroup, g.querySelector('h3').text]), [[SR, 'Sapphire Reserve 1'], [SR2, 'Sapphire Reserve 2'], ['amex-gold', 'Amex Gold'], ['delta-gold', 'Delta Gold']]);
check('…with its own unused total', app.body.querySelector('#c-meta').textContent, '$2,997 unused right now');
now = new Date(2026, 11, 20, 12);
four();
const upcoming = app.upcomingCredits().filter((i) => i.kind === 'credit' && i.x.credit.id === 'edit');
check('Coming up: both copies’ Edit credits, by name', upcoming.map((i) => app.comingUpLine(i).replace(/ by .*/, '')), ['- Use your $500 The Edit hotel credit (Sapphire Reserve 1)', '- Use your $500 The Edit hotel credit (Sapphire Reserve 2)']);
now = new Date(2026, 10, 1, 12);
four({ renewals: { [SR]: '2025-11-10', [SR2]: '2025-11-15' } });
const fees = app.upcomingCredits().filter((i) => i.kind === 'card');
check('Coming up: each copy’s annual fee, the second copy with no statuses riding on it', fees.map((i) => [i.card.id, i.card.name, i.days, i.card.grants.length > 0]), [[SR, 'Sapphire Reserve 1', 9, true], [SR2, 'Sapphire Reserve 2', 14, false]]);
const text = app.cardsText().join('\n');
check('text export: both copies, each with its credits and fee date', [/Sapphire Reserve 1 — annual fee around Nov 10, 2026/.test(text), /Sapphire Reserve 2 — annual fee around Nov 15, 2026/.test(text), (text.match(/- Lyft:/g) || []).length], [true, true, 2]);
app.renderRenewals();
check('Your cards’ fee dates: a row per copy, a welcome bonus only on the first', [app.body.querySelectorAll('[data-renewal]').map((el) => el.dataset.renewal), shown.bonusBoxes], [[SR, SR2, 'amex-gold', 'delta-gold'], [SR, 'amex-gold', 'delta-gold']]);
four();
state().cardCopies[SR].name = 'Spouse';
state().cardCopies[SR].first = 'Mine';
check('a typed name replaces the number, on both', app.heldCredits().filter((x) => x.credit.id === 'lyft').map((x) => x.card.name), ['Mine', 'Spouse']);
state().cardCopies[SR].first = 'Spouse';
check('…the same name twice still tells them apart', app.heldCredits().filter((x) => x.credit.id === 'lyft').map((x) => x.card.name), ['Spouse', 'Spouse 2']);
setup({ cards: [SR] });
check('one card: its name stays as it is', [app.heldCredits()[0].card.name, app.heldCredits()[0].card === app.CARD_BY_ID[SR], app.creditsPageModel().cards[0].card.name], ['Sapphire Reserve', true, 'Sapphire Reserve']);

// 3. Each copy's own record
four();
open();
tick(`${SR2}:doordash`, '2026-11');
check('ticking the second card’s box: its record only', [state().creditsLog[`${SR2}:doordash`], state().creditsUsed[`${SR2}:doordash`], state().creditsUsedOn[`${SR2}:doordash`], `${SR}:doordash` in state().creditsLog, pageBox(`${SR2}:doordash`, '2026-11').checked, pageBox(`${SR}:doordash`, '2026-11').checked],
  [{ '2026-11': true }, '2026-11', '2026-11-01', false, true, false]);
tick(`${SR2}:doordash`, '2026-11', false);
check('unticking: gone, with Undo that puts it back', [`${SR2}:doordash` in state().creditsLog, typeof shown.toasts.at(-1).undo], [false, 'function']);
shown.toasts.at(-1).undo();
check('…Undo', state().creditsLog[`${SR2}:doordash`], { '2026-11': true });
const amt = page.querySelector(`[data-cp-amt="${SR2}:edit"]`);
amt.value = '120'; amt.dispatch('change');
check('a part-used amount on the second card: its record and its day only', [state().creditsLog[`${SR2}:edit`], state().creditsPartOn[`${SR2}:edit`], `${SR}:edit` in state().creditsLog, app.creditsPageModel().cards[1].rows.find((r) => r.credit.id === 'edit').left, app.creditsPageModel().cards[0].rows.find((r) => r.credit.id === 'edit').left], [{ 2026: 120 }, '2026-11-01', false, 380, 500]);
click(`[data-cp-skip="${SR2}:lyft"]`);
check('Stop tracking on the second card: that copy only', [state().creditsSkipped[`${SR2}:lyft`], `${SR}:lyft` in state().creditsSkipped, section(SR2).querySelector(`[data-cp-unskip="${SR2}:lyft"]`) != null, section(SR).querySelector(`[data-cp-row="${SR}:lyft"]`) != null], [true, false, true, true]);
click(`[data-cp-unskip="${SR2}:lyft"]`);
check('Track again', `${SR2}:lyft` in state().creditsSkipped, false);
const addCustom = (cardId) => {
  const form = { dataset: { creditForm: cardId }, elements: { name: { value: 'Made-up credit', focus() {} }, amount: { value: '25', focus() {} }, period: { value: 'month' } } };
  const list = app.body.querySelector('#credits-list');
  for (const l of list.listeners) if (l.type === 'submit') l.fn({ preventDefault() {}, target: { closest: () => form } });
};
addCustom(SR2);
check('a credit you add goes on that copy only', [state().customCredits[SR2].length, SR in state().customCredits, app.creditsPageModel().cards[1].rows.at(-1).credit.name, app.creditsPageModel().cards[0].rows.at(-1).credit.name], [1, false, 'Made-up credit', 'Peloton']);
click(`[data-cp-skip="${SR2}:${state().customCredits[SR2][0][0]}"]`);
check('removing it from that copy, with Undo', [state().customCredits[SR2].length, typeof shown.toasts.at(-1).undo], [0, 'function']);
const useMain = (key) => {
  const list = app.body.querySelector('#credits-list');
  for (const l of list.listeners) if (l.type === 'click') l.fn({ target: { closest: (sel) => (sel === 'button' ? { dataset: { creditUse: key }, closest: () => null } : null) } });
};
four();
useMain(`${SR2}:lyft`);
check('main page Mark used on the second card: its box only', [state().creditsLog[`${SR2}:lyft`], `${SR}:lyft` in state().creditsLog, app.heldCredits().filter((x) => x.credit.id === 'lyft').map((x) => x.used)], [{ '2026-11': true }, false, [false, true]]);

// Each copy's own fee date and card year, and ticks that follow only their own date
four();
open();
app.setCreditBox(`${SR}:travel`, '2026', true);
app.setCreditBox(`${SR2}:travel`, '2026', true);
const fee = page.querySelector(`[data-cp-renewal="${SR2}"]`);
fee.value = '2026-03-15'; fee.dispatch('change');
check('the second card’s fee date: kept for it alone', [state().renewals[SR2], SR in state().renewals], ['2026-03-15', false]);
check('…its Travel credit moves to the card year, the first card’s stays on 2026', [Object.keys(state().creditsLog[`${SR2}:travel`]), Object.keys(state().creditsLog[`${SR}:travel`]), state().creditsUsed[`${SR2}:travel`], state().creditsUsed[`${SR}:travel`]], [['A2026-03-15'], ['2026'], 'A2026-03-15', '2026']);
check('…the first card’s box is by calendar year, the second’s by card year', [boxes(SR, 'travel').map((b) => b.key), boxes(SR2, 'travel').map((b) => b.key)], [['2026'], ['A2025-03-15', 'A2026-03-15']]);
app.setRenewal(SR2, '2025-12-01');
check('trying another date moves its ticks, and only its', [Object.keys(state().creditsLog[`${SR2}:travel`]), Object.keys(state().creditsLog[`${SR}:travel`])], [['A2025-12-01'], ['2026']]);
app.setRenewal(SR2, '');
check('clearing it: back on the calendar year', [Object.keys(state().creditsLog[`${SR2}:travel`]), SR2 in state().renewals], [['2026'], false]);

// 4. Second card and remove, on the page
setup({ cards: [SR, 'amex-gold'], creditsAddHidden: true });
open();
check('each card section offers a Second card', [page.querySelector(`[data-cp-second="${SR}"]`) != null, page.querySelector('[data-cp-second="amex-gold"]') != null, section(SR2)], [true, true, null]);
const statusesBefore = JSON.stringify(state().programs);
const cardsBefore = JSON.stringify(state().cards);
click(`[data-cp-second="${SR}"]`);
check('tapping it: a second section, the names change, stored once', [section(SR2) != null, section(SR).querySelector('h2').text, section(SR2).querySelector('h2').text, state().cardCopies[SR]], [true, 'Sapphire Reserve 1', 'Sapphire Reserve 2', { name: '' }]);
check('…focus on the new section', app.document.activeElement === section(SR2), true);
check('…state.cards and statuses unchanged', [JSON.stringify(state().cards), JSON.stringify(state().programs)], [cardsBefore, statusesBefore]);
check('…no Second card left on either copy, and a remove on the second only', [page.querySelector(`[data-cp-second="${SR}"]`), section(SR).querySelector('[data-cp-remove-copy]'), section(SR2).querySelector('[data-cp-remove-copy]') != null], [null, null, true]);
shown.toasts.at(-1).undo();
check('Undo: gone again, back to one name', [section(SR2), section(SR).querySelector('h2').text, SR in state().cardCopies], [null, 'Sapphire Reserve', false]);
click(`[data-cp-second="${SR}"]`);
app.setCreditBox(`${SR2}:lyft`, '2026-11', true);
app.setRenewal(SR2, '2026-03-15');
const typeName = (id, value) => { const el = page.querySelector(`[data-cp-copy-name="${id}"]`); el.value = value; el.dispatch('change'); };
typeName(SR2, `   ${'x'.repeat(40)} `);
check('a typed name is trimmed and capped', state().cardCopies[SR].name, 'x'.repeat(24));
typeName(SR2, 'Travel');
check('…and shows as the section’s name', [state().cardCopies[SR].name, section(SR2).querySelector('h2').text], ['Travel', 'Travel']);
check('…the first copy has its own field', section(SR).querySelector(`[data-cp-copy-name="${SR}"]`) != null, true);
typeName(SR, 'Everyday');
check('…kept apart', [state().cardCopies[SR].first, section(SR).querySelector('h2').text], ['Everyday', 'Everyday']);
typeName(SR, '');
check('…cleared: back to the number', section(SR).querySelector('h2').text, 'Sapphire Reserve 1');
const logged = JSON.stringify(state().creditsLog[`${SR2}:lyft`]);
click(`[data-cp-remove-copy="${SR}"]`);
check('remove: the section goes, one name again, with Undo', [section(SR2), section(SR).querySelector('h2').text, shown.toasts.at(-1).message, typeof shown.toasts.at(-1).undo], [null, 'Sapphire Reserve', 'Removed Travel', 'function']);
check('…its saved ticks, fee date and name stay, as a removed card’s do', [JSON.stringify(state().creditsLog[`${SR2}:lyft`]), state().renewals[SR2], state().cardCopies[SR].name], [logged, '2026-03-15', 'Travel']);
check('…focus on the card’s Second card', app.document.activeElement === page.querySelector(`[data-cp-second="${SR}"]`), true);
check('…not in the totals or anywhere else', [app.heldCredits().some((x) => x.card.id === SR2), app.creditsPageModel().cards.some((c) => c.card.id === SR2)], [false, false]);
shown.toasts.at(-1).undo();
check('Undo: back with its ticks', [section(SR2) != null, pageBox(`${SR2}:lyft`, '2026-11').checked, section(SR2).querySelector('h2').text], [true, true, 'Travel']);
click(`[data-cp-remove-copy="${SR}"]`);
click(`[data-cp-second="${SR}"]`);
check('Second card again later: its ticks, date and name come back', [pageBox(`${SR2}:lyft`, '2026-11').checked, state().renewals[SR2], section(SR2).querySelector('h2').text], [true, '2026-03-15', 'Travel']);

// Other cards can have one, even one with only a credit you added
setup({ cards: ['amex-gold'], creditsAddHidden: true });
open();
click('[data-cp-second="amex-gold"]');
check('Amex Gold’s second card: its credits and names', [section('amex-gold~2').querySelector('h2').text, app.creditsPageModel().cards[1].rows.map((r) => r.credit.id)], ['Amex Gold 2', ['resy', 'dining', 'uber', 'dunkin']]);
setup({ cards: ['freedom-flex'], customCredits: { 'freedom-flex': [['c1', 'Made-up', 5, 'month']] }, creditsAddHidden: true });
open();
click('[data-cp-second="freedom-flex"]');
check('a card with only your own credit: its second copy still has a section to remove it from', [section('freedom-flex~2') != null, section('freedom-flex~2').querySelector('[data-cp-remove-copy]') != null, section('freedom-flex~2').querySelector('.cp-none').text.includes('Card credits')], [true, true, true]);

// Removing the base card from Your cards: the second copy goes with it and comes back with it
four({ creditsLog: { [`${SR2}:lyft`]: { '2026-11': true } }, renewals: { [SR2]: '2026-03-15' } });
const previous = app.clone(state());
app.removeCard(state(), SR);
check('base card removed: neither copy shows, nothing crashes', [app.creditsPageModel().cards.map((c) => c.card.id), app.heldCredits().some((x) => x.card.id.startsWith(SR))], [['amex-gold', 'delta-gold'], false]);
check('…the second copy’s record is kept', [state().cardCopies[SR], state().creditsLog[`${SR2}:lyft`], state().renewals[SR2]], [{ name: '' }, { '2026-11': true }, '2026-03-15']);
app.restoreCard(state(), previous, SR);
check('…its Undo brings both back', app.creditsPageModel().cards.map((c) => c.card.id), [SR, SR2, 'amex-gold', 'delta-gold']);
app.removeCard(state(), SR);
app.applyCard(state(), SR);
check('…as does picking the card again', [app.creditsPageModel().cards.map((c) => c.card.id), app.creditBoxes(SR2, def(SR2, 'lyft'), 2026).find((b) => b.key === '2026-11').used], [['amex-gold', 'delta-gold', SR, SR2], 10]);

const tapPicker = (id) => {
  const tile = { dataset: { card: id }, setAttribute() {} };
  for (const l of app.body.querySelector('#cards-picker').listeners) if (l.type === 'click') l.fn({ target: { closest: () => tile } });
};
four();
tapPicker(SR);
check('tapped off in Your cards with a second copy: it says so', [state().cards, app.body.querySelector('#cards-status').textContent, state().cardCopies[SR]], [['amex-gold', 'delta-gold'], 'Took off Sapphire Reserve’s statuses, with its second card', { name: '' }]);
tapPicker(SR);
check('tapped on again: both back', app.creditsPageModel().cards.map((c) => c.card.id), ['amex-gold', 'delta-gold', SR, SR2]);
four({ bonuses: { [SR]: { points: 1000, spend: 5000, spent: 0, by: '2027-01-01', landed: '' } } });
tapPicker(SR);
check('…with a welcome bonus too: the toast says so, its Undo puts everything back', [shown.toasts.at(-1).message, (shown.toasts.at(-1).undo(), app.creditsPageModel().cards.map((c) => c.card.id).slice(0, 2))], ['Removed Sapphire Reserve, its second card and its welcome bonus', [SR, SR2]]);

// Undo belongs to the person it was done for
setup({ cards: [SR], creditsAddHidden: true });
open();
click(`[data-cp-second="${SR}"]`);
const addUndo = shown.toasts.at(-1).undo;
click(`[data-cp-remove-copy="${SR}"]`);
const removeUndo = shown.toasts.at(-1).undo;
const copiesBefore = JSON.stringify(state().cardCopies);
app.setWho('someone-else');
addUndo();
removeUndo();
check('Undo after switching person changes nothing', JSON.stringify(state().cardCopies), copiesBefore);
app.setWho('me');

// Last year: both copies to look back on, nothing to add or remove
four({ creditsLog: { [`${SR2}:lyft`]: { '2025-12': true } } });
click('[data-cp-year="past"]');
check('last year: the second copy’s section with what was ticked, no actions', [section(SR2).querySelector('.cp-card-sum').text, page.querySelector('.cp-copy') === null, page.querySelector('[data-cp-copy-name]') === null], ['$10 used in 2025', true, true]);
click('[data-cp-year="now"]');

// 5. Statuses and the rest are counted once
const withStatus = (fields) => { const s = app.normalize({ programs: [], ...fields }); app.applyCard(s, SR); return s; };
const once = withStatus({});
const onceLines = JSON.stringify(once.programs);
once.cardCopies[SR] = { name: '' };
check('a second copy adds nothing to Your cards, statuses or bonuses', [once.cards, JSON.stringify(once.programs) === onceLines, Object.keys(once.bonuses)], [[SR], true, []]);
four({ bonuses: {} });
check('the second copy has no welcome bonus of its own', [state().bonuses[SR2]], [null]);

// 6. The "Add a card" row
setup({ cards: [SR] });
open();
const chips = () => page.querySelectorAll('.cp-offer .cert-chip').map((el) => el.text);
check('CSR held: a row offers the other four and a second CSR', chips(), ['+ Amex Platinum', '+ Amex Gold', '+ Delta Gold', '+ Bilt Palladium', '+ Second Sapphire Reserve']);
check('…no Add your cards panel', page.querySelector('.cp-add'), null);
for (const filter of ['all', 'month', 'unused']) {
  click(`[data-cp-filter="${filter}"]`);
  check(`…under ${filter}`, [page.querySelector('.cp-offer') != null, app.creditsPageModel({ filter }).filter], [true, filter]);
}
click('[data-cp-filter="month"]');
const goldChip = page.querySelector('.cp-offer [data-cp-add-card="amex-gold"]');
goldChip.focus();
goldChip.dispatch('click');
check('tapping Amex Gold under Due this month: added, filter kept', [state().cards, page.querySelector('[data-cp-filter="month"]').getAttribute('aria-pressed')], [[SR, 'amex-gold'], 'true']);
check('…focus stays on its chip, now marked added', [app.document.activeElement.dataset.cpAddCard, app.document.activeElement.text], ['amex-gold', '✓ Amex Gold']);
check('…its monthly rows show under the filter, its half-year one doesn’t', section('amex-gold').querySelectorAll('[data-cp-row]').map((r) => r.dataset.cpRow), ['amex-gold:dining', 'amex-gold:uber', 'amex-gold:dunkin']);
const addedToast = shown.toasts.at(-1);
check('…with Undo', typeof addedToast.undo, 'function');
addedToast.undo();
check('Undo: off again, the chip back', [state().cards, chips().includes('+ Amex Gold'), section('amex-gold')], [[SR], true, null]);
page.querySelector('.cp-offer [data-cp-add-card="amex-gold"]').dispatch('click');
page.querySelector('.cp-offer [data-cp-add-card="delta-gold"]').dispatch('click');
page.querySelector('.cp-offer [data-cp-add-copy="sapphire-reserve"]').dispatch('click');
check('Delta Gold and a second CSR the same way', [state().cards, state().cardCopies[SR], due().length], [[SR, 'amex-gold', 'delta-gold'], { name: '' }, 12]);
check('…the second CSR’s chip is marked added too', page.querySelector('.cp-offer [data-cp-add-copy="sapphire-reserve"]').text, '✓ Second Sapphire Reserve');
shown.toasts.at(-1).undo();
check('…with Undo', [SR in state().cardCopies, page.querySelector('.cp-offer [data-cp-add-copy="sapphire-reserve"]').text], [false, '+ Second Sapphire Reserve']);
app.forgetCreditParts();
app.renderCredits();
check('another tracker coming in forgets what was tapped here', chips().filter((t) => t.startsWith('✓')), []);
four();
open();
check('reopened with a second CSR: the chip isn’t offered', chips(), ['+ Amex Platinum', '+ Bilt Palladium']);
setup({ cards: [SR] });
open();
click('[data-cp-offer-hide]');
check('✕: the row goes, remembered in state, with Undo', [page.querySelector('.cp-offer') === null, state().creditsAddHidden, typeof shown.toasts.at(-1).undo], [true, true, 'function']);
check('…Choose cards stays on the page', page.querySelector('[data-cp-choose]') != null, true);
check('…remembered through a save and reload', app.normalize(JSON.parse(JSON.stringify(state()))).creditsAddHidden, true);
shown.toasts.at(-1).undo();
check('Undo: back', [page.querySelector('.cp-offer') != null, state().creditsAddHidden], [true, false]);
click('[data-cp-offer-hide]');
click('[data-cp-choose]');
check('…and it opens Your cards', shown.cardsOpened > 0, true);
click('[data-cp-year="past"]');
check('last year: no row', page.querySelector('.cp-offer') === null, true);
setup({ cards: [] });
open();
check('no cards: the Add your cards panel as before, no row', [page.querySelector('.cp-add') != null, page.querySelector('.cp-offer'), app.creditsPageModel().suggest.length, page.querySelectorAll('.cp-add .cert-chip').length, page.querySelector('[data-cp-filter]')], [true, null, 5, 5, null]);
page.querySelector('[data-cp-add-card="sapphire-reserve"]').dispatch('click');
check('…a CSR added there: it can go on to add a second, no row yet', [page.querySelector('.cp-add [data-cp-add-copy="sapphire-reserve"]') != null, page.querySelector('.cp-offer')], [true, null]);
setup({ cards: ['freedom-flex'], creditsAddHidden: true });
open();
check('another card only, row dismissed: the panel still shows', [page.querySelector('.cp-add') != null, page.querySelector('.cp-offer')], [true, null]);
setup({ cards: [SR, 'amex-platinum', 'amex-gold', 'delta-gold', 'bilt-palladium'], cardCopies: { [SR]: { name: '' } } });
open();
check('all held and a second CSR: no row, Choose cards still there', [page.querySelector('.cp-offer'), page.querySelector('[data-cp-choose]') != null], [null, true]);
setup({ cards: ['amex-gold'] });
open();
check('no CSR held: no second CSR offered', chips().some((t) => t.includes('Second')), false);

// Jumping from Expiring soon lands on the right copy, even from a filter
now = new Date(2026, 10, 20, 12);
four();
open();
click('[data-cp-filter="unused"]');
const jump = page.querySelector(`[data-cp-jump="${SR2}:lyft"]`);
check('Expiring soon names the copy', jump.querySelector('.cp-soon-name').text, 'Sapphire Reserve 2 · Lyft');
jump.dispatch('click');
check('…jumps to that copy’s row', shown.scrolled.at(-1).dataset.cpRow, `${SR2}:lyft`);
now = new Date(2026, 10, 1, 12);

// 7. Saved data: old backups, odd stored ids, and a backup's round trip
const old = app.normalize({ programs: [], cards: [SR] });
check('an old backup with no such field loads fine', [Array.isArray(old.programs), old.cards, old.cardCopies, old.creditsAddHidden], [true, [SR], {}, false]);
const blank = app.normalize({ programs: [] });
check('…no copies, row not hidden', [blank.cardCopies, blank.creditsAddHidden], [{}, false]);
for (const junk of [null, 'x', 7, true, [], ['sapphire-reserve']]) check(`cardCopies of ${JSON.stringify(junk)} is ignored`, app.normalize({ programs: [], cards: [SR], cardCopies: junk }).cardCopies, {});
const odd = app.normalize({ programs: [], cards: [SR], cardCopies: { [SR]: { name: 'y'.repeat(60), first: 42, off: 'yes', extra: 1 }, nope: { name: 'a' }, [SR2]: { name: 'b' }, 'amex-gold': 'text', 'delta-gold': null, 'bilt-palladium': [] } });
check('cardCopies: known base cards only, name capped, other fields dropped', odd.cardCopies, { [SR]: { name: 'y'.repeat(24) } });
check('…a removed copy stays removed', app.normalize({ programs: [], cards: [SR], cardCopies: { [SR]: { name: 'Keep', off: true } } }).cardCopies, { [SR]: { name: 'Keep', off: true } });
const gone = app.normalize({
  programs: [], cards: [SR],
  creditsLog: { [`${SR2}:lyft`]: { '2026-11': true }, [`${SR}~3:lyft`]: { '2026-11': true }, [`${SR2}~2:lyft`]: { '2026-11': true }, 'nope~2:lyft': { '2026-11': true }, '~2:lyft': { '2026-11': true }, 'constructor~2:x': { '2026-11': true } },
  creditsUsed: { [`${SR2}:lyft`]: '2026-11', [`${SR}~3:lyft`]: '2026-11', 'nope~2:lyft': '2026-11' },
  creditsUsedOn: { [`${SR2}:lyft`]: '2026-11-01', [`${SR}~3:lyft`]: '2026-11-01', 'nope~2:lyft': '2026-11-01' },
  creditsPartOn: { [`${SR}~3:edit`]: '2026-11-01' },
  creditsSkipped: { [`${SR2}:lyft`]: true, 'nope~2:lyft': true, [`${SR}~3:lyft`]: true },
  renewals: { [SR2]: '2026-03-15', 'nope~2': '2026-03-15', [`${SR}~3`]: '2026-03-15' },
  customCredits: { [SR2]: [['c1', 'Made-up', 5, 'month']], 'nope~2': [['c1', 'Made-up', 5, 'month']], [`${SR}~3`]: [['c1', 'Made-up', 5, 'month']] },
});
check('a saved second copy with no cardCopies: the tracker loads', Array.isArray(gone.programs), true);
check('…its valid record is kept, like a removed card’s; other ids are dropped', [Object.keys(gone.creditsLog), Object.keys(gone.creditsUsed), Object.keys(gone.creditsUsedOn), Object.keys(gone.creditsPartOn), Object.keys(gone.creditsSkipped), Object.keys(gone.renewals), Object.keys(gone.customCredits)],
  [[`${SR2}:lyft`], [`${SR2}:lyft`], [`${SR2}:lyft`], [], [`${SR2}:lyft`], [SR2], [SR2]]);
app.setState(gone);
check('…and doesn’t show or crash', [app.creditsPageModel().cards.map((c) => c.card.id), app.heldCredits().every((x) => x.card.id === SR)], [[SR], true]);
four({ creditsLog: { [`${SR2}:edit`]: { 2026: 120 } }, creditsPartOn: { [`${SR2}:edit`]: '2026-11-01' }, creditsUsed: { [`${SR2}:lyft`]: '2026-11' }, creditsUsedOn: { [`${SR2}:lyft`]: '2026-11-01' }, creditsSkipped: { [`${SR2}:peloton`]: true }, renewals: { [SR2]: '2026-03-15' },
  customCredits: { [SR2]: [['c1', 'Made-up', 5, 'month']] } });
state().cardCopies[SR] = { name: 'Travel', first: 'Everyday' };
const backup = app.normalize(JSON.parse(JSON.stringify(state())));
check('a backup (or Send to another device) carries all of it', [backup.cardCopies, backup.creditsLog[`${SR2}:edit`], backup.creditsLog[`${SR2}:lyft`], backup.creditsPartOn[`${SR2}:edit`], backup.creditsSkipped[`${SR2}:peloton`], backup.renewals[SR2], backup.customCredits[SR2]],
  [{ [SR]: { name: 'Travel', first: 'Everyday' } }, { 2026: 120 }, { '2026-11': true }, '2026-11-01', true, '2026-03-15', [['c1', 'Made-up', 5, 'month']]]);
check('a person with no copies next to one with: their own', app.normalize({ programs: [], cards: [SR] }).cardCopies, {});

// 8. The three cards' credits as re-checked for November 2026: [id, dollars, period, resets, last day]
check('credits as of: the month the whole table was last checked', app.CREDITS_AS_OF, 'October 2026');
const table = (cardId) => app.CREDITS[cardId].map(([id, , amount, period, resets]) => [id, amount, period, resets, app.CREDIT_LAST_DAY[`${cardId}:${id}`] || null]);
check('Sapphire Reserve money', table(SR), [['travel', 300, 'year', 'card', null], ['edit', 500, 'year', 'calendar', null], ['select-hotels', 250, 'year', 'calendar', '2026-12-31'], ['dining', 150, 'half', 'calendar', null],
  ['stubhub', 150, 'half', 'calendar', '2027-12-31'], ['doordash', 15, 'month', 'calendar', null], ['doordash-grocery', 20, 'month', 'calendar', null], ['lyft', 10, 'month', 'calendar', '2027-09-30'], ['peloton', 10, 'month', 'calendar', '2027-12-31']]);
check('Amex Gold money', table('amex-gold'), [['resy', 50, 'half', 'calendar', null], ['dining', 10, 'month', 'calendar', null], ['uber', 10, 'month', 'calendar', null], ['dunkin', 7, 'month', 'calendar', null]]);
check('Delta Gold money', table('delta-gold'), [['stays', 100, 'year', 'calendar', null], ['rideshare', 10, 'month', 'calendar', null]]);
const note = (cardId, id) => app.CREDITS[cardId].find((c) => c[0] === id)[5];
check('Select hotels: prepaid, two-night minimum', note(SR, 'select-hotels'), 'IHG, Montage, Pendry, Omni and more via Chase Travel; prepaid, 2+ nights');
check('Lyft: its exclusions', note(SR, 'lyft'), 'in the Lyft app; not Wait & Save, bikes or scooters; through 9/30/27');
check('New in your tracker says so, and comes up again for those who saw the last one', [/<b>Two of the same card<\/b>: in the Credits checklist/.test(html), /const NEWS_ID = '2026-11b'/.test(html)], [true, true]);

// 9. On the first page: going back to the checklist, and the row's ✕
setup({ cards: [SR] });
open('month');
click('[data-cp-add-card="amex-gold"]');
click('[data-cp-add-copy="sapphire-reserve"]');
check('tapped chips stay marked while you’re here', page.querySelectorAll('.cp-offer .cp-added').length, 2);
app.body.querySelector('#credits-btn').dispatch('click');
check('…and go once you come back with the Credits button', [page.querySelectorAll('.cp-offer .cp-added').length, chips()], [0, ['+ Amex Platinum', '+ Delta Gold', '+ Bilt Palladium']]);
setup({ cards: ['freedom-flex'] });
open();
check('an “Add your cards” panel, for someone with none of the five', page.querySelector('.cp-add') != null, true);
app.forgetCreditParts();
app.setState(app.normalize({ programs: [], cards: [SR] }));
app.renderCredits();
check('…isn’t carried over to another person who has one', [page.querySelector('.cp-add'), page.querySelector('.cp-offer') != null], [null, true]);
setup({ cards: [SR] });
open('month');
click('[data-cp-offer-hide]');
check('✕: the toast says where Choose cards went, on a page that goes on after the checklist', shown.toasts.at(-1).message, 'Hidden. Choose cards is at the end of this checklist');
check('…focus on the filter just above where the row was, not off screen', [app.document.activeElement.dataset.cpFilter, app.document.activeElement === page.querySelector('.cp-choose')], ['month', false]);
app.document.activeElement = app.body;
shown.toasts.at(-1).undo();
check('…Undo: focus on the ✕ again, not lost', app.document.activeElement.dataset.cpOfferHide, '');

// A tick last year's view made, moved onto the card year on now by a new fee date: both pages agree it's used
now = new Date(2026, 11, 20, 12);
for (const id of [SR, SR2]) {
  four({ renewals: { [id]: '2025-12-05' } });
  open();
  app.setCreditBox(`${id}:travel`, 'A2025-12-05', true, true);
  app.setRenewal(id, '2025-12-31');
  const onMain = app.heldCredits().find((x) => x.key === `${id}:travel`);
  const onPage = app.creditsPageModel().cards.find((c) => c.card.id === id).rows.find((r) => r.credit.id === 'travel');
  check(`a last-year tick moved to this card year (${id}): used on both pages`, [state().creditsLog[`${id}:travel`], onMain.period.key, onMain.used, onMain.left, onPage.left], [{ 'A2025-12-31': true }, 'A2025-12-31', true, 0, 0]);
  useMain(`${id}:travel`);
  check('…and Mark used takes it off both', [state().creditsLog[`${id}:travel`], app.heldCredits().find((x) => x.key === `${id}:travel`).left], [undefined, 300]);
}
now = new Date(2026, 10, 1, 12);

// Only your own credit, taken off the first copy: both copies stay, and the year switch does too
setup({ cards: ['freedom-flex'], customCredits: { 'freedom-flex': [['c1', 'Made-up', 5, 'month']] }, creditsAddHidden: true });
open();
click('[data-cp-second="freedom-flex"]');
click('[data-cp-skip="freedom-flex:c1"]');
check('the first copy’s last credit gone: both copies still listed, as on the main page', [section('freedom-flex') != null, section('freedom-flex~2') != null], [true, true]);
click('[data-cp-year="past"]');
check('…last year, with nothing to look back on: the year switch stays, Add your cards doesn’t take over', [page.querySelector('[data-cp-year="now"]') != null, page.querySelector('.cp-add'), page.text.includes('Nothing to look back on for 2025')], [true, null, true]);
click('[data-cp-year="now"]');
check('…and back to this year', [section('freedom-flex') != null, page.querySelector('[data-cp-year="past"]').getAttribute('aria-pressed')], [true, 'false']);

// Typed names can't make the two read the same
const names = (first, second) => { setup({ cards: [SR], cardCopies: { [SR]: { name: second, ...(first ? { first } : {}) } } }); return app.heldCredits().filter((x) => x.credit.id === 'lyft').map((x) => x.card.name); };
check('first typed as the second’s default', names('Sapphire Reserve 2', ''), ['Sapphire Reserve 2', 'Sapphire Reserve 2 2']);
check('second typed as the first’s default', names('', 'Sapphire Reserve 1'), ['Sapphire Reserve 1', 'Sapphire Reserve 1 2']);
check('…any case', names('sapphire reserve 2', ''), ['sapphire reserve 2', 'Sapphire Reserve 2 2']);
check('two typed, as before', names('Mine', 'mine'), ['Mine', 'mine 2']);
check('different names untouched', names('Mine', ''), ['Mine', 'Sapphire Reserve 2']);

// Messages and labels say which copy
four();
open();
app.skipCredit(`${SR2}:stubhub`);
check('Stop tracking’s toast names the copy', shown.toasts.at(-1).message, 'Not tracking StubHub / viagogo on Sapphire Reserve 2');
tick(`${SR2}:lyft`, '2026-11');
tick(`${SR2}:lyft`, '2026-11', false);
check('…as does unticking', shown.toasts.at(-1).message, 'Unchecked Lyft on Sapphire Reserve 2 for November');
const amt2 = page.querySelector(`[data-cp-amt="${SR2}:edit"]`);
amt2.value = '120'; amt2.dispatch('change');
const amt2b = page.querySelector(`[data-cp-amt="${SR2}:edit"]`);
amt2b.value = ''; amt2b.dispatch('change');
check('…and clearing an amount', shown.toasts.at(-1).message, 'Cleared The Edit hotel credit on Sapphire Reserve 2 for 2026');
setup({ cards: [SR] });
open();
app.skipCredit(`${SR}:stubhub`);
check('one card: as before', shown.toasts.at(-1).message, 'Not tracking StubHub / viagogo');
four();
tapPicker(SR);
tapPicker(SR);
check('Your cards: tapped back on says the second card is back', app.body.querySelector('#cards-status').textContent.endsWith('Its second card is back too'), true);
four();
open();
const label = (sel) => page.querySelector(sel).getAttribute('aria-label');
check('labels name the copy: a box', label(`[data-cp-box="${SR2}:doordash"][data-cp-period="2026-11"]`), 'DoorDash on Sapphire Reserve 2, November, $15');
check('…the other copy’s', label(`[data-cp-box="${SR}:doordash"][data-cp-period="2026-11"]`), 'DoorDash on Sapphire Reserve 1, November, $15');
check('…a row’s ✕', label(`[data-cp-skip="${SR2}:doordash"]`), 'Stop tracking DoorDash on Sapphire Reserve 2');
check('…an amount', label(`[data-cp-amt="${SR2}:edit"]`), 'The Edit hotel credit on Sapphire Reserve 2: dollars used so far for 2026');
const list = app.body.querySelector('#credits-list');
const mainLabel = (sel) => list.querySelector(sel).getAttribute('aria-label');
check('…the main page’s Mark used, ✕ and Add a credit', [mainLabel(`[data-credit-use="${SR2}:lyft"]`), mainLabel(`[data-credit-skip="${SR2}:lyft"]`), mainLabel(`[data-credit-add="${SR2}"]`)],
  ['Mark used: Lyft on Sapphire Reserve 2', 'Stop tracking Lyft on Sapphire Reserve 2', 'Add a credit to Sapphire Reserve 2']);
check('…a card with one copy keeps its short labels', [label('[data-cp-box="amex-gold:dining"][data-cp-period="2026-11"]'), label('[data-cp-skip="amex-gold:dining"]')], ['Dining credit, November, $10', 'Stop tracking Dining credit']);

// The first tap after typing lands: the change comes as the press starts, so the redraw waits for it
const pressAway = (field, value, target) => { app.fire('mousedown'); field.value = value; field.dispatch('change'); const stayed = target.isConnected; app.fire('mouseup'); target.dispatch('click'); runTimers(); return stayed; };
four();
open();
let target = section(SR2).querySelector('[data-cp-remove-copy]');
check('typing a name, then straight on to Remove this card: the button’s still there as the press ends', [pressAway(page.querySelector(`[data-cp-copy-name="${SR2}"]`), 'Other', target), shown.toasts.at(-1).message, section(SR2)], [true, 'Removed Other', null]);
check('…its own redraw and focus aren’t held back', [app.document.activeElement.dataset.cpSecond], [SR]);
shown.toasts.at(-1).undo();
const lyftBox = pageBox(`${SR}:lyft`, '2026-11');
const amtField = page.querySelector(`[data-cp-amt="${SR}:edit"]`);
const filterAll = page.querySelector('[data-cp-filter="unused"]');
check('…an amount, then a filter', [pressAway(amtField, '40', filterAll), state().creditsLog[`${SR}:edit`], page.querySelector('[data-cp-filter="unused"]').getAttribute('aria-pressed')], [true, { 2026: 40 }, 'true']);
click('[data-cp-filter="all"]');
app.fire('mousedown');
const dateField = page.querySelector(`[data-cp-copy-name="${SR}"]`);
dateField.value = 'Everyday'; dateField.dispatch('change');
const stale = section(SR).querySelector('h2').text;
check('during a press: saved at once, drawn after', [state().cardCopies[SR].first, stale], ['Everyday', 'Sapphire Reserve 1']);
app.fire('mouseup');
runTimers();
check('…a press that lands on nothing still redraws', section(SR).querySelector('h2').text, 'Everyday');
app.fire('mousedown');
page.querySelector(`[data-cp-copy-name="${SR}"]`).value = 'Daily';
page.querySelector(`[data-cp-copy-name="${SR}"]`).dispatch('change');
runTimers();
check('…and one that never ends (a scrollbar) doesn’t hold it back', section(SR).querySelector('h2').text, 'Daily');
const quiet = page.querySelector(`[data-cp-copy-name="${SR}"]`);
quiet.value = 'Later'; quiet.dispatch('change');
check('…nor the next change', section(SR).querySelector('h2').text, 'Later');
const lyftNow = pageBox(`${SR}:lyft`, '2026-11');
lyftNow.checked = true; lyftNow.dispatch('change');
check('no press at all: drawn straight away', pageBox(`${SR}:lyft`, '2026-11').checked, true);

// The name field: by the heading, live, and clear about what it names
four();
open();
const kids = section(SR2).children;
const at = (cls) => kids.findIndex((k) => k.classList && k.classList.contains(cls));
check('the name field is right under the heading, above the rows', [at('cp-card-head') < at('cp-copy-name'), at('cp-copy-name') < at('cp-rows')], [true, true]);
check('…labelled for what it is', [section(SR2).querySelector('.cp-copy-name').text.startsWith('Card name'), label(`[data-cp-copy-name="${SR2}"]`)], [true, 'Card name for Sapphire Reserve 2']);
const live = page.querySelector(`[data-cp-copy-name="${SR2}"]`);
live.value = 'Biz'; live.dispatch('input');
check('…the heading follows as you type, same field, still focused', [section(SR2).querySelector('h2').text, page.querySelector(`[data-cp-copy-name="${SR2}"]`) === live, state().cardCopies[SR].name], ['Biz', true, 'Biz']);
live.value = 'Sapphire Reserve 1'; live.dispatch('input');
check('…a clash shows as you type too', section(SR2).querySelector('h2').text, 'Sapphire Reserve 1 2');
live.value = 'Biz'; live.dispatch('input');
live.dispatch('change');
app.renderRenewals();
const renewalNames = app.body.querySelectorAll('.renewal-name').map((el) => el.children[0].text);
check('Your cards’ fee rows keep the card’s name beside what you typed', renewalNames.slice(0, 2), ['Sapphire Reserve 1', 'Sapphire Reserve · Biz']);
setup({ cards: [SR], cardCopies: { [SR]: { name: '' } }, creditsAddHidden: true });
open();
click(`[data-cp-remove-copy="${SR}"]`);
check('…no name field with one card', page.querySelector('[data-cp-copy-name]'), null);

// Undo keeps your place
const undoFocus = () => { app.document.activeElement = app.body; shown.toasts.at(-1).undo(); return app.document.activeElement; };
setup({ cards: [SR] });
open();
click('[data-cp-add-card="amex-gold"]');
check('Undo of a chip: focus on that chip', undoFocus().dataset.cpAddCard, 'amex-gold');
click('[data-cp-add-copy="sapphire-reserve"]');
check('…of the second card’s chip', undoFocus().dataset.cpAddCopy, SR);
setup({ cards: [SR], creditsAddHidden: true });
open();
click(`[data-cp-second="${SR}"]`);
check('…of Second card: focus on Second card', undoFocus().dataset.cpSecond, SR);
click(`[data-cp-second="${SR}"]`);
click(`[data-cp-remove-copy="${SR}"]`);
check('…of Remove this card: focus on Remove this card', undoFocus().dataset.cpRemoveCopy, SR);
click(`[data-cp-skip="${SR2}:lyft"]`);
check('…of Stop tracking: focus on that ✕', undoFocus().dataset.cpSkip, `${SR2}:lyft`);
const stopOnMain = list.querySelector(`[data-credit-skip="${SR2}:lyft"]`);
stopOnMain.dispatch('click');
check('…from the main page: back there', undoFocus().dataset.creditSkip, `${SR2}:lyft`);

// Chips hold their place and can be taken back
setup({ cards: [SR] });
open('month');
const before = chips().map((t) => t.slice(2));
click('[data-cp-add-card="amex-gold"]');
click('[data-cp-add-card="delta-gold"]');
click('[data-cp-add-copy="sapphire-reserve"]');
check('a tapped chip keeps its words, so it keeps its width and place', [chips().map((t) => t.slice(2)), chips().filter((t) => t.startsWith('✓')).length], [before, 3]);
check('…and says what happened to a screen reader', [page.querySelector('.cp-offer [data-cp-add-card="amex-gold"]').getAttribute('aria-label'), page.querySelector('.cp-offer [data-cp-add-copy]').getAttribute('aria-label')], ['Amex Gold added. Tap to take it off', 'Second Sapphire Reserve added. Tap to take it off']);
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
check('…the + and ✓ take the same width', /\.cp-mark \{[^}]*display: inline-flex[^}]*width: \.65em/.test(css), true);
shown.grows = 119;
click('[data-cp-add-card="amex-platinum"]');
check('…programs added above the checklist: the page moves to keep the chip where it was', shown.scrollBy.at(-1), 119);
click('[data-cp-add-card="amex-platinum"]');
shown.grows = 0;
check('the row’s ✕ has a place of its own, so it never wraps alone', [/\.cp-offer \{[^}]*position: relative[^}]*padding-right: 44px/.test(css), /\.cp-offer-x \{[^}]*position: absolute/.test(css)], [true, true]);
click('[data-cp-add-card="amex-gold"]');
check('an earlier chip tapped again: that card comes off, the later ones stay', [state().cards, chips().find((t) => t.endsWith('Amex Gold')), chips().find((t) => t.endsWith('Delta Gold')), shown.toasts.at(-1).message], [[SR, 'delta-gold'], '+ Amex Gold', '✓ Delta Gold', 'Took off Amex Gold']);
click('[data-cp-add-copy="sapphire-reserve"]');
check('…the second card’s too', [SR in state().cardCopies, chips().find((t) => t.includes('Second'))], [false, '+ Second Sapphire Reserve']);
click('[data-cp-add-card="amex-gold"]');
check('…and on again', [state().cards, chips().find((t) => t.endsWith('Amex Gold'))], [[SR, 'delta-gold', 'amex-gold'], '✓ Amex Gold']);
const whoChip = page.querySelector('.cp-offer [data-cp-add-card="amex-gold"]');
app.setWho('someone-else');
whoChip.dispatch('click');
check('…not for another person', state().cards.includes('amex-gold'), true);
app.setWho('me');
setup({ cards: [] });
open();
click('[data-cp-add-card="amex-gold"]');
click('[data-cp-add-card="amex-gold"]');
check('the Add your cards panel’s chips stay as they were', state().cards, ['amex-gold']);

// Long names without a space wrap, and a new copy's heading comes into view
check('long names wrap in the card headings and Coming up', [/\.cp-card-head h2 \{[^}]*overflow-wrap: anywhere/.test(css), /\.credit-head h3 \{[^}]*overflow-wrap: anywhere/.test(css), /\.up-body \{[^}]*overflow-wrap: anywhere/.test(css)], [true, true, true]);
setup({ cards: [SR], creditsAddHidden: true });
open();
shown.scrolled.length = 0;
click(`[data-cp-second="${SR}"]`);
check('Second card scrolls to the new section', shown.scrolled.at(-1) === section(SR2), true);
check('…with room above it', /\.cp-card \{[^}]*scroll-margin-top/.test(css), true);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
