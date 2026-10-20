// Checks card presets and program data (from index.html): statuses you remove or change stay that way after a
// reload, long card statuses keep their end dates, a cleared "thru" date stays cleared, turning a card off keeps
// programs that still hold your data, fee dates outlive removing a card, and deleting a program takes its ¢/pt.
// Usage: node tests/run-fixes-cards-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// Everything up to `const state = load();`, plus the date helpers.
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => { const at = js.indexOf(from); return js.slice(at, js.indexOf(to, at)); };
const dates = piece('  function parseISODate', '  function expiryLine');

// A small fake DOM: enough for h(), the program editor sheet's rows, and the elements its handlers read.
const fakeDom = `
  class El {
    constructor(tag) { Object.assign(this, { tag, children: [], dataset: {}, className: '', value: '', defaultValue: '', hidden: false, checked: false, listeners: {}, content: { firstChild: null } }); }
    setAttribute(k, v) {
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (m, c) => c.toUpperCase())] = String(v);
      if (k === 'value') this.value = this.defaultValue = String(v);
    }
    append(...kids) { this.children.push(...kids); }
    replaceChildren(...kids) { this.children = kids; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    querySelectorAll(sel) {
      const out = [];
      const walk = (el) => { for (const c of el.children) if (c instanceof El) { if (c.className.split(' ').includes(sel.slice(1))) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    showModal() {} close() {} focus() {}
  }
  const els = {};
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const document = { querySelector: (sel) => els[sel] || (els[sel] = new El('div')), createElement: (tag) => new El(tag) };
`;

