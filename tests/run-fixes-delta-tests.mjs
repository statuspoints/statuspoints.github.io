// Checks the Delta Medallion fixes (from index.html): a Medallion kept from last year still counts as elite status,
// no duplicate status reminders, Simple view survives a far-future progress date, lifetime tiers aren't "kept",
// the pace line aims at the same goal as the headline, no welcome for a lower tier, and the hero tile works in
// Simple view.
// Usage: node tests/run-fixes-delta-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// Everything up to `const state = load();`, then the pieces the Medallion code uses (from a line up to the next
// given line).
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => { const at = js.indexOf(from); return js.slice(at, js.indexOf(to, at)); };
const fn = (from) => { const at = js.indexOf(from); return js.slice(at, js.indexOf('\n  }\n', at) + 4); }; // one whole function

// A small fake DOM: enough for h(), text content, and elements looked up by selector.
const dom = `
  class El {
    constructor(tag) {
      this.tag = tag; this.children = []; this.attrs = {}; this.className = ''; this.style = {}; this.dataset = {};
      this.hidden = false; this.listeners = {}; this._text = null; this.value = ''; this.content = { firstChild: this };
      const set = new Set();
      this.classList = { add: (c) => set.add(c), remove: (c) => set.delete(c), toggle: (c, on) => (on ? set.add(c) : set.delete(c)), contains: (c) => set.has(c) };
    }
    append(...kids) { this.children.push(...kids); }
    replaceChildren(...kids) { this.children = kids; this._text = null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    get textContent() { return this._text ?? this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
    set textContent(v) { this._text = String(v); this.children = []; }
    addEventListener(type, f) { this.listeners[type] = f; }
    replaceWith(el) { this.replacedBy = el; }
    focus() {} blur() {} setSelectionRange() {} closest() { return null; }
    get offsetWidth() { return 0; }
  }
  const els = {};
  const document = { querySelector: (sel) => els[sel] || null, querySelectorAll: () => [], createElement: (tag) => new El(tag), addEventListener() {} };
`;
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
`;
// Today is Thu Oct 8, 2026 for every check.
const NOW = new Date(2026, 9, 8, 12).getTime();
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(NOW); }
  static now() { return NOW; }
}

const context = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, URL });
vm.runInContext(`${dom}\n${stubs}\n${head}
  ${piece('  function parseISODate', '  function sortVouchers')}
  ${piece('  function isoOf', '  function todayISO')}
  const todayISO = () => isoOf(new Date());
  let state = normalize({ programs: [], cards: [] });
  const shown = { toasts: [], confetti: [], opened: [], pulsed: [] };
  const saveNow = () => {}; const renderStats = () => {}; const renderGame = () => {}; const paintNum = () => {};
  enter = () => {}; // (enter, confetti and pulse are the app's own; replaced here)
  const renderPrograms = () => {}; const openPerks = () => {}; const jumpTo = () => {};
  const showToast = (message) => shown.toasts.push(message);
  // A note waits while a removal's Undo or a Reload is up (see showNote); recorded apart from toasts here.
  const showNote = (message) => (shown.notes || (shown.notes = [])).push(message);
  confetti = (from) => shown.confetti.push(from);
  pulse = (el) => shown.pulsed.push(el);
  const openDetail = (id) => shown.opened.push(id);
  const setTimeout = (f) => f();
  const getField = () => state.mqd;
  const setField = (field, value) => { state.mqd = value; };
  const parseEntry = (raw) => ({ value: Number(raw) });
  const detail = { open: false };
  let editMode = false;
  ${piece('  function mergedLines', '  // Tiers as colored pills')}
  ${piece('  // "Amex Platinum · thru 12/31/27"', '  function statusLine')}
  ${piece('  const medallionProgram', '  function renderFilters')}
  ${piece('  // The Delta card you hold with the best MQD Boost', '  // "✓ Breakfast')}
  ${piece("  // Where this year's count is headed", '  // Under a balance')}
  ${piece('  // Delta grants a tier as soon', '  // Hero numbers')}
  ${fn('  function goalWith')}
  ${piece('  function statusItem', '  function renderUpcoming')}
  ${piece('  // The qualifying year a count belongs to', '  function startEdit')}
  ${piece('  function startEdit', "  document.addEventListener('click'")}
  els['#stats'] = new El('div');
  ${piece("  $('#stats').addEventListener('click'", '  function renderNotes')}
  globalThis.api = { normalize, hasStatus, rollOver, upcomingItems, simpleStatus, mqdNextText, updatePlan, updateMedallion,
    goalWith, startEdit, medallionProgram, earnedTier, mdy, isoOf, parseISODate, els, El, shown,
    getState: () => state, setState: (s) => { state = s; },
    setPlan: (open, mqd) => { planOpen = open; planMqd = mqd; planSpend = 0; } };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const attempt = (f) => { try { return f(); } catch (e) { return `threw ${e.message}`; } };

