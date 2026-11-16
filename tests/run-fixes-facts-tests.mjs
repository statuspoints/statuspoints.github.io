// Checks dated facts for late 2026 and 2027 (from index.html) against a small fake page and a fake clock, before and
// after each date: Sapphire Reserve for Business's The Edit credit ($500 in 2026, $1,000 from Jan 1, 2027, on the main
// page and the checklist); Qatar's and Etihad's lower qualifying figures dropping off once they end (Nov 30, 2026 and
// Mar 31, 2027); IHG's note for IHG Premier cardmembers from before Chase's Oct 2026 refresh (Platinum through
// Dec 31, 2027), without touching anyone's card status lines; JetBlue's 2027 Mosaic perks; and the Amex Platinum lodging and IHG Business
// anniversary night notes.
// Usage: node tests/run-fixes-facts-tests.mjs  — exits non-zero if any check fails.
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
  const lineExpired = () => false; const mergedLines = () => []; const hasStatus = () => false; const dependsOn = () => ''; const entryOnly = () => false;
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
const { page } = app;

const setup = (fields = {}) => { app.setState(app.normalize({ programs: [], ...fields })); app.shown.toasts.length = 0; };
const def = (cardId, id) => app.cardCreditDefs(cardId).find((c) => c.id === id);
const boxes = (cardId, id, year = now.getFullYear()) => app.creditBoxes(cardId, def(cardId, id), year);
const at = (y, m, d, h = 12, min = 0) => { now = new Date(y, m - 1, d, h, min); };
const open = (fields) => { setup(fields); app.closeCreditsPage(); app.location.hash = ''; app.renderCredits(); app.openCreditsPage(); app.renderUpcoming(); app.renderCredits(); };
const heldOf = (key) => app.heldCredits().find((x) => x.key === key);
const rateOf = (key) => { const el = page.querySelector(`[data-cp-row="${key}"] small`); return el ? el.text : null; };
const yearTab = (which) => page.querySelector(`[data-cp-year="${which}"]`).dispatch('click');

/* ---------- 1. Sapphire Reserve for Business: The Edit, $500 in 2026, $1,000 from Jan 1, 2027 ---------- */

const SRB = 'sapphire-reserve-business';
const EDIT = `${SRB}:edit`;
const SR_EDIT = 'sapphire-reserve:edit';
for (const [y, m, d] of [[2026, 11, 15], [2026, 12, 31]]) {
  at(y, m, d);
  open({ cards: [SRB, 'sapphire-reserve'] });
  const label = `${['', 'Jan', '', '', '', '', '', '', '', '', '', 'Nov', 'Dec'][m]} ${d}, ${y}`;
  check(`${label}: the main page’s Edit credit is $500 for 2026, $500 left`, [heldOf(EDIT).credit.amount, heldOf(EDIT).left, app.creditRate(heldOf(EDIT).credit)], [500, 500, '$500 a year']);
  check(`${label}: the checklist’s 2026 box is $500 and its rate says $500 a year`, [boxes(SRB, 'edit').map((b) => b.amount), /^\$500 a year/.test(rateOf(EDIT))], [[500], true]);
}
check('…a part-used $300 leaves $200 (not $700)', (() => { app.getState().creditsLog[EDIT] = { 2026: 300 }; return heldOf(EDIT).left; })(), 200);
check('…and the 2026 total for the card counts $500 for it', app.creditsPageModel().cards.find((c) => c.card.id === SRB).rows.find((r) => r.key === EDIT).boxes[0].amount, 500);
for (const [y, m, d] of [[2027, 1, 1], [2027, 1, 5]]) {
  at(y, m, d, 0, 1);
  open({ cards: [SRB, 'sapphire-reserve'] });
  check(`Jan ${d}, 2027: the main page’s Edit credit is $1,000, all left`, [heldOf(EDIT).credit.amount, heldOf(EDIT).left, app.creditRate(heldOf(EDIT).credit)], [1000, 1000, '$1,000 a year']);
  check(`Jan ${d}, 2027: the checklist’s 2027 box is $1,000 and its rate says $1,000 a year`, [boxes(SRB, 'edit').map((b) => b.amount), /^\$1,000 a year/.test(rateOf(EDIT))], [[1000], true]);
}
check('…its note says four a year from 2027 (two in 2026)', /four a year from 2027 \(two in 2026\)/.test(def(SRB, 'edit').note), true);
yearTab('past');
check('…looking back at 2026 in 2027: $500 a year, a $500 box', [/^\$500 a year/.test(rateOf(EDIT)), boxes(SRB, 'edit', 2026).map((b) => b.amount)], [true, [500]]);
yearTab('now');
check('…the consumer Sapphire Reserve’s Edit credit stays $500 in 2027', [heldOf(SR_EDIT).credit.amount, boxes('sapphire-reserve', 'edit').map((b) => b.amount), /^\$500 a year/.test(rateOf(SR_EDIT))], [500, [500], true]);
check('…a second Sapphire Reserve for Business gets the same terms', (() => { at(2026, 12, 1); open({ cards: [SRB], cardCopies: { [SRB]: { name: "" } } }); const a = heldOf(`${SRB}~2:edit`); at(2027, 2, 1); return [a && a.credit.amount, heldOf(`${SRB}~2:edit`).credit.amount]; })(), [500, 1000]);
app.closeCreditsPage();

