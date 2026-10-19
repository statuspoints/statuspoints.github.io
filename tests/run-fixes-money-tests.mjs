// Checks fixes to credits, transfers and balances (from index.html): goal and transfer advice that follows the
// cards you hold, card-year credits that stay used when the annual-fee date changes, Restore leaving the
// points-expiry clock alone, December credit amounts, and imported numbers capped like typed ones.
// Usage: node tests/run-fixes-money-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// Everything up to `const state = load();`, plus the pieces of the app under test (from a line up to the next
// given line).
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const piece = (from, to) => { const at = js.indexOf(from); if (at < 0) throw new Error(`not found: ${from}`); return js.slice(at, js.indexOf(to, at)); };

// A small fake app: elements that keep their text, a clock set by the test, and the rest stubbed.
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const CSS = { escape: (s) => s };
  const textOf = (n) => (n == null ? '' : typeof n === 'object' ? n.text : String(n));
  const element = (tag) => ({ tag, attrs: {}, kids: [], className: '', hidden: false, dataset: {}, listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...k) { this.kids.push(...k); }, replaceChildren(...k) { this.kids = k; },
    addEventListener(type, fn) { this.listeners[type] = fn; }, get text() { return this.kids.map(textOf).join(''); },
    set textContent(t) { this.kids = [t]; } });
  const elements = {};
  const document = { querySelector: (sel) => elements[sel] || (elements[sel] = element('div')), createElement: element };
`;
let now = new Date(2026, 9, 8, 12); // Thu Oct 8, 2026
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now.getTime(); }
}
const ui = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}
  let state = normalize({ programs: [], cards: [] });
  let detailId = null;
  const detailProgram = () => state.programs.find((p) => p.id === detailId);
  const shown = { toasts: [] };
  const showToast = (message, action) => shown.toasts.push({ message, action });
  const scheduleSave = () => {}; const saveNow = () => {}; const markWeek = () => {};
  const rollOver = () => false; // (no new qualifying year in these checks)
  const renderDetail = () => {}; const renderPrograms = () => {}; const renderWorth = () => {};
  const renderUpcoming = () => {}; const renderCredits = () => {}; const renewalText = () => '';
  ${piece('  function parseISODate', '  // Soonest expiration first')}
  ${piece('  function isoOf', '  // Phones: hand the file')}
  ${piece('  // The next time a card', '  const perksLine')}
  ${piece('  // Balance history for the trend', '  // Empty input clears the value')}
  ${piece('  // Bank points on your list that transfer', '  // On a program')}
  ${piece('  // Bank points: where they can go', '  // Whether the balance can expire')}
  ${piece("  $('#cards-renewals').addEventListener('change'", '  /* ---------- Welcome bonuses')}
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const creditId = (cardId, id) => \`\${cardId}:\${id}\`;
  ${piece('  const creditMoney', '  let addingCreditFor')}
  const creditOpen = new Map();
  ${piece("  $('#credits-list').addEventListener('click'", "  $('#credits-list').addEventListener('submit'")}
  const signed = (n) => \`\${n < 0 ? '−' : '+'}\${fmt(Math.abs(n))}\`;
  ${piece('  // Every update, newest first', '  // A savings goal')}
  const detail = element('dialog');
  detail.addEventListener('click', (e) => {
    const backdropTap = () => false;
  ${piece("    const restore = e.target.closest('[data-restore]');", "    const btn = e.target.closest('button');")}
  });
  globalThis.ui = { coverLine, renderTransfers, heldCredits, creditRate, elements, detail, shown, normalize, setField, updateLog, TRANSFERS,
    getState: () => state, setState: (s) => { state = s; }, openDetail: (id) => { detailId = id; } };`, ui);
const app = ui.ui;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

const prog = (id, name, unit = 'points') => ({ id, name, unit, status: [] });
const chase = prog('chase', 'Chase Ultimate Rewards');
const citi = prog('citi', 'Citi ThankYou Points');
const hyatt = prog('hyatt', 'World of Hyatt');
const american = prog('american', 'American AAdvantage', 'miles');
const setup = (fields) => app.setState(app.normalize({ programs: [chase, citi, hyatt, american], ...fields }));
const cover = (p, left) => { const line = app.coverLine(p, left); return line ? line.text : null; };