const delta = (status = []) => ({ id: 'delta', name: 'Delta SkyMiles', unit: 'miles', medallion: true, status });
// A tracker with Delta (and anything else), this year's MQDs entered on `mqdOn`.
const use = (programs, extra = {}) => {
  const s = api.normalize({ programs, cards: [], ...extra });
  api.setState(s);
  api.shown.toasts.length = 0;
  api.shown.confetti.length = 0;
  api.shown.opened.length = 0;
  api.shown.pulsed.length = 0;
  return s;
};
const withMqd = (mqd, on = '2026-07-01') => ({ mqd, updated: { mqd: on } });
const program = () => api.medallionProgram();
const keptPlatinum = { tier: 'Platinum Medallion', via: 'earned in 2025', exp: '2027-01-31' };
const lifetimeGold = { tier: 'Gold Medallion', via: 'Million Miler' };

// 1. A Medallion kept from last year (rollOver turns it into a status line and zeroes the MQDs) is elite status.
use([delta()], withMqd(12000, '2025-11-01'));
check('rollOver keeps last year’s Gold as a status line', [api.rollOver(), program().status.map((l) => l.exp), api.getState().mqd], [['Gold Medallion'], ['2027-01-31'], 0]);
check('…and Delta still counts as elite status', api.hasStatus(program()), true);
check('…its message is a note, so it can’t replace a removal’s Undo (switching to someone whose year turned over)',
  [api.shown.toasts.length, (api.shown.notes || []).at(-1)], [0, 'New qualifying year: Gold Medallion stays on your list until it ends']);
use([delta([keptPlatinum])]);
check('a typed Medallion with no MQDs yet is elite status', api.hasStatus(program()), true);
use([delta([{ tier: 'Gold Medallion', via: 'earned in 2024', exp: '2026-01-31' }])]);
check('an expired Medallion isn’t', api.hasStatus(program()), false);
use([delta()], withMqd(5000));
check('this year’s MQDs alone still count', api.hasStatus(program()), true);
use([delta()]);
check('nothing at all doesn’t', api.hasStatus(program()), false);
// A free entry level isn't elite status (Flying Blue Explorer, BA Blue); the level above it is.
const fb = (tier) => ({ id: 'flyingblue', name: 'Air France-KLM Flying Blue', unit: 'miles', status: [{ tier }] });
use([fb('Explorer')]);
check('Flying Blue Explorer (free to join) isn’t elite status', api.hasStatus(api.getState().programs[0]), false);
use([fb('Silver')]);
check('…Silver is', api.hasStatus(api.getState().programs[0]), true);
use([{ id: 'ba', name: 'British Airways Club', unit: 'Avios', status: [{ tier: 'Blue' }] }]);
check('BA Blue isn’t', api.hasStatus(api.getState().programs[0]), false);
use([{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [{ tier: 'Some custom level' }] }]);
check('a level the app doesn’t know still counts', api.hasStatus(api.getState().programs[0]), true);
use([delta()], { cards: ['delta-platinum'] });
check('a Delta card’s MQD Headstart line isn’t a Medallion', [program().status.length > 0, api.hasStatus(program())], [true, false]);
use([], { cards: ['delta-reserve'] });
check('…nor does the card alone make Delta elite', api.getState().programs.filter(api.hasStatus).map((p) => p.id), ['hertz']);
use([delta([keptPlatinum])], { cards: ['delta-platinum'] });
check('…while a kept Medallion beside it still counts', api.hasStatus(program()), true);
use([delta()], { ...withMqd(5000), cards: ['delta-platinum'] });
check('…and so do this year’s MQDs', api.hasStatus(program()), true);

// 10. A status line matching the tier earned with MQDs isn't listed twice (calendar export).
const statusItems = () => api.upcomingItems({ future: true }).filter((i) => i.kind === 'status' && i.p === program())
  .map((i) => `${i.group.tier} ${i.group.exp}`);
