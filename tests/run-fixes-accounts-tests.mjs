// Checks two accounts in one program (from index.html) against a small fake page: the screenshot card and its
// account chooser, the review sheet reached from it, a page listing several statuses, Undo, the Edit sheet, and the
// text that names each account.
// Usage: node tests/run-fixes-accounts-tests.mjs  — exits non-zero if any check fails.
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

// A small DOM: enough of elements, selects (a value with no matching option is '', as in a browser), dialogs and
// events for the card, the review sheet and the Edit sheet.
const fakeDom = `
  class El {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.listeners = []; this._value = ''; this.checked = false;
      this.hidden = false; this.className = ''; this.textContent = ''; this.dataset = {}; this.id = ''; this.type = ''; this.open = false; this.defaultValue = '';
      this.style = { setProperty() {}, cssText: '' };
      const cl = () => this.className.split(' ').filter(Boolean);
      this.classList = { add: (...n) => { this.className = [...new Set([...cl(), ...n])].join(' '); }, remove: (...n) => { this.className = cl().filter((c) => !n.includes(c)).join(' '); },
        toggle: (n) => { const has = cl().includes(n); if (has) this.classList.remove(n); else this.classList.add(n); return !has; }, contains: (n) => cl().includes(n) };
    }
    get options() { const out = []; const walk = (el) => { for (const c of el.children) { if (c.tagName === 'OPTION') out.push(c); walk(c); } }; walk(this); return out; }
    get value() {
      if (this.tagName !== 'SELECT') return this._value;
      const opts = this.options;
      return opts.some((o) => o._value === this._value) ? this._value : (opts[0] ? opts[0]._value : '');
    }
    set value(v) { this._value = String(v); }
    get content() { return { firstChild: null }; }
    get innerText() { return [this.textContent, ...this.children.map((c) => c.innerText)].filter(Boolean).join('\\n'); }
    setAttribute(k, v) {
      if (k === 'id') this.id = v; if (k === 'checked') this.checked = true; if (k === 'value') { this._value = String(v); this.defaultValue = String(v); }
      if (k === 'type') this.type = v; if (k === 'class') this.className = v; if (k === 'src') this.src = v;
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = String(v);
    }
    removeAttribute(k) { if (k === 'src') delete this.src; }
    append(...kids) { for (const k of kids) { if (typeof k === 'string') { this.textContent += k; continue; } if (k.parentNode) k.parentNode.children = k.parentNode.children.filter((c) => c !== k); k.parentNode = this; this.children.push(k); } }
    replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
    remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    get parentElement() { return this.parentNode; }
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }
    dispatch(type) { const e = { type, target: this, preventDefault() {} }; for (let n = this; n; n = n.parentNode) for (const l of [...n.listeners]) if (l.type === type) { e.currentTarget = n; l.fn(e); } }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    matches(sel) {
      if (sel === 'dialog[open]') return this.tagName === 'DIALOG' && this.open;
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) return this.className.split(' ').includes(sel.slice(1));
      const m = /^(\\w+)\\[type="(\\w+)"\\]$/.exec(sel); if (m) return this.tagName === m[1].toUpperCase() && this.type === m[2];
      return this.tagName === sel.toUpperCase();
    }
    closest(sel) { for (let n = this; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n; return null; }
    querySelectorAll(sel) {
      const [first, ...rest] = sel.trim().split(/\\s+/);
      const out = [];
      const walk = (el) => { for (const c of el.children) { if (c.matches(first)) out.push(c); walk(c); } };
      walk(this);
      return rest.length ? out.flatMap((el) => el.querySelectorAll(rest.join(' '))) : out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    focus() {} select() {} getBoundingClientRect() { return {}; }
  }
  const body = new El('body');
  const make = (tag, id, parent = body) => { const e = new El(tag); e.setAttribute('id', id); parent.append(e); return e; };
  const playEl = make('dialog', 'play');
  for (const id of ['play-shot', 'play-img', 'play-loot', 'play-title', 'play-xp', 'play-actions', 'play-marks', 'play-count', 'play-skip', 'play-close']) make('div', id, playEl);
  const scanEl = make('dialog', 'scan-sheet');
  for (const id of ['scan-result', 'scan-start', 'scan-again', 'scan-status', 'scan-apply', 'scan-preview', 'scan-text', 'scan-file']) make('div', id, scanEl);
  const sheetEl = make('dialog', 'sheet');
  const formEl = make('form', 'sheet-form', sheetEl);
  for (const id of ['sheet-title', 'p-name', 'p-unit', 'p-member', 'p-who', 'p-medallion', 'p-medallion-wrap', 'p-status', 'p-delete', 'p-add-status', 'p-cancel']) make(id === 'p-status' ? 'div' : 'input', id, formEl);
  make('div', 'say'); make('div', 'achieve');
  const document = { body, querySelector: (sel) => body.querySelector(sel), querySelectorAll: (sel) => body.querySelectorAll(sel), createElement: (tag) => new El(tag) };
`;
const base = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const URL = { createObjectURL: () => 'blob:shot', revokeObjectURL() {} };
  const shown = { toasts: [], undo: null, countdowns: 0, played: [], timers: [] };
  // Timers wait for flush(), as the next screenshot in a batch waits for the points to land.
  const setTimeout = (fn) => { shown.timers.push(fn); return shown.timers.length; };
  const setInterval = () => { shown.countdowns++; return 1; };
  const clearInterval = () => {};