// 1. Goal advice follows your cards (Chase → Hyatt is 4:3 without a Sapphire Reserve; Freedom points and no-fee
// Citi points have their own limits)
setup({ cards: ['sapphire-preferred'], balances: { chase: 35000 } });
check('Sapphire Preferred: 35,000 Chase points at 4:3 don’t cover 30,000 Hyatt',
  cover(hyatt, 30000), 'Transferring all your Chase Ultimate Rewards points would add 26,250, leaving 3,750 to earn.');
setup({ cards: ['sapphire-preferred'], balances: { chase: 45000 } });
check('…45,000 do: transfer 40,000 (4:3)', cover(hyatt, 30000), 'Your Chase Ultimate Rewards points cover it: transfer 40,000 (4:3).');
setup({ cards: ['sapphire-reserve', 'freedom-flex'], balances: { chase: 35000 } });
check('Sapphire Reserve: 1:1 to Hyatt', cover(hyatt, 30000), 'Your Chase Ultimate Rewards points cover it: transfer 30,000 (1:1).');
setup({ cards: ['freedom-unlimited'], balances: { chase: 35000 } });
check('Freedom Unlimited alone: Chase points can’t transfer, so no advice', cover(hyatt, 30000), null);
setup({ cards: ['double-cash'], balances: { citi: 50000 } });
check('no-fee Citi only: American at 10:7 (Citi’s page: only ThankYou Mastercard and AT&T cards can’t)', cover(american, 30000), 'Your Citi ThankYou Points points cover it: transfer 42,858 (10:7).');
setup({ cards: ['strata-premier', 'double-cash'], balances: { citi: 50000 } });
check('with a Strata Premier: Citi → American 1:1', cover(american, 30000), 'Your Citi ThankYou Points points cover it: transfer 30,000 (1:1).');
setup({ cards: [], balances: { chase: 35000 } });
check('no cards listed: the table’s ratio, as before', cover(hyatt, 30000), 'Your Chase Ultimate Rewards points cover it: transfer 30,000 (1:1).');
setup({ cards: ['united-explorer'], balances: { chase: 35000 } }); // a Chase card that earns United miles, not Chase points
check('only a co-brand from the same bank: the table’s ratio', cover(hyatt, 30000), 'Your Chase Ultimate Rewards points cover it: transfer 30,000 (1:1).');