/* ---------- The data tables, read fresh at each date (some are worked out when the app loads) ---------- */

const dataAt = (y, m, d, h = 12) => {
  now = new Date(y, m - 1, d, h);
  const c = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Error, Promise });
  vm.runInContext(`${fakeDom}\n${head}
    ${piece('  function parseISODate', '  function expiryLine')}
    ${piece('  function isoOf', '  // Phones: hand the file')}
    globalThis.data = { BENEFITS, BENEFITS_2027, CARD_BY_ID, CREDITS, CERTS, CATALOG_BY_ID, benefitsFor, programFromCatalog, cardLines, normalize,
      earnNow: typeof earnNow === 'function' ? earnNow : (t) => t };`, c);
  return c.data;
};

/* ---------- 2. Qatar's and Etihad's lower figures stop showing after they end ---------- */

const NAMES = { qatar: ['Silver', 'Gold', 'Platinum'], etihad: ['Silver', 'Gold', 'Platinum', 'Emerald'] };
const tierOf = (data, id, i) => data.BENEFITS[id].find((t) => t.name === NAMES[id][i]);
const earnOf = (data, id, i) => data.earnNow(tierOf(data, id, i).earn);
let data = dataAt(2026, 11, 30, 23);
check('Nov 30, 2026: Qatar still shows its lower figures (last day)', [0, 1, 2].map((i) => earnOf(data, 'qatar', i).includes(['(135', '(270', '(540'][i] + ' through Nov 30, 2026)')), [true, true, true]);
data = dataAt(2026, 12, 1, 0);
check('Dec 1, 2026: Qatar Silver shows just the standing figures', earnOf(data, 'qatar', 0), '150 Qpoints in 12 months, with 20% of them or 4 flights on Qatar Airways');
check('…Gold and Platinum too', [1, 2].map((i) => /through Nov 30/.test(earnOf(data, 'qatar', i))), [false, false]);
check('…Gold keeps the card note', /^300 Qpoints in 12 months, with 20% of them or 4 flights on Qatar Airways \(Gold for the first year/.test(earnOf(data, 'qatar', 1)), true);
check('…Etihad still shows its lower figures until Mar 31, 2027', [0, 1, 2].map((i) => /Mar 31, 2027/.test(earnOf(data, 'etihad', i))), [true, true, true]);
data = dataAt(2027, 3, 31, 23);
check('Mar 31, 2027: Etihad still shows them (last day)', [0, 1, 2].map((i) => /Mar 31, 2027/.test(earnOf(data, 'etihad', i))), [true, true, true]);
data = dataAt(2027, 4, 1, 0);
check('Apr 1, 2027: Etihad Silver shows just the standing figures', earnOf(data, 'etihad', 0), '25,000 Tier Miles in a rolling 12 months, including 10,000 from flying. Renew with 20,000, including 10,000 from flying');
check('…Gold drops its “Until Mar 31, 2027” sentence', earnOf(data, 'etihad', 1), '50,000 Tier Miles in a rolling 12 months, including 20,000 from flying. Renew with 40,000, including 20,000 from flying');
check('…Platinum drops both dated parts', earnOf(data, 'etihad', 2), '125,000 Tier Miles in a rolling 12 months, including 40,000 from flying. Renew with 100,000, including 40,000 from flying');
check('…Emerald still reads true (the reduction to Mar 31, 2027 never applied to it)', [earnOf(data, 'etihad', 3), /not part of/.test(earnOf(data, 'etihad', 3))], [tierOf(data, 'etihad', 3).earn, false]);
check('…other programs’ terms are untouched (every one, in 2028)', (() => { const d28 = dataAt(2028, 6, 1); return Object.entries(d28.BENEFITS).filter(([id]) => !['qatar', 'etihad', 'ihg'].includes(id)).flatMap(([, t]) => t).every((t) => d28.earnNow(t.earn) === t.earn); })(), true);
check('the levels, the details’ “Normally requires” and the calendar’s “To requalify” all use today’s terms',
  [/'level-earn' \}, earnNow\(tier\.earn\)\)/.test(html), /`Normally requires \$\{earnNow\(tier\.earn\)\}`/.test(html), /`To requalify: \$\{earnNow\(info\.earn\)\}\.`/.test(html)],
  [true, true, true]);

