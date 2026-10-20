// Checks qualifying progress (from index.html): a new year keeps last year's earned levels even when the page
// stayed open over New Year, the United flights path, card statuses with an end date, and the nights pace.
// Usage: node tests/run-fixes-progress-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// The app's constants and helpers up to load() (progress, levels, normalize), plus the pieces declared later that
// they use: dates, roll-over and the Medallions you hold, editing a number, the quick-update sheet, the small
// progress line under a program, and applying what a screenshot showed.
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => { const at = js.indexOf(from); return js.slice(at, js.indexOf(to, at)); };

// A clock the checks can set: `new Date()` and `Date.now()` give it; dates built from parts work as usual.
let now = new Date(2026, 9, 8, 12).getTime();
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now; }
}
const setNow = (y, m, d) => { now = new Date(y, m - 1, d, 12).getTime(); };

// Elements are plain objects: enough for h(), for startEdit to swap a button for an input, and for the quick-update
// sheet (its list, inputs, and the handlers it adds).
const element = (tag) => ({
  tag, attrs: {}, dataset: {}, kids: [], className: '', value: '', handlers: {},
  setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; },
  append(...kids) { this.kids.push(...kids); }, replaceChildren(...kids) { this.kids = kids; },
  replaceWith() {}, focus() {}, select() {}, setSelectionRange() {},
  addEventListener(type, fn) { this.handlers[type] = fn; },
});
// The page elements $() finds: the quick-update sheet, its list, and its form.
const inputsIn = (el) => (el && typeof el === 'object' ? (el.tag === 'input' ? [el] : el.kids.flatMap(inputsIn)) : []);
const page = { '#quick-list': element('ol'), '#quick-form': element('form'), '#quick-btn': element('button'), '#quick-cancel': element('button') };
page['#quick-sheet'] = Object.assign(element('dialog'), {
  open: false, showModal() { this.open = true; }, close() { this.open = false; },
  querySelectorAll: () => inputsIn(page['#quick-list']),
});
const querySelector = (sel) => (sel === '#quick-list input' ? inputsIn(page['#quick-list'])[0] : page[sel]) ?? null;
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector, createElement };
`;
const context = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, URL,
  createElement: element, querySelector });
vm.runInContext(`${stubs}\n${head}
  ${piece('  function parseISODate', '  // Soonest expiration first')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  ${piece('  const daysLeft', '\n\n')}
  ${piece('  const medallionProgram', '\n')}
  ${piece('  const mqdYear', "  // This year's MQD goal")}
  ${piece('  function medallionFor', '  function updateMedallion')}
  ${piece('  // Fields: "mqd", "bal:<program id>"', '  function startEdit')}
  ${piece('  function startEdit', "  document.addEventListener('click'")}
  ${piece('  // "18 nights · 7 to Gold" with a small bar', '  // Under a balance:')}
  ${piece('  // One screen to type every balance', '  // "≈ $4,820 in points')}
  ${piece('  function realChanges', '\n\n')}
  ${piece('  // Puts what a screenshot showed', '  async function celebrate')}
  let state = null;
  let filter = 'all'; const batch = null;
  const signed = (n) => (n < 0 ? '−' : '+') + fmt(Math.abs(n));
  const award = () => ({ xp: 10, combo: 1 }); const gameState = { log: [] }; const game = () => gameState;
  const markChanged = () => {}; const skipNewsForNewSetup = () => {}; const matchesFilter = () => true;
  const celebrate = () => {}; const undoTo = () => {};
  const shown = { toasts: [], renders: 0 };
  const markWeek = () => {}; const scheduleSave = () => {}; const saveNow = () => {};
  const relativeDay = () => 'today';
  const renderPrograms = () => {}; const renderUpcoming = () => {}; const celebrateGoals = () => {}; const offerBonusLanding = () => {};
  const showToast = (message) => shown.toasts.push(message);
  const showNote = showToast; // (no Undo or Reload toast up in these checks, so a note shows right away)
  const renderAll = () => { shown.renders++; };
  const detail = { open: false }; const detailProgram = () => null; const renderDetail = () => {};
  const renderGame = () => {}; const renderWorth = () => {}; const updateMedallion = () => {}; const CSS = { escape: (s) => s };
  globalThis.api = { normalize, programFromCatalog, CATALOG_BY_ID, progressInfo, nextText, setField, startEdit, progressMini, openQuick,
    collect, readYears, trackFor, shown, setState: (s) => { state = s; }, getState: () => state };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

// A tracker with these catalog programs, cards, and saved counts.
const tracker = (ids, fields = {}) => {
  const s = api.normalize(JSON.parse(JSON.stringify({ programs: ids.map((id) => api.programFromCatalog(api.CATALOG_BY_ID[id])), cards: [], ...fields })));
  api.setState(s);
  return s;
};
const program = (s, id) => s.programs.find((p) => p.id === id);
const statuses = (s, id) => program(s, id).status.map((line) => [line.tier, line.via, line.exp || '']);

// Bug 21: the page stayed open from Dec 31 to Jan 2, so nothing rolled the year over before the first edit.
setNow(2026, 12, 30);
let s = tracker(['delta', 'hilton'], { mqd: 16000, progress: { hilton: 30 }, updated: { mqd: '2026-12-30', 'prog:hilton': '2026-12-20' } });
setNow(2027, 1, 2);
api.setField('mqd', 500);
check('new year, first MQD edit: 2026’s Platinum is kept as a status', statuses(s, 'delta'), [['Platinum Medallion', 'earned in 2026', '2028-01-31']]);
check('…and the new count starts this year', [s.mqd, s.updated.mqd], [500, '2027-01-02']);
check('…and the year’s other counts start over too', [s.progress.hilton, s.updated['prog:hilton']], [undefined, undefined]);
check('…kept Hilton Gold from 2026', statuses(s, 'hilton'), [['Gold', 'earned in 2026', '2028-03-31']]);

setNow(2026, 12, 20);
s = tracker(['hilton'], { progress: { hilton: 30 }, updated: { 'prog:hilton': '2026-12-20' } });
setNow(2027, 1, 2);
api.setField('prog:hilton', 2);
check('new year, first nights edit: 2026’s Gold is kept as a status', statuses(s, 'hilton'), [['Gold', 'earned in 2026', '2028-03-31']]);
check('…and the new count is this year’s', [s.progress.hilton, s.updated['prog:hilton']], [2, '2027-01-02']);

setNow(2026, 12, 30);
s = tracker(['delta'], { mqd: 16000, updated: { mqd: '2026-12-30' } });
setNow(2027, 1, 2);
const renders = api.shown.renders;
api.startEdit({ dataset: { field: 'mqd' }, classList: { contains: () => false }, replaceWith() {} });
check('tapping a number after New Year: the year rolls over first', [s.mqd, statuses(s, 'delta')], [0, [['Platinum Medallion', 'earned in 2026', '2028-01-31']]]);
check('…and the page shows the new year before any edit', api.shown.renders > renders, true);

setNow(2027, 3, 1);
s = tracker(['delta'], { mqd: 3000, updated: { mqd: '2027-02-01' } });
api.setField('mqd', 4000);
check('an edit in the same year keeps nothing extra', [s.mqd, statuses(s, 'delta')], [4000, []]);

const lastYear = () => tracker(['delta'], { mqd: 16000, balances: { delta: 50000 }, updated: { mqd: '2026-12-30', delta: '2026-12-30' } });
const kept2026 = [['Platinum Medallion', 'earned in 2026', '2028-01-31']];

// The number editor open over New Year: a count typed against last year's figure isn't saved as this year's.
const numButton = (field) => ({
  dataset: { field, label: field }, classList: { contains: () => false, toggle() {} }, setAttribute() {}, closest: () => null, focus() {},
  replaceWith(input) { this.input = input; },
});
const typeInline = (btn, value) => { btn.input.value = value; };
const enter = (btn) => btn.input.handlers.keydown({ key: 'Enter', preventDefault() {} });

setNow(2026, 12, 31);
s = tracker(['delta'], { mqd: 15000, updated: { mqd: '2026-12-31' } });
let btn = numButton('mqd');
api.startEdit(btn);
typeInline(btn, '16,000');
setNow(2027, 1, 2);
let toastsBefore = api.shown.toasts.length;
let rendersBefore = api.shown.renders;
enter(btn);
check('MQDs opened Dec 31, typed and saved Jan 2: 2026’s count is kept as a status, not counted again for 2027',
  [s.mqd, s.updated.mqd, statuses(s, 'delta')], [0, undefined, [['Platinum Medallion', 'earned in 2026', '2028-01-31']]]);
check('…the page shows the new year', api.shown.renders > rendersBefore, true);
check('…and says the number wasn’t saved', api.shown.toasts.slice(toastsBefore).pop(), 'New qualifying year: counts start over, so that number wasn’t saved');

setNow(2026, 12, 31);
s = tracker(['delta'], { mqd: 15000, updated: { mqd: '2026-12-31' } });
btn = numButton('mqd');
api.startEdit(btn);
setNow(2027, 1, 2);
toastsBefore = api.shown.toasts.length;
btn.input.handlers.blur();
check('…left unchanged and closed after New Year: no word about an unsaved number', [s.mqd, api.shown.toasts.slice(toastsBefore)],
  [0, ['New qualifying year: Platinum Medallion stays on your list until it ends']]);

setNow(2026, 12, 31);
s = tracker(['hilton'], { progress: { hilton: 30 }, updated: { 'prog:hilton': '2026-12-20' } });
btn = numButton('prog:hilton');
api.startEdit(btn);
typeInline(btn, '31');
setNow(2027, 1, 2);
enter(btn);
check('Hilton nights opened Dec 31, saved Jan 2: 2026’s Gold kept, and the nights aren’t this year’s',
  [s.progress.hilton, s.updated['prog:hilton'], statuses(s, 'hilton')], [undefined, undefined, [['Gold', 'earned in 2026', '2028-03-31']]]);

setNow(2026, 12, 31);
s = lastYear();
btn = numButton('bal:delta');
api.startEdit(btn);
typeInline(btn, '52,000');
setNow(2027, 1, 2);
rendersBefore = api.shown.renders;
enter(btn);
check('a balance opened Dec 31, saved Jan 2: saved (balances carry over), and the year rolls over',
  [s.balances.delta, s.mqd, statuses(s, 'delta')], [52000, 0, kept2026]);
check('…and the whole page shows the new year, not just the balance', api.shown.renders > rendersBefore, true);

setNow(2027, 3, 1);
s = tracker(['delta'], { mqd: 3000, updated: { mqd: '2027-02-01' } });
btn = numButton('mqd');
api.startEdit(btn);
typeInline(btn, '4,000');
rendersBefore = api.shown.renders;
enter(btn);
check('MQDs edited within one year: saved, without redrawing the whole page', [s.mqd, s.updated.mqd, api.shown.renders], [4000, '2027-03-01', rendersBefore]);

// The quick-update sheet: its MQD row must never carry last year's count into the new year.
const quickRows = () => Object.fromEntries(inputsIn(page['#quick-list']).map((input) => [input.dataset.quick, input.value]));
const quickLabels = () => inputsIn(page['#quick-list']).map((input) => input.attrs['aria-label']);
const typeQuick = (field, value) => { inputsIn(page['#quick-list']).find((input) => input.dataset.quick === field).value = value; };
const saveQuick = () => page['#quick-form'].handlers.submit({ preventDefault() {} });

setNow(2026, 12, 30);
s = lastYear();
setNow(2027, 1, 2);
api.openQuick();
check('quick update opened after New Year: the year rolls over first, so the MQD row is this year’s',
  [quickRows(), quickLabels()[1], statuses(s, 'delta')], [{ 'bal:delta': '50,000', mqd: '0' }, 'MQDs 2027 MQDs', kept2026]);
typeQuick('bal:delta', '52,000');
saveQuick();
check('…saving a new balance leaves this year’s MQDs at 0', [s.balances.delta, s.mqd, s.updated.mqd, statuses(s, 'delta')], [52000, 0, undefined, kept2026]);

setNow(2026, 12, 30);
s = lastYear();
api.openQuick();
check('quick update opened Dec 30: last year’s MQDs in the row', quickRows(), { 'bal:delta': '50,000', mqd: '16,000' });
setNow(2027, 1, 2);
typeQuick('bal:delta', '52,000');
rendersBefore = api.shown.renders;
saveQuick();
check('…saved Jan 2 with only the balance changed: 2026’s MQDs aren’t counted again for 2027',
  [s.balances.delta, s.mqd, s.updated.mqd, statuses(s, 'delta')], [52000, 0, undefined, kept2026]);
check('…and the page shows the new year', api.shown.renders > rendersBefore, true);

setNow(2026, 12, 30);
s = lastYear();
api.openQuick();
typeQuick('mqd', '17,000');
setNow(2027, 1, 2);
saveQuick();
check('…an MQD count typed into last year’s row but saved after New Year isn’t counted for 2027', [s.mqd, s.updated.mqd], [0, undefined]);

setNow(2026, 12, 31);
s = tracker(['hilton'], { balances: { hilton: 80000 }, progress: { hilton: 5 }, updated: { hilton: '2026-12-31', 'prog:hilton': '2026-12-31' } });
api.openQuick();
typeQuick('bal:hilton', '90,000');
setNow(2027, 1, 2);
toastsBefore = api.shown.toasts.length;
saveQuick();
check('…saved after New Year when last year’s counts earned nothing: the save is still confirmed',
  [s.balances.hilton, s.progress.hilton, api.shown.toasts.slice(toastsBefore)], [90000, undefined, ['Updated 1 balance']]);

setNow(2026, 12, 30);
s = lastYear();
api.openQuick();
typeQuick('bal:delta', '52,000');
setNow(2027, 1, 2);
toastsBefore = api.shown.toasts.length;
saveQuick();
check('…and when it kept a level, that message is the one left up', api.shown.toasts.slice(toastsBefore),
  ['New qualifying year: Platinum Medallion stays on your list until it ends']);

setNow(2027, 2, 28);
s = tracker(['delta', 'american'], { mqd: 3000, balances: { delta: 50000 }, progress: { american: 20000 }, updated: { mqd: '2027-02-01', delta: '2027-02-01', 'prog:american': '2027-02-01' } });
api.openQuick();
typeQuick('mqd', '4,000');
setNow(2027, 3, 1);
saveQuick();
check('…American’s year (from March 1) turning over while the sheet is open doesn’t drop a typed MQD count', [s.mqd, s.updated.mqd, s.progress.american], [4000, '2027-03-01', undefined]);

setNow(2027, 3, 1);
s = tracker(['delta'], { mqd: 3000, balances: { delta: 50000 }, updated: { mqd: '2027-02-01', delta: '2027-02-01' } });
api.openQuick();
typeQuick('mqd', '4,000');
typeQuick('bal:delta', '51,000');
saveQuick();
check('quick update in the same year saves both rows', [s.mqd, s.updated.mqd, s.balances.delta, statuses(s, 'delta')], [4000, '2027-03-01', 51000, []]);

setNow(2026, 12, 31);
s = tracker(['delta'], { mqd: 3000, updated: { mqd: '2026-12-31' } });
api.openQuick();
typeQuick('mqd', '4,500');
setNow(2027, 1, 1);
toastsBefore = api.shown.toasts.length;
saveQuick();
check('…an MQD count typed Dec 31 below Silver, saved Jan 1: not saved, and it says so (not “No changes”)',
  [s.mqd, api.shown.toasts.slice(toastsBefore)], [0, ['New qualifying year: counts start over, so that number wasn’t saved']]);

setNow(2026, 12, 31);
s = tracker(['delta'], { balances: { delta: 50000 }, updated: { delta: '2026-12-31' } });
api.openQuick();
typeQuick('mqd', '4,500');
typeQuick('bal:delta', '51,000');
setNow(2027, 1, 1);
toastsBefore = api.shown.toasts.length;
saveQuick();
check('…with no MQDs yet and a balance too: the balance is saved, and the toast says the MQDs weren’t',
  [s.mqd, s.balances.delta, api.shown.toasts.slice(toastsBefore)], [0, 51000, ['New qualifying year: counts start over, so that number wasn’t saved']]);

// The screenshot review sheet (or result card) read before New Year and applied after it: like the number editor,
// a count read for last year isn't saved as this year's.
setNow(2026, 12, 31);
s = tracker(['delta'], { mqd: 15000, updated: { mqd: '2026-12-31' } });
let years = api.readYears(api.trackFor(program(s, 'delta')));
setNow(2027, 1, 1);
toastsBefore = api.shown.toasts.length;
api.collect('delta', { mqd: 16000 }, null, years);
check('Delta MQDs read Dec 31, applied Jan 1: 2026’s Platinum kept once, and the 16,000 isn’t counted for 2027',
  [s.mqd, s.updated.mqd, statuses(s, 'delta')], [0, undefined, kept2026]);
check('…and it says the number wasn’t saved', api.shown.toasts.slice(toastsBefore).pop(), 'New qualifying year: counts start over, so that number wasn’t saved');

setNow(2026, 12, 31);
s = tracker(['hilton'], { balances: { hilton: 80000 }, progress: { hilton: 30 }, updated: { hilton: '2026-12-31', 'prog:hilton': '2026-12-20' } });
years = api.readYears(api.trackFor(program(s, 'hilton')));
setNow(2027, 1, 2);
api.collect('hilton', { balance: 90000, progress: 31 }, null, years);
check('Hilton read Dec 31, applied Jan 2: the balance is saved, 2026’s nights aren’t counted for 2027',
  [s.balances.hilton, s.progress.hilton, statuses(s, 'hilton')], [90000, undefined, [['Gold', 'earned in 2026', '2028-03-31']]]);

setNow(2027, 3, 1);
s = tracker(['delta', 'hilton'], { mqd: 3000, updated: { mqd: '2027-02-01' } });
api.collect('delta', { mqd: 4000 }, null, api.readYears(api.trackFor(program(s, 'delta'))));
api.collect('hilton', { progress: 5 }, null, api.readYears(api.trackFor(program(s, 'hilton'))));
check('read and applied in the same year: both counts saved', [s.mqd, s.progress.hilton], [4000, 5]);

// A screenshot taken last year (its file's date) and read this year: its counts are last year's, not this year's.
setNow(2027, 1, 3);
s = tracker(['hilton'], { balances: { hilton: 80000 }, updated: { hilton: '2026-12-31' } });
api.collect('hilton', { balance: 91000, progress: 45 }, null, api.readYears(api.trackFor(program(s, 'hilton')), new Date(2026, 11, 28)));
check('a Dec 28 screenshot read Jan 3: the balance is saved, its 45 nights aren’t counted for 2027', [s.balances.hilton, s.progress.hilton], [91000, undefined]);
s = tracker(['hilton'], { balances: { hilton: 80000 } });
api.collect('hilton', { balance: 91000, progress: 2 }, null, api.readYears(api.trackFor(program(s, 'hilton')), new Date(2027, 0, 2)));
check('…a Jan 2 screenshot read Jan 3: its 2 nights are this year’s', s.progress.hilton, 2);

// Bug 22: United's flights path needs PQP too, so flights alone don't fill the bar or shorten the PQP left.
setNow(2026, 10, 8);
const united = (pqp, flights) => {
  const t = tracker(['united'], { progress: { united: pqp, 'united+alt': flights }, updated: { 'prog:united': '2026-10-08', 'prog:united+alt': '2026-10-08' } });
  return api.progressInfo(program(t, 'united'));
};
let info = united(0, 60);
check('United, 60 flights and 0 PQP: Silver still next, 5,000 PQP to go, bar empty', [info.next.name, info.next.left, info.toNext], ['Silver', 5000, 0]);
info = united(4000, 60);
check('United, 60 flights and 4,000 PQP: 1,000 PQP to Silver (15 flights + 5,000 PQP)', [info.next.left, api.nextText(info.next, info.track)], [1000, '1,000 to Silver']);
check('…and the bar shows 4,000 of the 5,000 PQP', info.toNext, 0.8);
info = united(4000, 10);
check('United, 10 flights and 4,000 PQP: 2,000 PQP to Silver on PQP alone', [info.next.left, api.nextText(info.next, info.track)], [2000, '2,000 to Silver']);
info = united(5000, 10);
check('…flights path half done: bar goes by PQP', info.toNext, 5000 / 6000);
info = united(6000, 20);
check('United Silver reached; 20 flights and 6,000 PQP toward Gold: 6,000 PQP to Gold on PQP', [info.next.name, info.next.left, info.next.altLeft], ['Gold', 6000, null]);
info = united(10000, 20);
check('United, 20 flights and 10,000 PQP: 10 flights or 2,000 PQP to Gold', api.nextText(info.next, info.track), '2,000 PQP (or 10 flights) to Gold');
info = (() => {
  const t = tracker(['hilton'], { progress: { hilton: 5, 'hilton+alt': 2 }, updated: { 'prog:hilton': '2026-10-08' } });
  return api.progressInfo(program(t, 'hilton'));
})();
check('Hilton (no PQP-style second count): bar by the further path', [info.next.name, info.toNext], ['Silver', 0.5]);

// Bug 25: a card status with a fixed end date (Sapphire Reserve's IHG Platinum, thru 12/31/27) doesn't last as
// long as a level earned in 2027, so earning Platinum again is the goal.
const ihg = (nights) => {
  const t = tracker(['ihg'], { cards: ['sapphire-reserve'], progress: { ihg: nights }, updated: { 'prog:ihg': isoNow() } });
  return api.progressInfo(program(t, 'ihg'));
};
const isoNow = () => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
setNow(2027, 3, 1);
info = ihg(25);
check('2027, Sapphire Reserve IHG Platinum ends 12/31/27, 25 nights: 15 to keep Platinum', [info.next.name, info.next.keep, api.nextText(info.next, info.track)],
  ['Platinum', true, '15 to keep Platinum']);
info = ihg(5);
check('…5 nights: still 35 to keep Platinum', api.nextText(info.next, info.track), '35 to keep Platinum');
setNow(2026, 10, 8);
info = ihg(25);
check('2026: the card’s Platinum lasts as long as one earned now, so Diamond is next', api.nextText(info.next, info.track), '45 to Diamond');
setNow(2027, 3, 1);
info = (() => {
  const t = tracker(['hilton'], { cards: ['amex-platinum'], progress: { hilton: 12 }, updated: { 'prog:hilton': '2027-03-01' } });
  return api.progressInfo(program(t, 'hilton'));
})();
check('a card status with no end date still counts as held (Hilton Gold from Amex Platinum)', [info.next.name, info.next.keep], ['Diamond', false]);

// Bug 26: the nights pace goes by when the nights were entered, not when the stays were.
const text = (el) => (el == null || el === false ? '' : typeof el === 'string' ? el : el.kids.map(text).join(''));
const pace = (mini) => { const el = mini.kids.find((k) => k && k.className === 'pace'); return el ? text(el) : null; };
setNow(2026, 10, 8);
s = tracker(['hilton'], { progress: { hilton: 30, 'hilton+alt': 10 }, updated: { 'prog:hilton': '2026-03-01', 'prog:hilton+alt': '2026-10-01' } });
check('30 nights entered Mar 1, stays Oct 1: paced from Mar 1', pace(api.progressMini(program(s, 'hilton'))), 'On pace for 186 nights this year: enough for Diamond');
s = tracker(['hilton'], { progress: { hilton: 30, 'hilton+alt': 10 }, updated: { 'prog:hilton': '2026-10-01', 'prog:hilton+alt': '2026-03-01' } });
check('…nights entered later than stays: paced from the nights date', pace(api.progressMini(program(s, 'hilton'))).startsWith('On pace for 40 nights'), true);

// Bug 22 again: United's pace line goes by the same PQP figure as the headline (5,000 with the flights in, not 6,000).
const unitedPace = (pqp, flights) => {
  const t = tracker(['united'], { progress: { united: pqp, 'united+alt': flights }, updated: { 'prog:united': '2026-10-25', 'prog:united+alt': '2026-10-25' } });
  return pace(api.progressMini(program(t, 'united')));
};
setNow(2026, 10, 25);
check('United, 20 flights and 4,500 PQP on Oct 25: on pace for the PQP the flights path needs',
  unitedPace(4500, 20), 'On pace for 5,531 PQP this year: enough for Silver');
check('…4,000 PQP: the pace asks for the 1,000 PQP left, over the rest of the year',
  unitedPace(4000, 20), 'On pace for 4,917 PQP this year · Silver needs about 451 a month');
check('…10 flights: PQP alone, so 6,000 is the goal', unitedPace(4000, 10), 'On pace for 4,917 PQP this year · Silver needs about 902 a month');

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