// …and so do the transfer lists
const transfers = (p) => { app.renderTransfers(p); return app.elements['#d-transfers'].text; };
setup({ cards: ['sapphire-preferred'], balances: { chase: 40000 } });
check('Hyatt page, Sapphire Preferred: Chase row shows 4:3 and what 40,000 becomes', transfers(hyatt).includes('4:3 · 40,000 → 30,000 points'), true);
check('…and Chase’s own note', transfers(hyatt).includes('Transfers need a Sapphire Preferred'), true);
check('Chase page, Sapphire Preferred: Hyatt row at 4:3', transfers(chase).includes('World of Hyatt4:3 · 40,000 → 30,000 points'), true);
setup({ cards: ['double-cash'], balances: { citi: 10000 } });
check('American page, no-fee Citi: Citi row at 10:7, not “can’t transfer”', [transfers(american).includes('10:7 · 10,000 → 7,000 miles'), transfers(american).includes('your cards can’t transfer here')], [true, false]);
check('…and Citi’s note says American is included', transfers(american).includes('No-fee Citi cards (Strata, Double Cash, Custom Cash) transfer at 10:7, American included.'), true);
check('Citi page, no-fee Citi: airlines at 10:7', transfers(citi).includes('10:7 · 10,000 → 7,000 miles'), true);
check('…and so are the partners listed under Also', transfers(citi).includes('Also: EVA 10:7 · Thai 10:7.'), true);
// Partners that aren't 1:1: the note gives no no-fee ratio, so the table's (Strata) ratio with a plain caveat,
// no "→" figure, and no goal advice built on a guess
setup({ cards: ['double-cash'], balances: { citi: 10000 } });
const unpriced = 'with Strata Premier or Strata Elite; no-fee Citi cards get less — check Citi';
check('Citi page, no-fee Citi: Choice at the table’s 1:1.5 with the caveat', transfers(citi).includes(`Choice Privileges1:1.5 · ${unpriced}`), true);
check('…ALL Accor at 2:1', transfers(citi).includes(`ALL Accor2:1 · ${unpriced}`), true);
check('…Emirates at 5:4', transfers(citi).includes(`Emirates Skywards5:4 · ${unpriced}`), true);
check('…I Prefer at 1:2', transfers(citi).includes(`I Prefer Hotel Rewards1:2 · ${unpriced}`), true);
check('…no made-up ratios like 1:1.05, 1:0.35, 1:0.56 or 1:1.4', /(?<![\d.])(1:1\.05|1:0\.35|1:0\.56|1:1\.4)(?![\d.])/.test(transfers(citi)), false);
check('…and no figure for what 10,000 becomes there', /Choice Privileges[^·]*· 10,000 →/.test(transfers(citi)), false);
const choice = prog('choice', 'Choice Privileges');
app.setState(app.normalize({ programs: [citi, choice], cards: ['double-cash'], balances: { citi: 50000 } }));
check('Choice page, no-fee Citi: Top up row at 1:1.5 with the caveat', transfers(choice).includes(`Citi ThankYou Points1:1.5 · ${unpriced}`), true);
check('…no “→” figure', transfers(choice).includes('50,000 →'), false);
check('…and no goal advice from a guessed ratio', cover(choice, 21000), null);
app.setState(app.normalize({ programs: [citi, choice], cards: ['strata-premier'], balances: { citi: 50000 } }));
check('Choice page, Strata Premier: goal advice at 1:1.5', cover(choice, 21000), 'Your Citi ThankYou Points points cover it: transfer 14,000 (1:1.5).');
app.TRANSFERS.citi.partners.push(['Example Inn', 1, 2]); // every Citi partner outside the catalog is 1:1 today
setup({ cards: ['double-cash'], balances: { citi: 10000 } });
check('Citi page, no-fee Citi: a partner under Also that isn’t 1:1 gets the caveat', transfers(citi).includes(`Example Inn 1:2 (${unpriced})`), true);
app.TRANSFERS.citi.partners.pop();
setup({ cards: ['strata-premier'], balances: { citi: 10000 } });
check('Citi page, Strata Premier: Also at the table’s ratios', transfers(citi).includes('Also: EVA 1:1 · Thai 1:1.'), true);
check('…and Choice at the table’s 1:1.5', transfers(citi).includes('Choice Privileges1:1.5 · 10,000 → 15,000 points'), true);
app.TRANSFERS.chase.partners.push(['Example Air', 1, 1]); // Chase has no partner outside the catalog today
setup({ cards: ['freedom-unlimited'], balances: { chase: 10000 } });
check('Chase page, Freedom only: Also says your cards can’t transfer there', transfers(chase).includes('Also: Example Air 1:1 (your cards can’t transfer here).'), true);
app.TRANSFERS.chase.partners.pop();