/* ---------- 3. IHG Premier: had the card before the Oct 2026 refresh? Platinum through Dec 31, 2027 ---------- */

// The hint lives in IHG's Platinum Elite level, not in the card's status line: a grant's words are part of the line
// the app remembers putting on, so changing them would bring back a line you deleted or changed.
const OLD_VIA = 'IHG Premier · Platinum with $15,000 spend a year';
const ihgPlat = (d) => d.earnNow(d.BENEFITS.ihg.find((t) => t.name === 'Platinum Elite').earn);
for (const day of [[2026, 11, 15], [2027, 12, 31, 23], [2028, 1, 1, 0]]) {
  data = dataAt(...day);
  check(`${day.slice(0, 3).join('-')}: the IHG Premier card's status line is word for word as before (Gold Elite)`, data.cardLines(data.CARD_BY_ID['ihg-premier']).map((l) => [l.tier, l.via]), [['Gold Elite', OLD_VIA]]);
}
data = dataAt(2026, 11, 15);
check('Nov 15, 2026: IHG’s Platinum Elite level says earlier IHG Premier cardmembers keep Platinum through Dec 31, 2027',
  ihgPlat(data), '40 nights or 60,000 qualifying points a year. Until Dec 31, 2027, IHG Premier cardmembers from before Chase’s Oct 2026 card refresh keep Platinum with the card');