`;
const ctx = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON, TypeError, Promise });
vm.runInContext(`${base}${fakeDom}
  ${head}
  ${piece('  function parseISODate', '  function expiryLine')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  svgIcon = () => null; // no <template> here
  let state = normalize({ programs: [], cards: [] });
  const game = () => state.game;
  const topLayer = () => body;
  const showToast = (message, onUndo) => { shown.toasts.push(message); shown.undo = onUndo || null; };
  const hideToast = () => {}; const showNote = (m) => shown.toasts.push(m);
  const renderAll = () => {}; const renderPrograms = () => {}; const renderSafely = () => {}; const rollOver = () => false;
  const saveNow = () => {}; const markChanged = () => {}; const scheduleSave = () => {}; const skipNewsForNewSetup = () => {};
  const award = () => ({ xp: 0, unlocked: [] }); const offerBonusLanding = () => {}; const matchesFilter = () => true; let filter = 'all';
  const unlockSound = () => true; const sound = () => {}; const gameIcon = () => null;
  const setField = (k, v) => { const [a, id] = k.split(/:(.*)/s); if (a === 'bal') state.balances[id] = v; else if (a === 'prog') state.progress[id] = v; else state.mqd = v; state.updated[a === 'mqd' ? 'mqd' : id] = todayISO(); };
  let combo = 0; let lastCollectAt = 0;
  ${piece('  const signed', '\n')}
  ${piece('  const lineExpired', '\n')}
  ${piece('  const daysLeft', '\n')}
  ${piece('  const medallionProgram', '\n')}
  ${piece('  const mdy', '\n')}
  const mqdYear = () => new Date().getFullYear();
  ${piece('  function mqdGoal', '  function mqdNextText')}
  ${piece('  function medallionFor', '  function updateMedallion')}
  ${piece('  function relativeDay', '  function openDetail')}
  ${piece('  function parseEntry', '  function paintNum')}
  ${piece('  // Words that identify each program in an account screen', '  // Loads the open-source text reader')}
  ${piece('  const scanSheet = ', '  let pickHint')}
  let pickHint = null; let replacePick = false;
  const pickImage = () => {}; const pickFor = (id) => { pickHint = { id, at: Date.now() }; }; const pickAnother = () => {};
  let autoCollect = true;
  ${piece("  const play = $('#play');", '  // Another sheet is open')}
  const playScan = (file, hint = null) => { shown.played.push(file); playing = { url: 'blob:shot', hint, taken: null }; };
  ${piece('  function setActions', '  // What a recognized screen updates')}
  ${piece('  // What a recognized screen updates', '  async function celebrate')}
  const celebrate = () => { if (batch) setTimeout(nextInQueue); };
  let quietClose = false;
  scanSheet.addEventListener('close', () => { if (quietClose) { quietClose = false; return; } if (batch) { finishOne(false); nextInQueue(); } });
  ${piece('  const sheet = $(\'#sheet\');', "  $('#p-name').addEventListener")}
  ${piece("  $('#sheet-form').addEventListener('submit'", "  $('#p-cancel')")}
  globalThis.api = {
    $, shown, normalize, programFromCatalog, CATALOG_BY_ID, nameOf, showLoot, collect, accountFor, programOptions, showScanResult, scanFields, formVals, applyScan, undoTo,
    staleCounts, readYears, fixPlay, collectNow, openSheet, cleanPrograms, sheetEl, formEl, playEl, scanEl,
    get state() { return state; }, set state(s) { state = s; }, get playing() { return playing; }, set playing(p) { playing = p; },
    get batch() { return batch; }, set batch(b) { batch = b; }, scanQueue, flush: () => { while (shown.timers.length) shown.timers.shift()(); }, set autoCollect(v) { autoCollect = v; }, setHint: (id) => { pickHint = { id, at: Date.now() }; },
  };`, ctx);
const { api } = ctx;
const { $, shown } = api;

// A screenshot read as text: one reading, no word boxes.
const shot = (text) => ({ text, passes: [{ text, lines: [] }], width: 100, height: 100 });
const program = (id) => api.programFromCatalog(api.CATALOG_BY_ID[id]);
const reset = (programs, extra = {}) => {
  api.state = api.normalize({ programs, cards: [], ...extra });
  shown.toasts.length = 0; shown.undo = null; shown.countdowns = 0; shown.played.length = 0;
  api.batch = null; api.scanQueue.length = 0; shown.timers.length = 0;
  api.playEl.open = true;
  api.playing = { url: 'blob:shot', hint: null, taken: null };
};
// Two Leading Hotels of the World rows: yours (number 5523190) and Ms. Lee's (7781204).
const twoLhw = (extra = {}) => {
  const mine = program('lhw');
  const hers = { ...program('lhw'), id: 'lhw-2', who: 'Ms. Lee' };
  reset([mine, hers], { members: { lhw: '5523190', 'lhw-2': '7781204' }, balances: { lhw: 1200, 'lhw-2': 300 }, ...extra });
};
const title = () => $('#play-title').textContent;
const actions = () => $('#play-actions').children.map((b) => b.innerText.replace(/\n.*/s, ''));
const lootText = () => $('#play-loot').children.map((li) => li.innerText.replace(/\n/g, ' | '));
const tap = (label) => { const btn = $('#play-actions').children.find((b) => b.innerText.startsWith(label)); if (!btn) throw new Error(`no button ${label}`); btn.dispatch('click'); };

/* ---------- The card: which account a screen goes to ---------- */

const herScreen = 'Welcome Back\nMs. Lee\nLeaders Club Member\nMember ID 7781204\n320 Points';
const myScreen = 'Welcome Back\nDr. Cho\nLeaders Club Member\nMember ID 5523190\n1,450 Points';
const unnumbered = 'Leaders Club Member\n1,450 Points';
const strangerScreen = 'Leaders Club Member\nMember ID 9000001\n5,050 Points';

twoLhw();
api.showLoot(shot(herScreen));
check('her number on the screen: the card reads it as her account and counts down', [title(), api.playing.choice, api.playing.vals.balance, shown.countdowns], ['Found your Leading Hotels of the World (Ms. Lee)', 'lhw-2', 320, 1]);
api.collectNow();
check('…and Update saves to her row only', [api.state.balances['lhw-2'], api.state.balances.lhw, shown.toasts.pop()], [320, 1200, 'Updated Leading Hotels of the World (Ms. Lee)']);

twoLhw();
api.showLoot(shot(unnumbered));
check('no number and no name, two accounts: the card asks, with no countdown', [title(), shown.countdowns, actions()], ['Which Leading Hotels of the World account is this?', 0, ['Try another', 'Read it']]);
check('…the chooser lists both rows by name and number, then New account', $('#play-program').options.map((o) => [o.value, o.innerText]),
  [['lhw', 'Leading Hotels of the World · •••• 3190'], ['lhw-2', 'Leading Hotels of the World (Ms. Lee) · •••• 1204'], ['new:lhw', 'New account']]);
$('#play-program').value = 'lhw-2';
tap('Read it');
check('…choosing her row reads it as hers', [api.playing.choice, api.playing.vals.balance], ['lhw-2', 1450]);
api.collectNow();
check('…and saves there', [api.state.balances['lhw-2'], api.state.balances.lhw], [1450, 1200]);

twoLhw();
api.showLoot(shot(strangerScreen));
check('a third number: the card asks, New account preselected', [title(), $('#play-program').value, shown.countdowns], ['Which Leading Hotels of the World account is this?', 'new:lhw', 0]);
tap('Read it');
check('…reading it as a new account names it so', [title(), api.playing.choice, lootText()[0]], ['New Leading Hotels of the World account', 'new:lhw', 'LHW | Leading Hotels of the World | Adding a second account — name it in Edit | New']);
api.collectNow();
const third = api.state.programs[2];
check('…Update adds a third row with its own number and balance, the others untouched', [api.state.programs.length, api.state.members[third.id], api.state.balances[third.id], api.state.balances.lhw, api.state.balances['lhw-2']], [3, '9000001', 5050, 1200, 300]);
shown.undo();
check('…Undo takes the row and its data away again', [api.state.programs.map((p) => p.id), api.state.members[third.id] ?? null, api.state.balances[third.id] ?? null], [['lhw', 'lhw-2'], null, null]);

/* ---------- "Update X" tapped on one row, when the screen is the other account's ---------- */

// The screen doesn't name the program, so the row you tapped is the hint; but its number is the other row's.
const unnamedHers = 'Welcome Back\nMs. Lee\nMember ID 7781204\n320 Points';
twoLhw();
api.playing.hint = 'lhw';
api.showLoot(shot(unnamedHers));
check('tapped Update on your row, but the screen shows her number: it goes to her row', [api.playing.choice, title()], ['lhw-2', 'Found your Leading Hotels of the World (Ms. Lee)']);

// The screen names the program but no account: the row you tapped Update on is the one, no question asked.
twoLhw({ balances: { lhw: 1200, 'lhw-2': 1300 } }); // hers near the screen's 1,450: no balance doubt
api.playing.hint = 'lhw-2';
api.showLoot(shot(unnumbered));
check('tapped Update on her row, a screen with no number: read as hers without asking', [api.playing.choice, shown.countdowns], ['lhw-2', 1]);
twoLhw({ members: { lhw: '5523190' } });
api.playing.hint = 'lhw-2';
api.showLoot(shot(strangerScreen.replace('5,050', '450')));
check('tapped Update on her row (no number saved for it), a screen with a new number: hers, and the number is saved to it', [api.playing.choice, api.playing.vals.member, shown.countdowns], ['lhw-2', '9000001', 1]);
twoLhw();
api.playing.hint = 'lhw';
api.showLoot(shot(strangerScreen));
check('tapped Update on your row, but the screen shows a number neither row has: still asks (it may be a third account)', [title(), $('#play-program').value], ['Which Leading Hotels of the World account is this?', 'new:lhw']);

// Her number, but you picked your row by hand (the review sheet, or the chooser): the card says so and waits.
twoLhw();
api.showLoot(shot(herScreen.replace('320', '900')), 'lhw'); // 900: no balance doubt
check('read as your row while the screen shows her number: Check this first, no countdown', [lootText()[1], shown.countdowns],
  ['Check this first | the member number on this screen (•••• 1204) is saved for your Leading Hotels of the World (Ms. Lee) account.', 0]);
const quietStranger = strangerScreen.replace('5,050', '1,450'); // close to the saved 1,200: no balance doubt
twoLhw({ members: { lhw: '5523190' } });
api.showLoot(shot(quietStranger), 'lhw');
check('read as your row while the screen shows a number that isn’t yours: Check this first, no countdown', [lootText()[1], shown.countdowns],
  ['Check this first | the member number on this screen (•••• 0001) isn’t the one saved for this account (•••• 3190).', 0]);
twoLhw({ members: { 'lhw-2': '7781204' } });
api.showLoot(shot(quietStranger), 'lhw');
check('…but a row with no number saved takes a new number without a word', [lootText().some((t) => t.startsWith('Check this first')), shown.countdowns], [false, 1]);
twoLhw();
api.showLoot(shot('Welcome Back\nMs. Lee\nLeaders Club Member\n320 Points'), 'lhw');
check('read as your row while the screen greets Ms. Lee: Check this first', [lootText()[1], shown.countdowns],
  ['Check this first | the screen greets “Ms. Lee”, your Leading Hotels of the World (Ms. Lee) account’s label.', 0]);

/* ---------- Fix something from a "New account" card: the review sheet keeps the new account ---------- */

twoLhw();
api.showLoot(shot(strangerScreen), 'new:lhw');
api.fixPlay();
check('the sheet’s program list offers the new account, and it’s chosen', [$('#scan-program').value, $('#scan-program').options.map((o) => o.value).slice(0, 3)],
  ['new:lhw', ['new:lhw', 'lhw', 'lhw-2']]);
check('…its rows are a new account’s: no “Now 1,200”, the number ticked to save', [$('#scan-result').innerText.includes('Now 1,200'), $('#scan-use-member').checked, $('#scan-member').value, $('#scan-status').textContent],
  [false, true, '9000001', 'Looks like a new Leading Hotels of the World account. Check what was read, then Update.']);
api.applyScan();
check('…and Update from the sheet adds the new row, leaving yours alone', [api.state.programs.length, api.state.balances[api.state.programs[2].id], api.state.members[api.state.programs[2].id], api.state.balances.lhw], [3, 5050, '9000001', 1200]);
twoLhw();
api.showLoot(shot('Hello Jordan Kim\nLeaders Club Member\nMember ID 9000001\n5,050 Points'), 'new:lhw');
api.fixPlay();
api.applyScan();
check('…a new account from the sheet keeps the greeting as its label', api.state.programs[2].who, 'Jordan Kim');
// Two rows with no labels or numbers still read apart on the sheet.
reset([program('lhw'), { ...program('lhw'), id: 'lhw-2' }], { members: { 'lhw-2': '7781204' } });
check('two unlabeled rows: the sheet’s list tells them apart by number', api.programOptions(null)[1].children.map((o) => o.innerText),
  ['Leading Hotels of the World', 'Leading Hotels of the World · •••• 1204']);

/* ---------- Text pasted into the review sheet, with two accounts ---------- */

twoLhw();
api.showScanResult(herScreen);
check('pasted text with her number: the sheet starts on her row', [$('#scan-program').value, $('#scan-status').textContent], ['lhw-2', 'Looks like Leading Hotels of the World (Ms. Lee). Check what was read, then Update.']);
api.showScanResult(unnumbered);
check('pasted text with no number, two rows: the sheet makes you pick the account', [$('#scan-program').value, $('#scan-program').options.slice(0, 4).map((o) => [o.value, o.innerText]), $('#scan-status').textContent],
  ['', [['', 'Which account?'], ['new:lhw', 'New Leading Hotels of the World account'], ['lhw', 'Leading Hotels of the World'], ['lhw-2', 'Leading Hotels of the World (Ms. Lee)']],
    'Looks like Leading Hotels of the World, but which account? Pick it below, then check what was read.']);
api.applyScan();
check('…Update without picking does nothing', [api.state.balances.lhw, api.state.balances['lhw-2'], shown.toasts], [1200, 300, []]);
api.showScanResult(strangerScreen);
check('pasted text with a third number: pick the account too', $('#scan-program').value, '');
reset([program('lhw')], { members: { lhw: '5523190' } });
api.showScanResult(strangerScreen);
check('one row with a number saved, a different number pasted: pick, as the card would ask', $('#scan-program').value, '');
$('#scan-program').value = 'new:lhw';
api.applyScan();
check('…and New account from the sheet adds the row with that number', [api.state.programs.length, api.state.members[api.state.programs[1].id]], [2, '9000001']);

/* ---------- A screen that doesn't name its program, with two accounts whose level it shows ---------- */

{
  // "Platinum Elite" with only IHG rows listed (Marriott has it too, but isn't on the list).
  const two = () => reset([program('ihg'), { ...program('ihg'), id: 'ihg-2', who: 'Ms. Lee' }], { members: { ihg: '5523190', 'ihg-2': '123456789' }, balances: { ihg: 40000, 'ihg-2': 26000 } });
  two();
  api.showLoot(shot('Platinum Elite Member\nMember #123456789\nYOUR POINTS\n26,948'));
  check('an unnamed screen with a level of IHG’s, two IHG rows: her number picks her row, and the card asks you to make sure',
    [api.playing.choice, title(), lootText()[1]], ['ihg-2', 'This looks like your IHG One Rewards (Ms. Lee)', 'Check this first | the screenshot doesn’t name the program, so make sure it’s this one.']);
  two();
  api.showLoot(shot('Platinum Elite Member\nYOUR POINTS\n26,948'));
  check('…with no number: the account chooser, not the whole program list', [title(), $('#play-program').options.map((o) => o.value)], ['Which IHG One Rewards account is this?', ['ihg', 'ihg-2', 'new:ihg']]);
  tap('Read it');
  check('…and the account picked there is read with the same make-sure note', [api.playing.choice, title(), lootText()[1], shown.countdowns],
    ['ihg', 'This looks like your IHG One Rewards', 'Check this first | the screenshot doesn’t name the program, so make sure it’s this one.', 0]);
  reset([program('ihg'), program('hilton')], { members: { ihg: '5523190' } });
  api.showLoot(shot('Platinum Elite Member\nYOUR POINTS\n26,948'));
  check('one IHG row: guessed as before', [api.playing.choice, title()], ['ihg', 'This looks like your IHG One Rewards']);
  reset([program('ihg'), program('marriott')]);
  api.showLoot(shot('Platinum Elite Member\nYOUR POINTS\n26,948'));
  check('IHG and Marriott both have Platinum Elite: no guess, you pick the program', title(), 'Which program is this?');
}

/* ---------- A page listing several statuses, with two accounts in one of its programs ---------- */

const benefits = `Marriott Bonvoy® Gold Elite Status\nMarriott Bonvoy Number: - 4471\nHilton Honors™ Gold Status\nHilton Honors Number: 2045318860\nLeaders Club Sterling Status from The\nLeading Hotels of the World®\nLeaders Club Number: 5523190`;
twoLhw();
api.showLoot(shot(benefits));
check('a benefits page naming your LHW number: your row, counting down', [title(), api.playing.many.map((it) => it.choice), shown.countdowns],
  ['Found 3 statuses on this page', ['add:marriott', 'add:hilton', 'lhw'], 1]);
twoLhw();
api.showLoot(shot(benefits.replace('5523190', '9000001')));
check('a benefits page with an LHW number that’s neither row’s: the LHW line is left alone and says so; the rest counts down',
  [shown.countdowns, lootText().find((t) => t.includes('Leading Hotels'))],
  [1, 'LHW | Leading Hotels of the World | Leaders Club Sterling | Which of your accounts? Not updated']);
check('…and that number isn’t saved to either row', api.playing.many[2].own, null);
api.collectNow();
check('…Update all saves the other statuses; both LHW rows are untouched', [api.state.programs.find((p) => p.id === 'lhw').status.map((l) => l.tier), api.state.members.lhw, api.state.programs.filter((p) => p.name.startsWith('Leading')).length], [[], '5523190', 2]);
twoLhw();
api.showLoot(shot(benefits.replace('\nLeaders Club Number: 5523190', '')));
check('a benefits page with no LHW number, two rows: the LHW line is left alone', [shown.countdowns, lootText().find((t) => t.includes('Leading Hotels'))],
  [1, 'LHW | Leading Hotels of the World | Leaders Club Sterling | Which of your accounts? Not updated']);
reset([program('lhw')], { members: { lhw: '5523190' } });
api.showLoot(shot(benefits));
check('one LHW row: a benefits page counts down as before', [shown.countdowns, lootText().some((t) => t.includes('Check this first'))], [1, false]);

// Update all from the benefits page: one toast with one Undo for every program on it.
twoLhw();
api.showLoot(shot(benefits));
api.collectNow();
api.flush();
check('Update all: one toast for the page, your LHW row holding the status, nothing on hers', [shown.toasts, api.state.programs.map((p) => p.status.map((l) => l.tier)), api.state.programs.length],
  [['Updated 3 programs'], [['Leaders Club Sterling'], [], ['Gold Elite'], ['Gold']], 4]);
shown.undo();
check('…and its Undo takes all of it back', [api.state.programs.map((p) => p.id), api.state.programs[0].status], [['lhw', 'lhw-2'], []]);

// A batch of screenshots, one of each account: each goes to its own row, with one Undo for both.
twoLhw();
api.playEl.open = false;
api.batch = { total: 2, done: 0, collected: 0, xp: 0, before: JSON.parse(JSON.stringify(api.state)), person: 'me' };
api.collect('lhw', { balance: 1450 }, null, null);
api.collect('lhw-2', { balance: 320 }, null, null);
api.flush();
check('a batch with one screenshot of each account: each row updated, one toast', [api.state.balances.lhw, api.state.balances['lhw-2'], shown.toasts], [1450, 320, ['Updated from 2 screenshots']]);
shown.undo();
check('…and its Undo puts both back', [api.state.balances.lhw, api.state.balances['lhw-2']], [1200, 300]);

/* ---------- Counts from last year, for a second account ---------- */

{
  reset([program('hilton')], { members: { hilton: '1111' } });
  const years = { mqd: new Date().getFullYear() - 1, prog: new Date().getFullYear() - 1 };
  check('a second Hilton account read last year: its nights are stale too', api.staleCounts('new:hilton', { balance: 10, progress: 12 }, years), ['progress']);
  api.playing.taken = `${new Date().getFullYear() - 1}-12-20`;
  api.showLoot(shot('Hilton Honors\nGold Member\nPoints 12,000\nNights this year 12\nHilton Honors # 2222'), 'new:hilton');
  check('…so the card for it leaves last year’s nights out', api.playing.vals.progress, undefined);
}

/* ---------- Storage: the label round-trips, cut to size ---------- */

{
  const clean = api.cleanPrograms([{ id: 'a', name: 'Hilton Honors', unit: 'points', status: [], who: 'Ms. Lee' },
    { id: 'b', name: 'Hilton Honors', unit: 'points', status: [], who: 'x'.repeat(40) }, { id: 'c', name: 'Hilton Honors', unit: 'points', status: [], who: 42 },
    { id: 'd', name: 'Hilton Honors', unit: 'points', status: [], who: '   ' }]);
  check('the label is kept, cut to 30 characters, dropped when not text or blank', clean.map((p) => p.who ?? null), ['Ms. Lee', 'x'.repeat(30), null, null]);
}

/* ---------- A card's status stays with the account the card is on ---------- */

{
  // Your Hilton row holds Gold from the Amex Platinum; Ms. Lee's second row doesn't get it on load, or when the card
  // is added again.
  const s = api.normalize({ programs: [program('hilton'), { ...program('hilton'), id: 'hilton-2', who: 'Ms. Lee' }], cards: ['amex-platinum'] });
  const hiltons = (t) => t.programs.filter((p) => p.name === 'Hilton Honors').map((p) => p.status.map((l) => `${l.tier}|${l.card || ''}`));
  check('a card’s status goes on your row, not the second account’s', hiltons(s), [['Gold|amex-platinum'], []]);
  check('…and stays that way on the next load', hiltons(api.normalize(JSON.parse(JSON.stringify(s)))), [['Gold|amex-platinum'], []]);
}

/* ---------- The Edit sheet: labeling one row, deleting the other ---------- */

twoLhw();
api.openSheet('lhw-2');
check('Edit shows her label and number', [$('#p-who').value, $('#p-member').value], ['Ms. Lee', '7781204']);
$('#p-who').value = 'Ms. Lee Park';
api.formEl.dispatch('submit');
check('…saving a new label keeps her row’s id, number and balance', [api.state.programs[1].who, api.state.programs[1].id, api.state.members['lhw-2'], api.state.balances['lhw-2']], ['Ms. Lee Park', 'lhw-2', '7781204', 300]);
api.openSheet('lhw');
$('#p-delete').dispatch('click');
check('deleting your row leaves hers with everything', [api.state.programs.map((p) => p.id), api.state.members['lhw-2'], api.state.balances['lhw-2'], api.state.balances.lhw ?? null], [['lhw-2'], '7781204', 300, null]);
shown.undo();
check('…and Undo brings yours back with its number and balance', [api.state.programs.map((p) => p.id), api.state.members.lhw, api.state.balances.lhw], [['lhw', 'lhw-2'], '5523190', 1200]);
// Adding the program again by hand, with a label: a third row with its own id.
api.openSheet(null);
$('#p-name').value = 'Leading Hotels of the World';
$('#p-unit').value = 'points';
$('#p-who').value = 'Jordan';
$('#p-member').value = '9000001';
api.formEl.dispatch('submit');
check('Add program with a label: a third row of its own, the others untouched', [api.state.programs.length, api.state.programs[2].who, api.state.programs[2].id !== 'lhw' && api.state.programs[2].id !== 'lhw-2', api.state.members[api.state.programs[2].id], api.state.members.lhw],
  [3, 'Jordan', true, '9000001', '5523190']);

/* ---------- Similar labels: "Lee" and "Lee Park" ---------- */

twoLhw();
api.state.programs[0].who = 'Lee';
api.state.programs[1].who = 'Lee Park';
const named = (name) => { const r = api.accountFor('lhw', null, name); return [r.own ? r.own.id : null, r.ask]; };
check('the greeting "Lee Park" fits both labels: ask', named('Lee Park'), [null, true]);
check('the greeting "Lee" fits both labels: ask', named('Lee'), [null, true]);
check('the greeting "Lee Kim" fits "Lee", but "Lee Park" shares the name: ask', named('Lee Kim'), [null, true]);
api.state.programs[1].who = 'Jordan';
check('…with "Lee" and "Jordan" labeled, "Lee Kim" is Lee’s', named('Lee Kim'), ['lhw', false]);
check('…and "Jordan Park" is Jordan’s', named('Jordan Park'), ['lhw-2', false]);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