// 2. A card-year credit marked used stays used when the annual-fee date is added or corrected
const changeFeeDate = (cardId, value) => app.elements['#cards-renewals'].listeners.change({ target: { closest: () => ({ dataset: { renewal: cardId }, value }) } });
const hotel = () => app.heldCredits().find((x) => x.key === 'sapphire-preferred:hotel');
const toggleUsed = (key) => app.elements['#credits-list'].listeners.click({ target: { closest: (sel) => (sel === 'button' ? { dataset: { creditUse: key }, closest: () => null } : null) } });
setup({ cards: ['sapphire-preferred'] });
toggleUsed('sapphire-preferred:hotel'); // marked used today (Oct 8), before any fee date
check('used with no fee date', hotel().used, true);
check('…and the day it was marked is kept', app.getState().creditsUsedOn['sapphire-preferred:hotel'], '2026-10-08');
changeFeeDate('sapphire-preferred', '2026-03-15');
check('fee date added: still used', hotel().used, true);
changeFeeDate('sapphire-preferred', '2026-04-20');
check('fee date corrected: still used', hotel().used, true);
changeFeeDate('sapphire-preferred', '');
check('fee date cleared: still used', hotel().used, true);
toggleUsed('sapphire-preferred:hotel');
check('unmarked: unused, and its date gone', [hotel().used, 'sapphire-preferred:hotel' in app.getState().creditsUsedOn], [false, false]);
setup({ cards: ['sapphire-preferred'] });
changeFeeDate('sapphire-preferred', '2026-03-15');
check('one not marked used stays unused', hotel().used, false);
// …but not into a card year that began after it was used
setup({ cards: ['sapphire-preferred'] });
now = new Date(2026, 5, 15, 12); // used in June, no fee date yet
toggleUsed('sapphire-preferred:hotel');
now = new Date(2026, 9, 10, 12);
changeFeeDate('sapphire-preferred', '2025-10-01'); // this card year began Oct 1, 2026
check('used in June, card year from Oct 1: unused in the new card year', hotel().used, false);
changeFeeDate('sapphire-preferred', '');
check('…and used again once the fee date is cleared (still 2026)', hotel().used, true);
setup({ cards: ['sapphire-preferred'] });
now = new Date(2026, 9, 5, 12); // used Oct 5
toggleUsed('sapphire-preferred:hotel');
now = new Date(2026, 9, 10, 12);
changeFeeDate('sapphire-preferred', '2025-10-01');
check('used Oct 5, card year from Oct 1: still used', hotel().used, true);
setup({ cards: ['sapphire-preferred'], renewals: { 'sapphire-preferred': '2025-11-15' } });
now = new Date(2026, 1, 10, 12); // used in February, card year from Nov 15, 2025
toggleUsed('sapphire-preferred:hotel');
now = new Date(2026, 9, 10, 12);
check('used in February, card year from Nov 15: still used in October', hotel().used, true);
changeFeeDate('sapphire-preferred', '2025-10-01');
check('fee date corrected to Oct 1: the February use was last card year', hotel().used, false);
// A mark from before use dates were kept moves only where the new card year can't have begun after it
setup({ cards: ['sapphire-preferred'], creditsUsed: { 'sapphire-preferred:hotel': '2026' } });
changeFeeDate('sapphire-preferred', '2026-03-15');
check('old mark, card year from Mar 15: can’t tell, so unused', hotel().used, false);
setup({ cards: ['sapphire-preferred'], creditsUsed: { 'sapphire-preferred:hotel': '2026' } });
changeFeeDate('sapphire-preferred', '2025-11-20');
check('old mark, card year from Nov 20, 2025: still used', hotel().used, true);
// A use inside the card year the new date gives counts, even when the old date put it in an earlier period
now = new Date(2026, 9, 10, 12);
setup({ cards: ['sapphire-preferred'], renewals: { 'sapphire-preferred': '2025-10-01' },
  creditsUsed: { 'sapphire-preferred:hotel': 'A2025-10-01' }, creditsUsedOn: { 'sapphire-preferred:hotel': '2026-09-20' } });