data = dataAt(2027, 12, 31, 23);
check('Dec 31, 2027: still says so', /Until Dec 31, 2027, IHG Premier cardmembers/.test(ihgPlat(data)), true);
data = dataAt(2028, 1, 1, 0);
check('Jan 1, 2028: just the nights and points', ihgPlat(data), '40 nights or 60,000 qualifying points a year');
// Loading a tracker (normalize, which brings cards in line with today's CARDS) before and after Jan 1, 2028.
const ihgLoad = (day, status) => {
  let d = dataAt(...day);
  const saved = { programs: [{ id: 'ihg', name: 'IHG One Rewards', unit: 'points', status }], cards: ['ihg-premier'], cardSeen: { 'ihg-premier': [`ihg|Gold Elite|${OLD_VIA}`] } };
  let s = d.normalize(JSON.parse(JSON.stringify(saved)));
  const first = s.programs.find((p) => p.id === 'ihg').status.map((l) => [l.tier, l.via]);
  d = dataAt(2028, 1, 2);
  s = d.normalize(JSON.parse(JSON.stringify(s)));
  return [first, s.programs.find((p) => p.id === 'ihg').status.map((l) => [l.tier, l.via])];
};
for (const day of [[2026, 11, 20], [2027, 12, 31, 23]]) {
  const when = day.slice(0, 3).join('-');
  check(`${when}, then Jan 2, 2028: a Gold line you deleted (your own Platinum line instead) stays deleted`,
    ihgLoad(day, [{ tier: 'Platinum Elite', via: 'kept from before the refresh' }]), [[['Platinum Elite', 'kept from before the refresh']], [['Platinum Elite', 'kept from before the refresh']]]);
  check(`${when}, then Jan 2, 2028: a Gold line you changed to Platinum stays as you left it, with no Gold line back`,
    ihgLoad(day, [{ tier: 'Platinum Elite', via: OLD_VIA }]), [[['Platinum Elite', OLD_VIA]], [['Platinum Elite', OLD_VIA]]]);
  check(`${when}, then Jan 2, 2028: an untouched Gold line stays, once`,
    ihgLoad(day, [{ tier: 'Gold Elite', via: OLD_VIA, card: 'ihg-premier' }]), [[['Gold Elite', OLD_VIA]], [['Gold Elite', OLD_VIA]]]);
}
check('no card’s status words depend on the date', /grants: \[[^\n]*new Date\(/.test(html), false);

/* ---------- 4. JetBlue's 2027 Mosaic perks ---------- */

const jetblue = (d) => d.benefitsFor(d.programFromCatalog(d.CATALOG_BY_ID.jetblue)).map((t) => t.perks.join(' | '));
data = dataAt(2026, 12, 31, 23);
const late26 = jetblue(data);
check('Dec 31, 2026: Mosaic perks as in 2026 (pet fee in Mosaic 1’s Perk You Pick, no BlueFirst)', [/pet fee waiver/.test(late26[0]), late26.some((p) => /BlueFirst/.test(p))], [true, false]);
data = dataAt(2027, 1, 1, 0);
const jan27 = jetblue(data);
check('Jan 1, 2027: every Mosaic level has BlueFirst upgrades for you + 1 companion', jan27.map((p) => /Free space-available upgrades to BlueFirst.*for you \+ 1 companion/.test(p)), [true, true, true, true]);
check('…not dated Feb 1 (they start with the first BlueFirst plane)', jan27.map((p) => /BlueFirst[^|]*Feb 1/.test(p)), [false, false, false, false]);
check('…not on Main Base or EvenMore Base fares', /upgrades to BlueFirst[^|]*not Main Base or EvenMore Base fares/.test(jan27[0]), true);
check('…Mosaic 1’s Perk You Pick: a shorter list from Feb 1, 2027, no pet fee waiver', [/A Mosaic Perk You Pick \(a shorter list from Feb 1, 2027/.test(jan27[0]), /pet fee/i.test(jan27[0])], [true, false]);
check('…Mosaic 2: pet fee waived from Feb 1, 2027 (3 and 4 have everything in Mosaic 2)', [/Pet fee waived from Feb 1, 2027/.test(jan27[1]), /Everything in Mosaic 2/.test(jan27[2])], [true, true]);
check('…the rest of each level’s perks and terms are 2026’s', (data.BENEFITS_2027.jetblue || []).map((t, i) => [t.name, t.earn, t.short, t.perks.length - data.BENEFITS.jetblue[i].perks.length]),
  data.BENEFITS.jetblue.map((t, i) => [t.name, t.earn, t.short, i === 1 ? 2 : 1]));

/* ---------- 5. Notes that read right on both sides of Jan 1, 2027 ---------- */

for (const [y, m, d] of [[2026, 12, 5], [2027, 1, 5]]) {
  data = dataAt(y, m, d);
  const hotel = data.CREDITS['amex-platinum'].find(([id]) => id === 'hotel')[5];
  check(`${y}-${m}-${d}: Amex Platinum lodging note: 2+ nights, 1-night Fine Hotels + Resorts stays only through 2026`, [/2\+ nights/.test(hotel), /from Jan 2027/.test(hotel), /only through 2026/.test(hotel)], [true, false, true]);
  const night = data.CERTS['ihg-premier-business'][0][1];
  check(`${y}-${m}-${d}: IHG Business anniversary night starts with the 2027 cap`, night, 'Up to 50,000 points a night for nights issued from 2027 (40,000 before); you can add points');
}

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
