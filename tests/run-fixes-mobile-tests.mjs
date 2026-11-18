// Checks phone fixes (from index.html and README.md) against a small fake page and a fake clock: a credit ticked or a
// balance saved where it's already tomorrow (a trip west) staying put, a far-future day still dropped; a Last activity
// date that hasn't happened yet not saved (typed a part at a time on a keyboard, put back when you leave the field); Type balances bringing each field into view and the last row's key saying
// "done"; Return in Voucher going to the next field (not while composing Japanese, Korean or Chinese text); member
// number fields that don't capitalize or autocorrect; the iPhone install tip that works on iOS 26; and the scanner
// not saying "first time only" once its language file is saved on the device (and still starting where Cache Storage
// is blocked).
// Usage: node tests/run-fixes-mobile-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(process.env.HTML_PATH || `${root}index.html`, 'utf8');
const readme = readFileSync(`${root}README.md`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
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
const pieceOr = (from, to, fallback) => (js.includes(from) ? piece(from, to) : fallback);

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

// A small DOM: elements with attributes, simple selectors, events that bubble (with extra fields such as key), focus.
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
      if (k === 'id') this.id = v; if (k === 'class') this.className = v;
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = v;
    }
    getAttribute(k) { return k === 'id' ? (this.id || null) : k === 'class' ? this.className : (k in this.attrs ? this.attrs[k] : null); }
    removeAttribute(k) { delete this.attrs[k]; }
    append(...kids) { for (const k of kids) { if (k == null) continue; if (typeof k === 'string') { const t = new El('#text'); t.textContent = k; t.parentNode = this; this.children.push(t); continue; } if (k.parentNode) k.parentNode.children = k.parentNode.children.filter((c) => c !== k); k.parentNode = this; this.children.push(k); } }
    replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
    replaceWith() {}
    get parentElement() { return this.parentNode; }
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }
    dispatch(type, extra = {}) {
      const e = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
      for (let n = this; n; n = n.parentNode) for (const l of [...n.listeners]) if (l.type === type) l.fn(e);
      return e;
    }
    matches(sel) {
      if (this.tagName === '#TEXT') return false;
      if (sel.includes(',')) return sel.split(',').some((one) => this.matches(one.trim()));
      const m = /^([a-z]+)?((?:[#.][\\w-]+)*)((?:\\[[^\\]]+\\])*)$/i.exec(sel);
      if (!m) throw new Error('selector not supported here: ' + sel);
      if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
      for (const t of m[2].match(/[#.][\\w-]+/g) || []) if (t[0] === '#' ? this.id !== t.slice(1) : !this.classList.contains(t.slice(1))) return false;
      for (const a of m[3].match(/\\[[^\\]]+\\]/g) || []) {
        const [, name, want] = /^\\[([\\w-]+)(?:=["]?([^"\\]]*)["]?)?\\]$/.exec(a);
        const got = this.getAttribute(name);
        if (got == null || (want !== undefined && got !== want)) return false;
      }
      return true;
    }
    closest(sel) { for (let n = this; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n; return null; }
    querySelectorAll(sel) {
      const parts = sel.includes(',') ? [sel] : sel.trim().split(/\\s+(?![^\\[]*\\])/);
      let found = [this];
      for (const part of parts) {
        const next = [];
        for (const root of found) { const walk = (el) => { for (const c of el.children) { if (c.matches(part) && !next.includes(c)) next.push(c); walk(c); } }; walk(root); }
        found = next;
      }
      return found;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    focus() { document.activeElement = this; } blur() {} select() { shown.selected.push(this); }
    scrollIntoView(how) { shown.scrolled.push([this, how]); }
    showModal() { this.open = true; } close() { this.open = false; }
  }
  const body = new El('body');
  const shown = { toasts: [], scrolled: [], selected: [] };
  const document = {
    body, activeElement: null, documentElement: new El('html'),
    createElement: (tag) => new El(tag),
    querySelector(sel) {
      const found = body.querySelector(sel);
      if (found || !/^#[\\w-]+$/.test(sel)) return found;
      const el = new El('div'); el.setAttribute('id', sel.slice(1)); body.append(el); return el; // anything else the app looks up
    },
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener() {},
  };
  // Type balances: the list sits inside its sheet. The voucher form holds its three fields.
  const sheet = new El('dialog'); sheet.setAttribute('id', 'quick-sheet'); body.append(sheet);
  const list = new El('ol'); list.setAttribute('id', 'quick-list'); sheet.append(list);
  const vform = new El('form'); vform.setAttribute('id', 'vform'); body.append(vform);
  for (const id of ['vname', 'vnote', 'vexp']) { const i = new El('input'); i.setAttribute('id', id); vform.append(i); }
  const addEventListener = () => {};
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {};
  const stored = new Map();
  const localStorage = { getItem: (k) => (stored.has(k) ? stored.get(k) : null), setItem: (k, v) => { stored.set(k, String(v)); }, removeItem: (k) => { stored.delete(k); }, key: () => null, length: 0 };
  const CSS = { escape: (s) => s };
  const setTimeout = () => 0; const clearTimeout = () => {};
  const requestAnimationFrame = (fn) => fn();
  const caches = { match: () => Promise.resolve(undefined), has: () => Promise.resolve(false), delete: () => Promise.resolve(true) };
  const window = { caches };
  globalThis.El = El;
`;

let now = new Date(2026, 10, 16, 12); // Mon Nov 16, 2026, noon here
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now.getTime(); }
}
const at = (y, m, d, hour = 12) => { now = new Date(y, m - 1, d, hour); };

const ctx = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Error, Promise });
vm.runInContext(`${fakeDom}
  ${head}
  svgIcon = () => null; // no <template> here
  let state = normalize({ programs: [], cards: [] });
  let saves = 0;
  const showToast = (message, onUndo) => shown.toasts.push({ message, undo: onUndo || null });
  const scheduleSave = () => { saves++; };
  const renderAll = () => {}; const renderUpcoming = () => {}; const rollOver = () => false;
  const medallionProgram = () => null; const mqdYear = () => new Date().getFullYear();
  const relativeDay = () => 'today'; const expiryVerdict = () => new El('p');
  ${piece('  function parseISODate', '  function expiryLine')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  ${piece('  // Balance history for the trend', '  function setField')}
  ${piece('  // One screen to type every balance', "  $('#quick-form').addEventListener('submit'")}
  ${pieceOr("  $('#vform').addEventListener('keydown'", "  $('#vlist').addEventListener('click'", '')}
  let detailId = null;
  const detail = $('#detail');
  const detailProgram = () => (state.programs || []).find((p) => p.id === detailId);
  ${piece("  detail.addEventListener('change'", "  detail.addEventListener('keydown'")}
  const IS_STANDALONE = false; let IS_IOS = true; let installPrompt = null; const hintDismissed = () => false;
  ${piece('  function renderInstallHint', "  addEventListener('beforeinstallprompt'")}
  ${piece('  const OCR_CACHE', '  // Gives up after 2 minutes')}
  globalThis.ui = { normalize, recordBalance, openQuick, renderInstallHint, shown, document, quickSheet, detail,
    getState: () => state, setState: (s) => { state = s; }, saves: () => saves,
    setInstall: (ios, prompt) => { IS_IOS = ios; installPrompt = prompt; }, setDetail: (id) => { detailId = id; } };`, ctx);
const app = ctx.ui;
const { shown, document } = app;
const $ = (sel) => document.querySelector(sel);

/* ---------- 1. A credit ticked where it's already tomorrow stays ticked; a far-future day doesn't ---------- */

at(2026, 11, 1);
check('a saved file keeps a credit day up to 2 days ahead (ticked further east), and drops 3 days ahead and 2099',
  app.normalize({ programs: [], cards: ['sapphire-reserve'], creditsOther: { 'sapphire-reserve:trusted-traveler': '2026-11-03', 'sapphire-reserve:apple': '2026-11-04', 'sapphire-reserve:dashpass': '2099-01-01' } }).creditsOther,
  { 'sapphire-reserve:trusted-traveler': '2026-11-03' });
at(2026, 11, 16);
check('Global Entry ticked in Seoul on Nov 17, opened in Los Angeles on Nov 16: still ticked',
  app.normalize({ programs: [], cards: ['sapphire-reserve'], creditsOther: { 'sapphire-reserve:trusted-traveler': '2026-11-17' } }).creditsOther,
  { 'sapphire-reserve:trusted-traveler': '2026-11-17' });
check('changing a fee date trusts a card-year tick made up to 2 days ahead (same rule)',
  js.includes('known <= end && known <= latestTodayISO()'), true);

/* ---------- 2. A balance saved where it's already tomorrow keeps the history in order ---------- */

const balanceAfter = (history, ...values) => {
  app.setState(app.normalize({ programs: [{ id: 'delta', name: 'Delta SkyMiles', unit: 'miles' }], balances: { delta: 90000 }, updated: { delta: history.at(-1)[0] }, history: { delta: history } }));
  let previous = 90000;
  for (const v of values) { app.recordBalance('delta', previous, v, 't', '2026-09-01'); previous = v; }
  return app.getState().history.delta;
};
check('updated in Los Angeles after one saved in Seoul for Nov 17: that entry is updated, not one dated before it',
  balanceAfter([['2026-10-20', 84210], ['2026-11-17', 90000, 't', '2026-09-01']], 95000),
  [['2026-10-20', 84210], ['2026-11-17', 95000, 't', '2026-09-01']]);
check('a last entry dated 2099 (a wrong clock) isn’t updated forever: today’s is added, and the next update replaces today’s',
  balanceAfter([['2026-10-20', 84210], ['2099-01-01', 90000, 't', '2026-09-01']], 95000, 96000),
  [['2026-10-20', 84210], ['2099-01-01', 90000, 't', '2026-09-01'], ['2026-11-16', 96000, 't', '2026-09-01']]);
check('…nor is one 3 days ahead',
  balanceAfter([['2026-10-20', 84210], ['2026-11-19', 90000, 't', '2026-09-01']], 95000).map((e) => e[0]),
  ['2026-10-20', '2026-11-19', '2026-11-16']);
check('an ordinary update today still adds today’s entry',
  balanceAfter([['2026-10-20', 84210], ['2026-11-01', 90000, 't', '']], 95000),
  [['2026-10-20', 84210], ['2026-11-01', 90000, 't', ''], ['2026-11-16', 95000, 't', '2026-09-01']]);

/* ---------- 3. Last activity: a day that hasn't happened yet isn't saved ---------- */

// Chrome, Edge and Firefox fire a change for each part of the date typed on a keyboard, so the field mustn't be
// rewritten while you're in it: a date that's ahead is just not saved, and put back when you leave the field.
app.setState(app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points' }], activity: { hilton: '2026-04-02' } }));
app.setDetail('hilton');
const activity = new ctx.El('input'); activity.setAttribute('id', 'd-activity'); app.detail.append(activity);
activity.value = '2026-04-02';
const saved = () => app.getState().activity.hilton ?? null;
const into = () => { shown.toasts.length = 0; activity.dispatch('focus'); };
const typed = (v) => { activity.value = v; activity.dispatch('change'); return [activity.value, saved()]; };
const leave = () => { activity.dispatch('focusout'); return [activity.value, saved(), shown.toasts.map((t) => t.message)]; };
const NOT_YET = 'That date hasn’t happened yet, so Last activity wasn’t changed';
into();
check('typing 12/05/2025 month first over 04/02/2026: “1” then “12” (Dec 2 2026, ahead) leaves the field alone and saves nothing ahead',
  [typed('2026-01-02'), typed('2026-12-02')], [['2026-01-02', '2026-01-02'], ['2026-12-02', '2026-01-02']]);
typed('2026-12-05'); typed('2025-12-05');
check('…the day and year land where typed: Dec 5, 2025 saved, no message', leave(), ['2025-12-05', '2025-12-05', []]);
into();
check('typing the year 2062 digit by digit (0002, 0020, 0206, 2062): nothing ahead is saved',
  [typed('0002-12-05'), typed('0020-12-05'), typed('0206-12-05'), typed('2062-12-05')].map((x) => x[1]), [null, null, null, null]);
check('…leaving the field puts back the date it had, with a message', leave(), ['2025-12-05', '2025-12-05', [NOT_YET]]);
into(); typed('2026-11-25');
check('a day later this month (Nov 25): put back on leaving', leave(), ['2025-12-05', '2025-12-05', [NOT_YET]]);
into(); typed('2026-11-18');
check('2 days ahead (today where it was typed, further east) is kept', leave(), ['2026-11-18', '2026-11-18', []]);
into(); typed('2026-10-05');
check('a past date is saved, with no message', leave(), ['2026-10-05', '2026-10-05', []]);
into(); typed('');
check('clearing it still clears it', leave(), ['', null, []]);
into(); typed('2099-01-01');
check('…and a typo after that goes back to empty', leave(), ['', null, [NOT_YET]]);
into();
check('leaving the field with nothing changed says nothing', leave(), ['', null, []]);
// Safari can send focusin after the change: whatever the field remembered, leaving never keeps or saves a day ahead.
typed('2026-10-05'); into(); typed('2062-09-01'); activity.dataset.was = '2062-09-01';
check('…even if the date remembered on the way in is ahead, leaving puts back the saved one', leave(), ['2026-10-05', '2026-10-05', [NOT_YET]]);
// Another program opened while the field still had focus: leaving writes nothing to it, and the first keeps its date.
app.getState().programs.push(app.normalize({ programs: [{ id: 'marriott', name: 'Marriott Bonvoy', unit: 'points' }] }).programs[0]);
into(); typed('2062-01-01'); app.setDetail('marriott'); leave();
check('a date ahead left behind when another program opened isn’t written to that program',
  [app.getState().activity.marriott ?? null, saved()], [null, '2026-10-05']);
app.setDetail('hilton');

/* ---------- 4. Type balances: each field comes into view; the last row's key says done ---------- */

app.setState(app.normalize({ programs: [{ id: 'delta', name: 'Delta SkyMiles', unit: 'miles' }, { id: 'hilton', name: 'Hilton Honors', unit: 'points' }, { id: 'marriott', name: 'Marriott Bonvoy', unit: 'points' }],
  balances: { delta: 1000, hilton: 2000, marriott: 3000 } }));
app.openQuick();
const quickInputs = () => app.quickSheet.querySelectorAll('.quick-input');
check('the last row’s Return key says “done”, the others “next”', quickInputs().map((i) => i.getAttribute('enterkeyhint')), ['next', 'next', 'done']);
shown.scrolled.length = 0; shown.selected.length = 0;
quickInputs()[1].dispatch('focusin');
check('moving to a row selects it and brings it into view (Safari doesn’t, after select())',
  [shown.selected.includes(quickInputs()[1]), shown.scrolled.map(([el, how]) => [el === quickInputs()[1], how])], [true, [[true, { block: 'nearest' }]]]);
shown.scrolled.length = 0;
const enter = quickInputs()[0].dispatch('keydown', { key: 'Enter' });
check('…Return still moves to the next row', [enter.defaultPrevented, document.activeElement === quickInputs()[1]], [true, true]);
const lastEnter = quickInputs()[2].dispatch('keydown', { key: 'Enter' });
check('…and Return on the last row is left to save the sheet', lastEnter.defaultPrevented, false);

/* ---------- 5. Voucher: Return goes Voucher → Value / note → Expires until a date is set ---------- */

const [vname, vnote, vexp] = ['#vname', '#vnote', '#vexp'].map($);
check('Voucher and Value / note show a “next” key', ['vname', 'vnote'].map((id) => new RegExp(`<input id="${id}"[^>]*enterkeyhint="next"`).test(markup)), [true, true]);
document.activeElement = vname;
const fromName = vname.dispatch('keydown', { key: 'Enter', keyCode: 13 });
check('Return in Voucher with no date: to Value / note, nothing submitted', [fromName.defaultPrevented, document.activeElement === vnote], [true, true]);
const fromNote = vnote.dispatch('keydown', { key: 'Enter', keyCode: 13 });
check('…Return in Value / note: to Expires', [fromNote.defaultPrevented, document.activeElement === vexp], [true, true]);
document.activeElement = vname;
const composing = vname.dispatch('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
check('…Return that confirms a Japanese, Korean or Chinese word stays put', [composing.defaultPrevented, document.activeElement === vname], [false, true]);
const safariComposing = vname.dispatch('keydown', { key: 'Enter', isComposing: false, keyCode: 229 });
check('…also when Safari only says so with keyCode 229', [safariComposing.defaultPrevented, document.activeElement === vname], [false, true]);
vexp.value = '2027-03-01';
const withDate = vname.dispatch('keydown', { key: 'Enter', keyCode: 13 });
check('…with a date set, Return adds the voucher as before', [withDate.defaultPrevented, document.activeElement === vname], [false, true]);

/* ---------- 6. Member numbers: no capitals forced, no autocorrect ---------- */

const scanMember = /h\('input', (\{ id: 'scan-member'[^}]*\})\)/.exec(js);
const scanAttrs = scanMember ? vm.runInNewContext(`(${scanMember[1]})`) : {};
check('scanned member number: capitals, no autocorrect or spell check',
  [scanAttrs.autocapitalize, scanAttrs.autocorrect, scanAttrs.spellcheck], ['characters', 'off', 'false']);
check('program sheet’s member number: no autocorrect', /<input id="p-member"[^>]*autocorrect="off"/.test(markup), true);
const detailMember = /h\('input', \{[^}]*id: 'd-member-input'[^}]*\}/.exec(js);
check('details’ member number: no autocorrect', !!detailMember && detailMember[0].includes("autocorrect: 'off'"), true);

/* ---------- 7. The iPhone install tip works with iOS 26 Safari's ••• menu ---------- */

app.setState(app.normalize({ programs: [{ id: 'delta', name: 'Delta SkyMiles', unit: 'miles' }] }));
app.setInstall(true, null);
app.renderInstallHint();
const tip = $('#install-text').textContent;
check('iPhone tip: Share, or ••• then Share, then Add to Home Screen, and why',
  [$('#install').hidden, tip], [false, 'Tap Share (or ••• then Share), then “Add to Home Screen”. It opens like an app, works offline, and Safari is less likely to clear your data.']);
check('…promises nothing Safari doesn’t', tip.includes('won’t clear'), false);
app.setInstall(false, { prompt() {} });
app.renderInstallHint();
check('Chrome’s Install button keeps its own wording', $('#install-text').textContent, 'Install it to open like an app — it works offline too.');
check('README: the same steps', readme.includes('- **iPhone (Safari):** **Share** (or **•••** → **Share**) → **Add to Home Screen**'), true);

/* ---------- 8. The scanner says "first time only" only when it really is ---------- */

const nowLine = /const now = m\.status === [^\n]*;/.exec(js)[0];
const stage = (status, saved) => vm.runInNewContext(`(() => { ${nowLine} return now; })()`, { m: { status }, ocrSaved: saved });
check('first scan on this device: “first time only”', stage('loading tesseract core', false), 'Warming up the scanner (first time only)…');
check('reader already saved: just “Warming up the scanner…”', stage('loading tesseract core', true), 'Warming up the scanner…');
check('…and reading is still “Scanning…”', stage('recognizing text', true), 'Scanning…');
// At startup the app looks for the scanner's language file (the big download) in its cache, once.
const startup = piece('  const OCR_BASE', '  // Gives up after 2 minutes');
const ENG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz';
const boot = async (files, blocked = false) => {
  const stub = { match: (url, o) => Promise.resolve(files.includes(String(url)) && o && o.cacheName === 'status-tracker-ocr-v2' ? { ok: true } : undefined),
    has: (name) => Promise.resolve(files.length > 0 && name === 'status-tracker-ocr-v2'), delete: () => Promise.resolve(true),
    open: () => Promise.resolve({ match: (url) => Promise.resolve(files.includes(String(url)) ? { ok: true } : undefined) }) };
  // A sandboxed frame (no origin): reading caches itself throws.
  const get = () => { if (blocked) throw new Error("SecurityError: Failed to read the 'caches' property from 'Window'"); return stub; };
  const sandbox = { Promise, Error, console, window: {} };
  Object.defineProperty(sandbox, 'caches', { get });
  Object.defineProperty(sandbox.window, 'caches', { get });
  const c = vm.createContext(sandbox);
  try { vm.runInContext(`${startup}\nglobalThis.saved = () => (typeof ocrSaved === 'undefined' ? undefined : ocrSaved);`, c); } catch (e) { return `threw: ${e.message}`; }
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
  return c.saved();
};
check('nothing saved: “first time only”', await boot([]), false);
check('only the small script saved (the first download stopped part way): still “first time only”', await boot([`${'https://cdn.jsdelivr.net/npm/'}tesseract.js@5.1.1/dist/tesseract.min.js`]), false);
check('the language file saved: not a download', await boot([`${'https://cdn.jsdelivr.net/npm/'}tesseract.js@5.1.1/dist/tesseract.min.js`, ENG]), true);
check('where Cache Storage is blocked (a sandboxed frame), the app still starts', await boot([ENG], true), false);
const failPart = piece('      const fail = (err) =>', '        reject(e);');
check('a reader that fails to load (its saved copy is deleted) is a download again next time', /caches\.delete\(OCR_CACHE\)[^\n]*\n\s*ocrSaved = false;/.test(failPart), true);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