check('used Sep 20 under a wrong Oct 1 fee date: unused in the card year from Oct 1, 2026', hotel().used, false);
changeFeeDate('sapphire-preferred', '2025-09-15');
check('…corrected to Sep 15: the Sep 20 use is in this card year, so used', [hotel().used, app.getState().creditsUsed['sapphire-preferred:hotel']], [true, 'A2026-09-15']);
setup({ cards: ['sapphire-preferred'], creditsUsed: { 'sapphire-preferred:hotel': '2025' }, creditsUsedOn: { 'sapphire-preferred:hotel': '2025-12-10' } });
check('used Dec 10, 2025 with no fee date: unused in 2026', hotel().used, false);
changeFeeDate('sapphire-preferred', '2025-11-15');
check('…fee date Nov 15 added: the card year from Nov 15, 2025 holds that use, so used', hotel().used, true);
setup({ cards: ['sapphire-preferred'], creditsUsed: { 'sapphire-preferred:hotel': 'A2024-11-15' }, creditsUsedOn: { 'sapphire-preferred:hotel': '2024-12-01' } });
changeFeeDate('sapphire-preferred', '2025-11-15');
check('…a use from an earlier card year stays there', [hotel().used, app.getState().creditsUsed['sapphire-preferred:hotel']], [false, 'A2024-11-15']);
// A mark from before use dates were kept survives undoing a fee-date change
setup({ cards: ['sapphire-preferred'], creditsUsed: { 'sapphire-preferred:hotel': '2026' } });
changeFeeDate('sapphire-preferred', '2025-11-20');
changeFeeDate('sapphire-preferred', '');
check('old mark, fee date added then cleared: used again', hotel().used, true);
setup({ cards: ['sapphire-preferred'], renewals: { 'sapphire-preferred': '2026-03-15' }, creditsUsed: { 'sapphire-preferred:hotel': 'A2026-03-15' } });
changeFeeDate('sapphire-preferred', '2026-01-15');
check('old mark, fee date typo to Jan 15: still used', hotel().used, true);
changeFeeDate('sapphire-preferred', '2026-03-15');
check('…corrected back to Mar 15: still used', [hotel().used, app.getState().creditsUsed['sapphire-preferred:hotel']], [true, 'A2026-03-15']);
now = new Date(2026, 9, 8, 12);
const usedOn = app.normalize({ programs: [], cards: [], creditsUsedOn: { 'a:b': '2026-06-15', 'c:d': 'June', 'e:f': 7 } }).creditsUsedOn;
check('saved use dates: valid ones kept, others dropped', usedOn, { 'a:b': '2026-06-15' });
check('old saves without use dates load', app.normalize({ programs: [], cards: [] }).creditsUsedOn, {});

// 3. Restoring an earlier balance (a fixed misread) leaves the points-expiry clock alone, and so does its Undo
const restore = (value, at) => app.detail.listeners.click({ target: { closest: (sel) => (sel === '[data-restore]' ? { dataset: at == null ? { restore: String(value) } : { restore: String(value), restoreAt: String(at) } } : null) } });
setup({ cards: [], balances: { chase: 50000 }, activity: { chase: '2025-02-10' }, updated: { chase: '2026-10-08' } });
app.openDetail('chase');
restore(42000);
check('Restore: balance put back', app.getState().balances.chase, 42000);
check('Restore: last activity unchanged', app.getState().activity.chase, '2025-02-10');
app.shown.toasts.pop().action();
check('Undo: balance back again', app.getState().balances.chase, 50000);
check('Undo: last activity still unchanged', app.getState().activity.chase, '2025-02-10');
setup({ cards: [], balances: { chase: 50000 } });
app.openDetail('chase');
restore(42000);
check('Restore with no activity date: none added', 'chase' in app.getState().activity, false);
// The main case: a misread that reset the clock, noticed a week later. Restore puts back the date it replaced.
setup({ cards: [], balances: { chase: 48000 }, activity: { chase: '2025-02-10' }, updated: { chase: '2026-09-01' } });
now = new Date(2026, 9, 1, 12);
app.setField('bal:chase', 84000, 's'); // misread
check('a misread resets the clock, as any change does', app.getState().activity.chase, '2026-10-01');
check('…and its history entry keeps the date it replaced', app.getState().history.chase, [['2026-09-01', 48000], ['2026-10-01', 84000, 's', '2025-02-10']]);
app.setField('bal:chase', 85000, 's'); // read again the same day
check('a second change the same day keeps the first one’s earlier date', app.getState().history.chase[1], ['2026-10-01', 85000, 's', '2025-02-10']);
now = new Date(2026, 9, 8, 12);
const restoreButtons = app.updateLog(chase, app.getState().history.chase).kids[1].kids.map((li) => li.kids[2]).filter(Boolean);
check('Restore buttons say which update they put back', restoreButtons.map((b) => [b.attrs['data-restore'], b.attrs['data-restore-at']]), [['48000', '0']]);
restore(48000, 0);
check('Restore after a misread: balance put back', app.getState().balances.chase, 48000);
check('Restore after a misread: last activity back to before the misread', app.getState().activity.chase, '2025-02-10');
app.shown.toasts.pop().action();
check('Undo: the misread’s balance and date again', [app.getState().balances.chase, app.getState().activity.chase], [85000, '2026-10-01']);
setup({ cards: [], balances: { chase: 48000 }, updated: { chase: '2026-09-01' } });
now = new Date(2026, 9, 1, 12);
app.setField('bal:chase', 84000, 's'); // misread, with no activity date before it
now = new Date(2026, 9, 8, 12);
restore(48000, 0);
check('Restore after a misread with no date before it: none', 'chase' in app.getState().activity, false);
setup({ cards: [], balances: { chase: 50000 }, activity: { chase: '2026-10-01' }, history: { chase: [['2026-09-01', 48000], ['2026-10-01', 50000, 't']] } });
restore(48000, 0);
check('older history with no dates kept: last activity unchanged, as before', app.getState().activity.chase, '2026-10-01');
check('history: a kept date loads, a bad one is dropped',
  app.normalize({ programs: [chase], cards: [], history: { chase: [['2026-09-01', 1, 't', '2025-02-10'], ['2026-09-02', 2, 's', ''], ['2026-09-03', 3, 't', 'soon'], ['2026-09-04', 4, undefined, '2025-01-01']] } }).history.chase,
  [['2026-09-01', 1, 't', '2025-02-10'], ['2026-09-02', 2, 's', ''], ['2026-09-03', 3, 't'], ['2026-09-04', 4]]);