use([delta([{ tier: 'Gold Medallion', via: 'from your account', exp: '2028-01-31' }])], withMqd(12000));
check('earned Gold plus the same Gold typed in: one calendar item', statusItems(), ['Gold Medallion 2028-01-31']);
use([delta([{ tier: 'Platinum Medallion', via: 'from your account', exp: '2028-01-31' }])], withMqd(12000));
check('earned Gold under a typed Platinum ending the same day: just the Platinum', statusItems(), ['Platinum Medallion 2028-01-31']);
use([delta()], withMqd(12000));
check('earned Gold alone is still listed', statusItems(), ['Gold Medallion 2028-01-31']);
use([delta([keptPlatinum])], withMqd(12000));
check('a kept Platinum ending sooner is listed beside the earned Gold', statusItems(), ['Platinum Medallion 2027-01-31', 'Gold Medallion 2028-01-31']);

// 11. A progress date far in the future (restored backup, a clock set ahead) doesn't crash Simple view.
const hilton = { id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] };
use([hilton], { view: 'simple', progress: { hilton: 60 }, updated: { 'prog:hilton': '9998-06-01' } });
check('year-9998 progress date: dropped at load, so Simple view shows the level through a real date', [api.getState().updated['prog:hilton'], attempt(() => api.simpleStatus(api.getState().programs[0]).textContent)], [undefined, 'Diamondthru 3/31/28']);
use([hilton], { view: 'simple', progress: { hilton: 60 } });
api.getState().updated['prog:hilton'] = '9999-06-01'; // stamped while the clock was set ahead
check('year-9999 progress date set while running: ignored, not “thru 3/31/001”', attempt(() => api.simpleStatus(api.getState().programs[0]).textContent), 'Diamondthru 3/31/28');
check('…and an earned level never ends in a 5-digit year', attempt(() => api.isoOf(api.earnedTier(api.getState().programs[0]).thru)), '2028-03-31');
check('years past 9000 aren’t dates; 9000 and earlier still are', ['9001-01-01', '9999-12-31', '9000-12-31', '2027-01-31'].map((d) => !!api.parseISODate(d)), [false, false, true, true]);
use([hilton], { view: 'simple', progress: { hilton: 60 }, updated: { 'prog:hilton': '2026-06-01' } });
check('a normal progress date shows its end', attempt(() => api.simpleStatus(api.getState().programs[0]).textContent), 'Diamondthru 3/31/28');

// 23. A Medallion with no end date (lifetime, Million Miler) isn't something to keep.
const planText = (mqd, add) => {
  for (const id of ['#plan-range', '#plan-amt', '#mqd-plan', '#plan-result']) api.els[id] = new api.El('div');
  api.getState().mqd = mqd;
  api.setPlan(true, add);
  api.updatePlan();
  return api.els['#plan-result'].textContent;
};
use([delta([lifetimeGold])], withMqd(3000));
check('lifetime Gold, $3,000: aims past Gold', api.mqdNextText(), '12,000 to Platinum');
check('…a plan to $10,000 doesn’t “requalify” it', planText(3000, 7000), '10,000 MQDs — still 5,000 short of Platinum.');
check('…a plan to $6,000 doesn’t earn Silver “after your Gold ends”', planText(3000, 3000), '6,000 MQDs — still 9,000 short of Platinum.');
check('…a plan to $15,000 gets you to Platinum', planText(3000, 12000).startsWith('That gets you to Platinum Medallion with 15,000 MQDs'), true);
use([delta([keptPlatinum])], withMqd(3000));
check('Platinum kept from last year, $3,000: to keep Platinum', api.mqdNextText(), '12,000 to keep Platinum');
check('…a plan to $15,000 requalifies', planText(3000, 12000), 'That requalifies you for Platinum Medallion through Jan 31, 2028 with 15,000 MQDs.');
check('…a plan to $10,000 earns Gold after it ends', planText(3000, 7000), 'That earns Gold Medallion through Jan 31, 2028 with 10,000 MQDs, after your Platinum ends.');
check('…a plan to $8,000 earns Silver after it ends', planText(3000, 5000), 'That earns Silver Medallion through Jan 31, 2028 with 8,000 MQDs, after your Platinum ends.');
check('…a plan to $4,500 is short of keeping it', planText(3000, 1500), '4,500 MQDs — still 10,500 short of keeping Platinum.');
use([delta([{ tier: 'Platinum Medallion', via: 'from your account', exp: '2028-01-31' }])], withMqd(3000));
check('Platinum already through 1/31/28: aims at Diamond', api.mqdNextText(), '25,000 to Diamond');
use([delta()], withMqd(3000));
check('no status: next tier as before', [api.mqdNextText(), planText(3000, 1000)], ['2,000 to Silver', '4,000 MQDs — still 1,000 short of Silver.']);
use([delta()], withMqd(30000));
check('past Diamond: top tier', api.mqdNextText(), 'Diamond — top tier');