const context = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${fakeDom}\n${head}\n${dates}
  let state = normalize({ programs: [], cards: [] });
  const sheet = $('#sheet');
  let sheetId = null;
  let expEditing = null;
  const game = () => state.game;
  const shown = { toasts: [] };
  const showToast = (message, action) => shown.toasts.push({ message, action });
  const scheduleSave = () => {}; const renderPrograms = () => {}; const renderDetailStatus = () => {}; const renderLevels = () => {};
  ${piece('  function mergedLines', '  const lineExpired')}
  ${piece('  function statusEditorRow', '  $(\'#p-name\').addEventListener')}
  ${piece('  $(\'#sheet-form\').addEventListener', '  $(\'#p-cancel\')')}
  ${piece('  function setStatusExp', '  function perkBlock')}
  ${piece('  const lineExpired', '\n')}
  ${piece('  function scanTiersFor', '  // What follows a number')}
  ${piece('  const medallionProgram', '\n')}
  ${piece('  function medallionFor', '  function updateMedallion')}
  ${piece('  function realChanges', '  const lootText')}
  ${piece('  function applyRead', '  // Applies a screenshot')}
  globalThis.app = {
    normalize, applyCard, removeCard, restoreCard, setStatusExp, openSheet, applyRead, scanTiersFor, findTier, lineExpired,
    clone, CARD_BY_ID, CARDS, shown, els,
    get state() { return state; }, set state(s) { state = s; },
    reload() { state = normalize(JSON.parse(JSON.stringify(state))); return state; },
    submit() { els['#sheet-form'].listeners.submit({ preventDefault() {} }); },
    deleteProgram() { els['#p-delete'].listeners.click(); },
    rows: () => els['#p-status'].children,
  };`, context);
const { app } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

// A tracker holding these cards, saved and loaded once (as it would be after picking them).
const start = (cards, programs = []) => {
  app.state = app.normalize({ programs, cards: [] });
  cards.forEach((id) => app.applyCard(app.state, id));
  return app.reload();
};
const prog = (id) => app.state.programs.find((p) => p.id === id);
const tiers = (id) => (prog(id) ? prog(id).status.map((l) => l.tier) : null);

/* ---------- Statuses from a card stay the way you left them ---------- */

start(['amex-platinum']);
app.openSheet('hilton');
for (const sel of ['.sl-tier', '.sl-via', '.sl-date']) app.rows()[0].querySelector(sel).value = ''; // ✕ on the only line empties it
app.submit();
check('deleting a card’s status line in the editor: gone now', tiers('hilton'), []);
app.reload();
check('…and still gone after a reload', tiers('hilton'), []);
check('…the card is still held', app.state.cards.includes('amex-platinum'), true);

start(['amex-platinum']);
app.openSheet('marriott');
app.rows()[0].querySelector('.sl-tier').value = 'Platinum Elite';
app.submit();
app.reload();
check('changing a card line’s level: your words stay after a reload', tiers('marriott'), ['Platinum Elite']);
check('…and it no longer counts as the card’s (turning the card off leaves it)',
  (app.removeCard(app.state, 'amex-platinum'), tiers('marriott')), ['Platinum Elite']);

start(['amex-platinum']);
app.openSheet('marriott');
app.rows()[0].querySelector('.sl-tier').value = '  gold elite ';
app.submit();
app.reload();
check('only spacing or case changed: still the card’s line', prog('marriott').status.map((l) => l.card), ['amex-platinum']);

start(['amex-platinum']);
app.openSheet('lhw');
app.deleteProgram();
app.reload();
check('deleting a program a card created: it stays deleted after a reload', prog('lhw'), undefined);
check('…the card’s other programs are untouched', tiers('hertz'), ["President's Circle"]);

start(['amex-platinum']);
app.removeCard(app.state, 'amex-platinum');
app.applyCard(app.state, 'amex-platinum');
check('turning a card off and on again puts every status back', tiers('hilton'), ['Gold']);

{ // a status added to the card since you picked it still arrives on the next load
  start(['amex-platinum']);
  const saved = JSON.parse(JSON.stringify(app.state));
  saved.programs = saved.programs.filter((p) => p.id !== 'national');
  if (saved.cardSeen) saved.cardSeen['amex-platinum'] = saved.cardSeen['amex-platinum'].filter((k) => !k.startsWith('national|'));
  app.state = app.normalize(saved);
  check('a status new to a card you hold arrives on the next load', tiers('national'), ['Emerald Club Executive']);
}

{ // saved before this record existed: missing statuses come back once, and from then on removals stick
  start(['amex-platinum']);
  const saved = JSON.parse(JSON.stringify(app.state));
  delete saved.cardSeen;
  saved.programs.find((p) => p.id === 'hilton').status = [];
  app.state = app.normalize(saved);
  check('an older save fills in what the card gives', tiers('hilton'), ['Gold']);
  prog('hilton').status = [];
  app.reload();
  check('…and after that a removal sticks', tiers('hilton'), []);
}

{ // Undo of turning a card off keeps the record, so a line you'd removed before stays off
  start(['amex-platinum']);
  prog('hilton').status = [];
  const prev = app.clone(app.state);
  app.removeCard(app.state, 'amex-platinum');
  app.restoreCard(app.state, prev, 'amex-platinum');
  app.reload();
  check('Undo after turning a card off: a status you removed earlier stays off', (tiers('hilton') || []).includes('Gold'), false);
  check('…and the rest are back', tiers('marriott'), ['Gold Elite']);
}

check('a hostile record is cleaned: only keys the card gives, only for cards you hold',
  app.normalize({ programs: [], cards: ['amex-platinum'], cardSeen: { 'amex-platinum': ['hilton|Gold|American Express Platinum', 'junk', 5], 'delta-gold': ['x'], nope: ['y'] } }).cardSeen,
  app.normalize({ programs: [], cards: ['amex-platinum'], cardSeen: {} }).cardSeen);

/* ---------- Long card statuses keep their end dates ---------- */

for (const cardId of ['delta-reserve', 'sapphire-reserve']) {
  start([cardId]);
  const line = prog('lounges').status.find((l) => l.card === cardId);
  const full = line.tier;
  line.exp = '2027-06-30';
  app.reload();
  const after = prog('lounges').status.find((l) => l.card === cardId);
  check(`${cardId}: its ${Array.from(full).length}-character lounge line keeps its text and your end date`, after && [after.tier, after.exp], [full, '2027-06-30']);
}
{
  const tooLong = [];
  for (const card of Object.values(app.CARD_BY_ID)) {
    for (const [programId, tier, note] of card.grants) {
      const via = note ? `${card.name} · ${note}` : card.name;
      const kept = app.normalize({ programs: [{ id: 'x', name: 'X', status: [{ tier, via }] }] }).programs[0].status[0];
      if (kept.tier !== tier || kept.via !== via) tooLong.push(`${card.id} → ${programId}`);
    }
  }
  check('every card’s status text survives being saved and loaded', tooLong, []);
}

/* ---------- A cleared "thru" date stays cleared ---------- */

const thruLine = { tier: 'Diamond', via: 'Hilton promo thru 12/31/27' };
app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [thruLine] }], cards: [] });
check('a “thru 12/31/27” line gets its end date read from the text', prog('hilton').status[0].exp, '2027-12-31');
app.setStatusExp(prog('hilton'), 0, '');
app.reload();
check('Clear on the end date: still cleared after a reload', !!prog('hilton').status[0].exp, false);
app.setStatusExp(prog('hilton'), 0, '2028-01-31');
app.reload();
check('…and a date set again after that is kept', prog('hilton').status[0].exp, '2028-01-31');

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [thruLine] }], cards: [] });
app.openSheet('hilton');
app.rows()[0].querySelector('.sl-date').value = '';
app.submit();
app.reload();
check('emptying the date in the editor: still empty after a reload', !!prog('hilton').status[0].exp, false);
app.openSheet('hilton');
app.submit(); // opened and saved again, untouched
app.reload();
check('…and after saving the editor again untouched', !!prog('hilton').status[0].exp, false);

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] }], cards: [] });
app.openSheet('hilton');
app.rows()[0].querySelector('.sl-tier').value = 'Gold';
app.rows()[0].querySelector('.sl-via').value = 'Status match thru 6/30/27';
app.submit();
app.reload();
check('a newly typed “thru 6/30/27” with no date still gets its end date', prog('hilton').status[0].exp, '2027-06-30');

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] }], cards: [] });
app.openSheet('hilton');
app.rows()[0].querySelector('.sl-tier').value = 'Gold';
app.rows()[0].querySelector('.sl-via').value = 'Status match thru 6/30/27';
app.submit();
check('…it has that date right away, before any reload', prog('hilton').status[0].exp, '2027-06-30');
app.openSheet('hilton');
app.submit(); // opened and saved again before a reload, untouched
app.reload();
check('…and saving the editor again before a reload doesn’t lose it', prog('hilton').status[0].exp, '2027-06-30');

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [{ ...thruLine, exp: '' }] }], cards: [] });
app.openSheet('hilton');
app.rows()[0].querySelector('.sl-via').value = 'Hilton promo thru 3/31/28';
app.submit();
app.reload();
check('a cleared line whose “thru” text you change gets the new date', prog('hilton').status[0].exp, '2028-03-31');

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [{ ...thruLine, exp: '' }] }], cards: [] });
app.openSheet('hilton');
app.rows()[0].querySelector('.sl-via').value = 'Hilton promotion thru 12/31/27'; // reworded, same “thru” date
app.submit();
check('a cleared line reworded around the same “thru” date: still cleared', !!prog('hilton').status[0].exp, false);
app.reload();
check('…and after a reload', !!prog('hilton').status[0].exp, false);

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [thruLine] }], cards: [] });
app.openSheet('hilton');
app.rows()[0].querySelector('.sl-date').value = '';
app.rows()[0].querySelector('.sl-via').value = 'Hilton promotion thru 12/31/27'; // emptied and reworded in one save
app.submit();
check('emptying the date while rewording the text around the same “thru” date: stays empty', !!prog('hilton').status[0].exp, false);
app.reload();
check('…and after a reload', !!prog('hilton').status[0].exp, false);

start(['sapphire-reserve']);
app.setStatusExp(prog('ihg'), 0, '');
app.reload();
check('a card’s dated status (IHG thru 12/31/27) cleared: stays cleared', !!prog('ihg').status[0].exp, false);

{ // a screenshot confirms a status whose "thru" date has passed and shows no end date
  app.state = app.normalize({ programs: [{ id: 'ihg', name: 'IHG One Rewards', unit: 'points',
    status: [{ tier: 'Platinum Elite', via: 'from your account · thru 12/31/25' }] }], cards: [] });
  check('a status past its "thru" date shows as expired', app.lineExpired(prog('ihg').status[0]), true);
  app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Platinum Elite') });
  check('…a screenshot confirming it with no end date: not expired now', app.lineExpired(prog('ihg').status[0]), false);
  app.reload();
  check('…and still not expired after a reload (the past date isn’t read back from “thru”)',
    [app.lineExpired(prog('ihg').status[0]), prog('ihg').status[0].exp], [false, '']);
}

{ // a screenshot showing another level than one read from an earlier screen: it replaces that one
  app.state = app.normalize({ programs: [{ id: 'ihg', name: 'IHG One Rewards', unit: 'points',
    status: [{ tier: 'Diamond Elite', via: 'from your account' }, { tier: 'Gold Elite', via: 'status match' }] }], cards: [] });
  app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Platinum Elite') });
  check('a lower level on screen replaces the one read from an earlier screen; one you typed stays',
    prog('ihg').status.map((l) => `${l.tier} | ${l.via}`), ['Platinum Elite | from your account', 'Gold Elite | status match']);
  app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Diamond Elite') });
  check('…and a higher one later replaces it again', prog('ihg').status.map((l) => `${l.tier} | ${l.via}`),
    ['Diamond Elite | from your account', 'Gold Elite | status match']);
}
start(['ihg-premier']);
{ // a card's level still covers a screen showing the same level or lower
  const before = prog('ihg').status.length;
  app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Gold Elite') });
  check('a card’s Platinum Elite covers a screen showing Gold Elite: nothing added, the card’s line stays',
    [prog('ihg').status.length, prog('ihg').status.some((l) => l.card === 'ihg-premier')], [before, true]);
}
start(['ihg-premier']);
{ // a screen showing the card's level, with a higher level read from an earlier screen: the drop registers
  prog('ihg').status.push({ tier: 'Diamond Elite', via: 'from your account' });
  const result = app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Gold Elite') });
  check('a card’s level on screen replaces a higher one read from an earlier screen, as a real change',
    [prog('ihg').status.some((l) => l.tier === 'Diamond Elite'), prog('ihg').status.some((l) => l.card === 'ihg-premier'), result.real > 0],
    [false, true, true]);
}
{ // confirming an expired status reactivates it: a real change, with a note
  app.state = app.normalize({ programs: [{ id: 'ihg', name: 'IHG One Rewards', unit: 'points',
    status: [{ tier: 'Platinum Elite', via: 'from your account · thru 12/31/25' }] }], cards: [] });
  const result = app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Platinum Elite') });
  check('a screenshot reactivating an expired status counts as a change, with a note', [result.real, result.notes.length > 0], [1, true]);
}
{ // a drop to a level you typed: the higher one read from an earlier screen goes, and that's a real change
  app.state = app.normalize({ programs: [{ id: 'ihg', name: 'IHG One Rewards', unit: 'points',
    status: [{ tier: 'Gold Elite', via: '' }, { tier: 'Platinum Elite', via: 'from your account' }] }], cards: [] });
  const result = app.applyRead('ihg', { tierIndex: app.findTier(app.scanTiersFor('ihg'), 'Gold Elite') });
  check('screen shows Gold, with Gold typed and Platinum read earlier: Platinum goes, as a real change',
    [prog('ihg').status.map((l) => l.tier), result.real > 0], [['Gold Elite'], true]);
}

/* ---------- Turning a card off keeps programs that still hold your data ---------- */

const keeps = (label, add) => {
  start(['amex-platinum']);
  add(app.state);
  app.removeCard(app.state, 'amex-platinum');
  check(`turning a card off keeps a program it created that has ${label}`, !!prog('lhw'), true);
};
keeps('a note', (s) => { s.memos.lhw = 'Upgrade at check-in'; });
keeps('a goal', (s) => { s.goals.lhw = { target: 50000, label: '' }; });
keeps('balance history', (s) => { s.history.lhw = [['2026-09-01', 1200]]; });
keeps('your own ¢/pt value', (s) => { s.cpp.lhw = 1.2; });
keeps('a second count (stays)', (s) => { s.progress['lhw+alt'] = 3; });
start(['amex-platinum']);
app.removeCard(app.state, 'amex-platinum');
check('…and still drops one with nothing in it', prog('lhw'), undefined);

/* ---------- Fee dates outlive removing a card ---------- */

start(['amex-platinum']);
app.state.renewals['amex-platinum'] = '2026-03-15';
app.removeCard(app.state, 'amex-platinum');
app.reload();
app.applyCard(app.state, 'amex-platinum');
check('fee date: remove a card, reload, add it back — the date is still there', app.state.renewals['amex-platinum'], '2026-03-15');
check('…an unknown card’s fee date is still dropped', app.normalize({ programs: [], cards: [], renewals: { 'not-a-card': '2026-03-15' } }).renewals, {});

/* ---------- Deleting a program takes its ¢/pt value with it ---------- */

app.state = app.normalize({ programs: [{ id: 'hilton', name: 'Hilton Honors', unit: 'points', status: [] }], cards: [], cpp: { hilton: 0.7 },
  game: { confirmed: { hilton: '2026-10-08' } } });
app.openSheet('hilton');
app.deleteProgram();
check('deleting a program clears its ¢/pt but keeps today’s re-check', [app.state.cpp.hilton, app.state.game.confirmed.hilton], [undefined, '2026-10-08']);
app.shown.toasts.at(-1).action();
check('…Undo puts them back', [app.state.cpp.hilton, app.state.game.confirmed.hilton], [0.7, '2026-10-08']);
app.openSheet('hilton');
app.deleteProgram();
app.openSheet(null);
app.els['#p-name'].value = 'Hilton Honors';
app.els['#p-status'].children[0].querySelector('.sl-tier').value = '';
app.submit();
check('…and the same program added back starts without the old value', [prog('hilton') && prog('hilton').id, app.state.cpp.hilton], ['hilton', undefined]);
check('…but still counts as re-checked today, so confirming it again earns no second XP', app.state.game.confirmed.hilton, '2026-10-08');
app.state.programs = app.state.programs.filter((p) => p.id !== 'hilton');
check('…a re-check for a program that’s still gone is dropped at the next load', app.reload().game.confirmed.hilton, undefined);

/* ---------- Card statuses aren't cut by the cap on a program's status lines ---------- */

app.state = app.normalize({ programs: [], cards: [] });
const loungeCards = app.CARDS.filter((c) => c.grants.some(([id]) => id === 'lounges')).map((c) => c.id);
for (const id of loungeCards) app.applyCard(app.state, id);
const lounges = () => prog('lounges').status.length;
const given = lounges();
check('every card that grants lounge access: more than 20 lounge lines', [loungeCards.length > 20, given], [true, loungeCards.length]);
app.reload();
check('…all still there after a reload', lounges(), given);
app.reload();
check('…and the next one', lounges(), given);
prog('lounges').status.push(...Array.from({ length: 25 }, (_, i) => ({ tier: `Pass ${i + 1}`, via: 'typed' })));
app.reload();
check('…plus 25 typed lines: the first 20 typed are kept, and every card line', [lounges(), prog('lounges').status.filter((l) => !l.card).length], [given + 20, 20]);
const flood = app.normalize({ programs: [{ id: 'lounges', name: 'Lounges', status: Array.from({ length: 500 }, () => ({ tier: 'x', via: 'y', card: 'amex-platinum' })) }], cards: [] });
check('…while a file flooding one program with card lines is still capped', flood.programs[0].status.length <= given, true);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