// 4. December amounts for monthly credits
const amount = (cardId, id) => app.heldCredits().find((x) => x.key === `${cardId}:${id}`).credit.amount;
setup({ cards: ['amex-platinum', 'united-club', 'united-quest'] });
check('October: Uber Cash $15, rideshare $12 and $8', [amount('amex-platinum', 'uber'), amount('united-club', 'rideshare'), amount('united-quest', 'rideshare')], [15, 12, 8]);
now = new Date(2026, 11, 15, 12);
check('December: Uber Cash $35, rideshare $18 and $12', [amount('amex-platinum', 'uber'), amount('united-club', 'rideshare'), amount('united-quest', 'rideshare')], [35, 18, 12]);
check('December: other monthly credits unchanged', amount('amex-platinum', 'entertainment'), 25);
// …and the December amount reads as this month's, not as if it came every month
const rate = (cardId, id) => app.creditRate(app.heldCredits().find((x) => x.key === `${cardId}:${id}`).credit);
check('December: “$35 this month”, “$18 this month”', [rate('amex-platinum', 'uber'), rate('united-club', 'rideshare')], ['$35 this month', '$18 this month']);
check('December: other monthly credits still “a month”', rate('amex-platinum', 'entertainment'), '$25 a month');
now = new Date(2026, 9, 8, 12);
check('October: “$15 a month”', rate('amex-platinum', 'uber'), '$15 a month');

// Credits that end after 2027 (Peloton, Google Workspace) are gone in 2028, like those that end after 2026
const has = (cardId, id) => app.heldCredits().some((x) => x.key === `${cardId}:${id}`);
setup({ cards: ['sapphire-reserve', 'sapphire-reserve-business'] });
check('2026: Peloton and Google Workspace credits listed', [has('sapphire-reserve', 'peloton'), has('sapphire-reserve-business', 'google')], [true, true]);
now = new Date(2028, 0, 2, 12);
check('2028: Peloton and Google Workspace credits gone', [has('sapphire-reserve', 'peloton'), has('sapphire-reserve-business', 'google')], [false, false]);
now = new Date(2026, 9, 8, 12);

// 5. Imported numbers above the most you can type are capped, like typed ones
const big = app.normalize({ programs: [prog('hilton', 'Hilton Honors'), prog('delta', 'Delta SkyMiles', 'miles')], cards: [], balances: { hilton: 5e12, delta: 1000 }, progress: { hilton: 2e12 }, mqd: 3e12,
  history: { hilton: [['2026-09-01', 4e12, 't'], ['2026-10-01', 5e12]] } });
const MAX = 999999999999;
check('balance capped', big.balances.hilton, MAX);
check('ordinary balance kept', big.balances.delta, 1000);
check('progress capped', big.progress.hilton, MAX);
check('MQDs capped', big.mqd, MAX);
check('history capped', big.history.hilton, [['2026-09-01', MAX, 't'], ['2026-10-01', MAX]]);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