// 24. The pace line aims at the same tier as the headline.
const medallionCard = () => {
  for (const id of ['#mqd-bar', '#medallion-status', '#medallion-perks', '#mqd-next', '#mqd-pace', '#mqd-fill']) api.els[id] = new api.El('div');
  delete api.els['#plan-range'];
  api.updateMedallion();
  return [api.els['#mqd-next'].textContent, api.els['#mqd-pace'].textContent];
};
use([delta([keptPlatinum])], withMqd(6000));
check('keeping Platinum at $6,000 in July: the pace is about Platinum, not Gold', medallionCard(),
  ['9,000 to keep Platinum', 'On pace for $12,100 this year · Platinum Medallion needs about $3,250 a month']);
check('…and a scanned screen says the same', api.goalWith(program(), { mqd: 6000 }), '$9,000 to keep Platinum');
use([delta()], withMqd(6000));
check('no kept tier: the pace is about the next one', medallionCard(), ['4,000 to Gold', 'On pace for $12,100 this year: enough for Gold Medallion']);
check('…and so is a scanned screen', api.goalWith(program(), { mqd: 6000 }), '$4,000 to Gold');
api.getState().programs = null; // first run: "Start from a screenshot" on the setup screen, before any tracker exists
check('…even before there’s a tracker (setup screen)', attempt(() => api.goalWith(delta(), { mqd: 6000 })), '$4,000 to Gold');

// 27. Reaching Silver while holding Platinum from last year isn't a "welcome", nor is a tier you hold for good.
const editMqd = (to) => {
  const btn = new api.El('button');
  btn.dataset.field = 'mqd';
  api.startEdit(btn);
  const input = btn.replacedBy;
  input.value = String(to);
  input.listeners.blur();
  return [api.shown.toasts.slice(), api.shown.confetti.length];
};
use([delta([keptPlatinum])], withMqd(4000));
check('holding Platinum, $4,000 → $5,000: no confetti, no welcome to Silver', editMqd(5000), [['Silver Medallion earned — yours through Jan 31, 2028'], 0]);
use([delta([keptPlatinum])], withMqd(14000));
check('holding Platinum, $14,000 → $15,000: welcome back to Platinum', editMqd(15000), [['Welcome to Platinum Medallion!'], 1]);
use([delta()], withMqd(4000));
check('no status, $4,000 → $5,000: welcome to Silver', editMqd(5000), [['Welcome to Silver Medallion!'], 1]);
// A tier you already hold for good (lifetime, from a card, or already through the same date) isn't news.
use([delta([lifetimeGold])], withMqd(9000));
check('lifetime Gold, $9,000 → $10,000: no confetti, no toast', editMqd(10000), [[], 0]);
use([delta([lifetimeGold])], withMqd(4000));
check('lifetime Gold, $4,000 → $5,000: nothing for Silver either', editMqd(5000), [[], 0]);
use([delta([lifetimeGold])], withMqd(14000));
check('lifetime Gold, $14,000 → $15,000: welcome to Platinum', editMqd(15000), [['Welcome to Platinum Medallion!'], 1]);
use([delta([{ tier: 'Gold Medallion', via: 'Delta Reserve', card: 'delta-reserve', exp: '2027-01-31' }])], withMqd(9000));
check('Gold from a card, $9,000 → $10,000: no welcome', editMqd(10000), [[], 0]);
use([delta([{ tier: 'Platinum Medallion', via: 'from your account', exp: '2028-01-31' }])], withMqd(14000));
check('Platinum already through 1/31/28, $14,000 → $15,000: no welcome', editMqd(15000), [[], 0]);

// 32. The Medallion hero tile does something in Simple view (no inline Delta panel there).
const tapMedallion = () => {
  const tile = { dataset: { go: 'medallion' } };
  api.els['#stats'].listeners.click({ target: { closest: () => tile } });
  return api.shown.opened.slice();
};
use([delta()], { ...withMqd(6000), view: 'simple' });
delete api.els['#programs .delta'];
// A progress box left in the closed detail sheet (opened earlier for Hilton) is also a `.delta`; it isn't the panel.
api.els['.delta'] = new api.El('div');
check('Simple view: the Medallion tile opens Delta’s details', [tapMedallion(), api.shown.pulsed.length], [['delta'], 0]);
use([delta()], withMqd(6000));
const panel = api.els['#programs .delta'] = new api.El('div');
check('Detailed view: it pulses the inline panel instead', [tapMedallion(), api.shown.pulsed.length, api.shown.pulsed[0] === panel], [[], 1, true]);
use([delta()], withMqd(4000));
check('…and a new Medallion’s confetti comes from that panel, not the detail sheet’s box', [editMqd(5000)[1], api.shown.confetti[0] === panel], [1, true]);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
