// The voucher scan card's flow (from index.html) on a small fake page: adding by itself and Undo, already saved
// (counting copies), expired, a date box (empty, past, typed, already saved), an account card with an undated voucher,
// "Fix something" (the other vouchers kept, a batch kept going), a full list, focus after adding, and "Fix something" on
// an account card carrying a typed date. The reader itself is checked in run-voucher-tests.mjs.
// Usage: node tests/run-voucher-flow-tests.mjs — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
// The app's own page helpers (h, svgIcon, $) are swapped for the fake page's.
const head = lines.slice(2, loadAt).join('\n').replace(/^  function (h|svgIcon)\(/gm, '  function $1Real(');
const piece = (from, to) => { const at = js.indexOf(from); if (at < 0) throw new Error(`not found: ${from}`); const end = js.indexOf(to, at); if (end < 0) throw new Error(`not found: ${to}`); return js.slice(at, end); };
const parser = piece('  // Words that identify each program in an account screen', '  // Loads the open-source text reader');
const dates = piece('  function parseISODate', '  function daysUntil') + piece('  function sortVouchers', '  function expiryLine') + piece('  function isoOf', '  // The latest "today" anywhere');
const card = piece('  /* ---------- Vouchers found on a screenshot: shown on the card', '  function startCountdown() {');
const collectNow = piece('  function collectNow() {', '  // "Fix something": the review form');
const fixPlay = piece('  function fixPlay() {', '  function closePlay()');
const lootBits = piece('  const lootText = ', '  function deltaTag(');
const batchBits = piece('  function scanFiles(list) {', '  function renderPlayCount() {') + piece('  function endBatch(then', '  // Undo of a collect or batch');

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    expected ${JSON.stringify(want)}\n    got      ${JSON.stringify(got)}`}`);
};

// A fresh fake page and app around the card's code, each time.
function page({ vouchers = [], auto = true, batch = null, queue = [], programs = [] } = {}) {
  const els = {};
  const node = (tag, attrs = {}, kids = []) => {
    const n = { tag, attrs: { ...attrs }, kids, hidden: false, value: '', style: { setProperty() {}, cssText: '' }, children: [], offsetParent: {},
      focused: 0, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, focus() { this.focused++; env.document.activeElement = this; },
      blur() { env.document.activeElement = env.document.body; }, scrollIntoView() {}, replaceChildren(...k) { this.children = k; }, append(...k) { this.children.push(...k); },
      getBoundingClientRect: () => ({}), reset() { for (const id of ['#vname', '#vnote', '#vexp']) if (els[id]) els[id].value = ''; } };
    Object.defineProperty(n, 'innerText', { get: () => kids.flat(9).map((k) => (k && typeof k === 'object' ? k.innerText : k ?? '')).filter(Boolean).join('\n') });
    if (attrs.id) els[`#${attrs.id}`] = n;
    return n;
  };
  const $ = (sel) => els[sel] || (sel.startsWith('#play-vexp') || sel.startsWith('#vlist') ? null : (els[sel] = node('div', {})));
  const env = {
    console, Intl, Math, Number, String, Object, Array, Set, Map, RegExp, JSON,
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(2026, 10, 18, 12); } static now() { return new Date(2026, 10, 18, 12).getTime(); } },
    document: { body: { tag: 'body' }, activeElement: null, querySelector: (sel) => $(sel) }, matchMedia: () => ({ matches: false, addEventListener() {} }), navigator: {}, addEventListener() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
    $, els, node, toasts: [], log: [], timers: [], notes: [],
  };
  env.document.activeElement = env.document.body;
  vm.createContext(env);
  vm.runInContext(`${head}\n${dates}\n${parser}\n
    const state = { programs: ${JSON.stringify(programs)}, vouchers: ${JSON.stringify(vouchers)}, balances: {}, members: {}, progress: {}, updated: {} };
    const h = (tag, attrs, ...kids) => node(tag, attrs || {}, kids);
    const svgIcon = () => node('svg');
    let autoCollect = ${auto};
    const COLLECT_SECONDS = 4;
    const MARK_COLORS = { voucher: '#B4462B' };
    let playing = { url: 'blob:x', vouchers: null };
    let batch = ${JSON.stringify(batch)};
    const scanQueue = ${JSON.stringify(queue)};
    const play = { open: true, close() { this.open = false; log.push('closePlay'); } };
    const setTimeout = (fn) => { timers.push(fn); return timers.length; };
    function closePlay() { if (play.open) play.close(); }
    function cancelPlay() { log.push('cancelPlay'); scanQueue.length = 0; closePlay(); batch = null; }
    function stopCountdown() { log.push('stop'); }
    function startCountdown() { log.push('countdown'); }
    function announce() {}
    function placeMarkLabels() {}
    function markVouchers() {}
    function setActions(list) { globalThis.actions = list; }
    function showToast(message, onUndo, label = 'Undo') { toasts.push({ message, onUndo, label, focus: document.activeElement === document.body }); }
    function saveNow() { log.push('save'); }
    function renderAll() {}
    function renderVouchers() {}
    function markChanged() {}
    function skipNewsForNewSetup() {}
    function finishOne(ok) { log.push(\`finishOne:\${ok}\`); if (batch) { batch.done++; if (ok) batch.collected++; } }
    function nextInQueue() { log.push('nextInQueue'); if (scanQueue.length) { scanQueue.shift(); play.open = true; } }
    let replacePick = false; let pickHint = null; const scanSheet = { open: false }; let scanned = null;
    function unlockSound() {}
    function showNote(message) { notes.push(message); }
    function renderPlayCount() {}
    function offerBonusLanding() {}
    const newBatch = (total) => ({ total, done: 0, collected: 0, before: JSON.parse(JSON.stringify(state)), person: people.active });
    function playScan() { log.push('playScan'); play.open = true; }
    function skipPlay() {}
    function pickAnother() {}
    function undoTo(before) { Object.assign(state, JSON.parse(JSON.stringify(before))); log.push('undo'); }
    function collect(...a) { globalThis.collected = a; }
    function collectMany() {}
    function doubtRow(doubts) { return h('li', { class: 'loot-warn' }, 'Check this first', doubts.join('; ')); }
    function openScan() {}
    function showScanResult(...a) { globalThis.reviewed = a; }
    ${lootBits}
    ${card}
    ${collectNow}
    ${fixPlay}
    ${batchBits}
    globalThis.app = { scanFiles, play, state, get playing() { return playing; }, set playing(v) { playing = v; }, get batch() { return batch; }, scanQueue, findVouchers, showVoucherLoot,
      collectNow, fixVoucher, resumeAfterForm, dropScannedForm, voucherDoubts, get vformNext() { return vformNext; }, fixPlay, voucherTally, saveScannedVouchers, VOUCHER_MAX };
  `, env);
  return env;
}
// The card for some text, as showLoot would put it up (voucher card only: no account on it).
function cardFor(env, text, extra = {}) {
  const { app } = env;
  app.playing = { url: 'blob:x', vouchers: app.findVouchers(text), ...extra };
  app.showVoucherLoot({});
  return env;
}
const title = (env) => env.els['#play-title'].textContent;
const labels = () => vm.runInContext('actions', current).map((a) => (Array.isArray(a[0]) ? a[0].filter((x) => typeof x === 'string').join('') : a[0]));
const press = (label) => vm.runInContext('actions', current).find((a) => (Array.isArray(a[0]) ? a[0].includes(label) : a[0] === label))[2]();
let current;
const ECREDIT = 'Yes, one confirmed: a $75 Delta eCredit that\'s good until Sep 28, 2027. The eCredit number is 0061234567890.';
const TWO = 'UNITED\nTravel credits\nFuture flight credit\n$212.40\nExpires 09/28/2027\nTicket number 0162345678901\nTravelBank cash\n$150.00\nExpires 01/31/2028';

{ // Auto-update on: a countdown, then Add saves it, and Undo takes it away.
  current = page();
  cardFor(current, ECREDIT);
  check('a voucher alone: “Found a voucher”, Fix something and Add voucher, counting down', [title(current), labels(), current.log.includes('countdown')], ['Found a voucher', ['Fix something', 'Add voucher'], true]);
  current.app.collectNow();
  check('…Add saves it', current.app.state.vouchers.map((v) => [v.name, v.note, v.exp]), [['Delta $75 eCredit', 'No. 0061234567890', '2027-09-28']]);
  const t = current.toasts.at(-1);
  check('…a toast with Undo', [t.message, t.label], ['Added Delta $75 eCredit to your vouchers', 'Undo']);
  t.onUndo();
  check('…Undo takes it away', current.app.state.vouchers, []);
}
{ // Auto-update off: no countdown.
  current = page({ auto: false });
  cardFor(current, ECREDIT);
  check('Auto-update off: no countdown, waits for a tap', current.log.includes('countdown'), false);
}
{ // Already saved, and copies counted: two identical certificates with one saved is one new.
  current = page({ vouchers: [{ name: 'Delta $75 eCredit', note: 'No. 0061234567890', exp: '2027-09-28' }] });
  cardFor(current, ECREDIT);
  check('the same number already saved: “Already in your vouchers”, nothing to add', [title(current), labels()], ['Already in your vouchers', ['Try another', 'Done']]);
  current = page({ vouchers: [{ name: 'Hilton free night', note: '', exp: '2027-03-31' }] });
  cardFor(current, 'Hilton Honors\nFree Night Rewards\nFree Night Reward\nExpires Mar 31, 2027\nFree Night Reward\nExpires Mar 31, 2027');
  check('two identical free nights, one saved: one is new', [title(current), current.app.playing.vouchers.map((v) => v.state)], ['Found a voucher', ['have', 'new']]);
  current.app.collectNow();
  check('…Add saves the second', current.app.state.vouchers.length, 2);
}
{ // Expired.
  current = page();
  cardFor(current, 'Delta eCredit $50.00 USD expired Jan 15, 2026');
  check('expired: says so, nothing to add', [title(current), labels()], ['This voucher has expired', ['Try another', 'Done']]);
}
{ // A date box: empty, past, typed; and typed to one already saved.
  current = page({ vouchers: [{ name: 'Southwest $40 flight credit', note: '', exp: '2027-03-03' }] });
  cardFor(current, 'Southwest\nLUV Voucher\n$50.00\nVoucher number 9876543210123456');
  check('undated: no countdown, a date box', [current.log.includes('countdown'), !!current.els['#play-vexp-0']], [false, true]);
  current.app.collectNow();
  check('…Add with the box empty: focus on it, nothing saved', [current.els['#play-vexp-0'].focused, current.app.state.vouchers.length, current.toasts.at(-1).message], [1, 1, 'Add the date the voucher expires']);
  current.els['#play-vexp-0'].value = '2026-01-01';
  current.app.collectNow();
  check('…a past date: marked, nothing saved', [current.els['#play-vexp-0'].attrs['aria-invalid'], current.app.state.vouchers.length], ['true', 1]);
  current.els['#play-vexp-0'].value = '2027-12-31';
  current.app.collectNow();
  check('…a date: saved with it', current.app.state.vouchers.map((v) => v.exp).sort(), ['2027-03-03', '2027-12-31']);
  current = page({ vouchers: [{ name: 'Southwest $40 flight credit', note: '', exp: '2027-03-03' }] });
  cardFor(current, 'Southwest\nFlight credit $40.00\nConfirmation # QWE4R5');
  current.els['#play-vexp-0'].value = '2027-03-03';
  current.app.collectNow();
  check('…typed to a voucher already saved (same name and date): not added twice', [current.app.state.vouchers.length, current.toasts.at(-1).message], [1, 'Southwest $40 flight credit is already in your vouchers']);
  current = page({ vouchers: [{ name: 'Southwest $40 flight credit', note: '', exp: '2027-03-03' }] });
  cardFor(current, 'Southwest flight credit $40.00');
  check('…undated with no number, one of that name saved: a date box (it may be a second one)', [title(current), !!current.els['#play-vexp-0']], ['Found a voucher', true]);
  current.els['#play-vexp-0'].value = '2027-03-03';
  current.app.collectNow();
  check('…typed to the saved one’s date: not added twice', [current.app.state.vouchers.length, current.toasts.at(-1).message], [1, 'Southwest $40 flight credit is already in your vouchers']);
  current.els['#play-vexp-0'].value = '2027-06-01';
  current.app.collectNow();
  check('…another date: a second one, added', current.app.state.vouchers.map((v) => v.exp), ['2027-03-03', '2027-06-01']);
  current = page();
  cardFor(current, 'Hilton Honors\nFree Night Reward\nAward number 7712345678\nFree Night Reward\nAward number 7712345679');
  check('two undated: both found, both get date boxes, no Fix something (dates go on the card)', [title(current), !!current.els['#play-vexp-0'], !!current.els['#play-vexp-1'], labels()], ['Found 2 vouchers', true, true, ['Try another', 'Add 2 vouchers']]);
}
{ // An account card with an undated voucher: the account is saved, the voucher left out and said so.
  current = page();
  current.app.playing = { url: 'blob:x', vouchers: current.app.findVouchers('Free Night Award\nAward number 88123456'), choice: 'marriott', vals: { balance: 150320 }, years: {} };
  current.app.voucherTally(current.app.playing.vouchers);
  current.els['#play-vexp-0'] = current.node('input', { id: 'play-vexp-0' });
  current.app.collectNow();
  const [choice, vals, , , vouchers, undated] = vm.runInContext('collected', current);
  check('account + undated voucher: Update saves the account, leaving the voucher out', [choice, vals.balance, vouchers.length, undated], ['marriott', 150320, 0, 1]);
  // Fix something there: the typed date goes along to the review form.
  current = page();
  current.app.playing = { url: 'blob:x', text: 'x', choice: 'marriott', found: { balances: [] }, vouchers: current.app.findVouchers('Free Night Award\nAward number 88123456') };
  current.app.voucherTally(current.app.playing.vouchers);
  current.els['#play-vexp-0'] = current.node('input', { id: 'play-vexp-0' });
  current.els['#play-vexp-0'].value = '2027-04-04';
  current.app.fixPlay();
  check('…Fix something carries the date typed on the card', vm.runInContext('reviewed', current)[3].map((v) => v.exp), ['2027-04-04']);
}
{ // Fix something with two vouchers: the other is added, the first goes in the form.
  current = page();
  cardFor(current, TWO);
  current.app.fixVoucher();
  check('Fix something, two vouchers: the other is saved, this one in the form', [current.app.state.vouchers.map((v) => v.name), current.els['#vname'].value, current.els['#vexp'].value],
    [['United $150 TravelBank cash'], 'United $212.40 FutureFlight credit', '2027-09-28']);
  check('…with Undo for the one added', [current.toasts.at(-1).message, current.toasts.at(-1).label], ['Added 1 other voucher. Check the voucher, then tap Add', 'Undo']);
}
{ // Fix something mid-batch: the batch goes on after the form's Add; its Undo isn't wiped.
  current = page({ batch: { total: 3, done: 1, collected: 1, before: {} }, queue: ['shot3'] });
  cardFor(current, TWO);
  current.app.fixVoucher();
  check('Fix something mid-batch: the batch and its queue stay', [!!current.app.batch, current.app.scanQueue.length, current.log.includes('cancelPlay')], [true, 1, false]);
  check('…the toast offers the next screenshot (no Undo replacing the batch’s)', current.toasts.at(-1).label, 'Next screenshot');
  current.app.resumeAfterForm();
  current.timers.forEach((fn) => fn());
  check('…the form’s Add goes on to the next screenshot', current.log.filter((l) => l === 'nextInQueue').length, 1);
}
{ // Fix something mid-batch, the form left without Add: the next screenshot chosen goes on with the batch.
  current = page({ batch: { total: 3, done: 1, collected: 1, before: {}, person: 'me' }, queue: ['shot3'] });
  vm.runInContext("people.active = 'me'", current);
  cardFor(current, TWO);
  current.app.fixVoucher();
  current.app.scanFiles([{ type: 'image/png', name: 'shot4.png' }]);
  check('…form left, another screenshot chosen: the waiting one opens (the batch isn’t stuck)', [current.log.includes('nextInQueue'), current.app.play.open, current.app.scanQueue.length], [true, true, 1]);
}
{ // Fix something on the batch's last screenshot: the batch ends there, its Undo in the toast with the ask.
  current = page({ batch: { total: 2, done: 1, collected: 1, before: { vouchers: [] }, person: 'me' }, queue: [] });
  vm.runInContext("people.active = 'me'", current);
  cardFor(current, ECREDIT);
  current.app.fixVoucher();
  const t = current.toasts.at(-1);
  check('Fix something on the last screenshot: the batch ends, its Undo with the ask', [current.app.batch, t.message, t.label], [null, 'Updated from 1 screenshot. Check the voucher, then tap Add', 'Undo']);
}
{ // A date that reads two ways, with no program: the card says both and waits.
  current = page();
  cardFor(current, 'Travel voucher $200.00\nExpires 05/09/2027');
  const warn = current.els['#play-loot'].children[0].innerText;
  check('a date that reads two ways: no countdown, and the card names both dates', [current.log.includes('countdown'), /could be May 9, 2027 or Sep 5, 2027/.test(warn)], [false, true]);
}
{ // The confidence gate: a voucher certain from its own lines adds itself; one inferred waits, saying why.
  current = page();
  cardFor(current, 'Delta eCredit\n$75.00 USD\nExpires Sep 28, 2027');
  check('certain (its name, program and date on its own lines): counts down to add itself', [current.log.includes('countdown'), current.app.playing.vouchers.map((v) => v.certain)], [true, [true]]);
  const waits = (text) => {
    current = page();
    cardFor(current, text);
    return [current.log.includes('countdown'), current.els['#play-loot'].children[0].innerText.split('\n').pop()];
  };
  check('a date taken from the line above: waits, “check the date”', waits('**Expires:** Sep 28, 2027\n**Delta eCredit:** $75.00'), [false, 'check the date for Delta $75 eCredit']);
  check('a credit card’s ad beside it: waits, “check that … isn’t a credit card’s own credit”', waits('Southwest\nFlight credit\n$123.45\nExpires 1/15/2027\nApply for the Southwest Rapid Rewards Credit Card'),
    [false, 'check that Southwest $123.45 flight credit isn’t a credit card’s own credit']);
  check('another program named among its lines: waits, “check which program”', waits('Alaska Airlines\nFlight credit $150.00 valid on American-operated flights\nExpires 3/31/2027'),
    [false, 'check that Alaska $150 flight credit is right — the screen doesn’t clearly name its program']);
  check('no program at all: waits, “check which program”', waits('Travel voucher $200.00\nExpires 25/09/2027'), [false, 'check which program $200 travel voucher is from']);
}
{ // Fix something never saves a voucher the card isn't certain of: only certain ones go in alongside; the others come
  // next in the form, one after another.
  current = page();
  cardFor(current, 'Delta eCredit $75.00 expires Sep 28, 2027\nTravel voucher $200.00 expires 05/09/2027');
  current.app.fixVoucher();
  check('Fix something: the doubted voucher goes in the form, only the certain one is added', [current.els['#vname'].value, current.app.state.vouchers.map((v) => v.name)],
    ['$200 travel voucher', ['Delta $75 eCredit']]);
  current = page();
  cardFor(current, 'Travel voucher $200.00 expires 05/09/2027\nTravel voucher $100.00 expires 03/04/2027');
  current.app.fixVoucher();
  check('…two doubted: nothing saved, the first in the form, the toast says one more comes next', [current.app.state.vouchers.length, current.els['#vname'].value, /1 more voucher to check next/.test(current.toasts.at(-1).message)],
    [0, '$200 travel voucher', true]);
  current.app.resumeAfterForm();
  check('…after the form’s Add, the next one is in the form', [current.els['#vname'].value, current.app.vformNext.length, /^Next: check \$100 travel voucher/.test(current.toasts.at(-1).message)], ['$100 travel voucher', 0, true]);
  // The gate's other reasons, said plainly.
  check('someone else’s voucher: waits, “check whose voucher”', (() => { current = page(); cardFor(current, 'Your husband has a Delta eCredit for $75 that expires Sep 28, 2027.');
    return [current.log.includes('countdown'), current.els['#play-loot'].children[0].innerText.split('\n').pop()]; })(), [false, 'check whose voucher Delta $75 eCredit is']);
  check('a kind’s usual program alone (no name on the page): waits, “check which program”', (() => { current = page(); cardFor(current, 'eCredit $75.00\nExpires Sep 28, 2027');
    return [current.log.includes('countdown'), current.els['#play-loot'].children[0].innerText.split('\n').pop()]; })(), [false, 'check that Delta $75 eCredit is right — the screen doesn’t clearly name its program']);
}
{ // A voucher split off a line ("…, and a Sky Club day pass valid until …") waits, and Fix something doesn't save it
  // alongside: it goes in the form for a look; only the certain eCredit is added.
  current = page();
  cardFor(current, 'Delta eCredit $75 expires Sep 28, 2027, and a Sky Club day pass valid until Dec 31, 2026');
  check('a split-off pass: no countdown, the reason says so', [current.log.includes('countdown'), /named alongside another/.test(current.els['#play-loot'].children[0].innerText)], [false, true]);
  current.app.fixVoucher();
  check('…Fix something: the pass in the form, only the eCredit saved', [current.els['#vname'].value, current.app.state.vouchers.map((v) => v.name)], ['Delta Sky Club day pass', ['Delta $75 eCredit']]);
}
{ // The form's waiting list belongs to its person and its form session.
  const THREE = 'eCredit $75.00\nExpires Sep 28, 2027\neCredit $50.00\nExpires Oct 1, 2027\neCredit $40.00\nExpires Nov 1, 2027';
  current = page();
  cardFor(current, THREE);
  current.app.fixVoucher();
  check('Fix something with 3 that need a look: one in the form, 2 waiting', [current.els['#vname'].value, current.app.vformNext.length], ['Delta $75 eCredit', 2]);
  current.app.dropScannedForm(); // what switching person (stopScanning) does
  check('switching person: the waiting list goes and the form is emptied (nothing of Pat’s reaches Sam)', [current.app.vformNext.length, current.els['#vname'].value], [0, '']);
  check('…stopScanning lets them go', /function stopScanning\(\) \{\s*dropScannedForm\(\);/.test(js), true);
  current = page();
  cardFor(current, THREE);
  current.app.fixVoucher();
  current.app.resumeAfterForm({ name: 'My own lounge pass', note: '', exp: '2027-01-01' });
  check('a voucher typed by hand instead: the waiting list ends (the form isn’t refilled)', [current.app.vformNext.length, current.els['#vname'].value], [0, 'Delta $75 eCredit']);
  current = page();
  cardFor(current, THREE);
  current.app.fixVoucher();
  current.app.resumeAfterForm({ name: 'Delta $70 eCredit', note: '', exp: '2027-09-28' });
  check('…the scanned one edited (“Delta $70 eCredit”): the next one comes', [current.app.vformNext.length, current.els['#vname'].value], [1, 'Delta $50 eCredit']);
  current = page({ batch: { total: 3, done: 1, collected: 1, before: {}, person: 'me' }, queue: ['shot3'] });
  vm.runInContext("people.active = 'me'", current);
  cardFor(current, THREE);
  current.app.fixVoucher();
  current.toasts.at(-1).onUndo(); // “Next screenshot”
  check('“Next screenshot” with vouchers still waiting: said, not silent', [current.app.vformNext.length, current.notes.at(-1)], [0, '2 vouchers from the last screen weren’t checked — scan it again to add them']);
  current = page();
  cardFor(current, THREE);
  check('the reason is said once for all of them, not per voucher', current.els['#play-loot'].children[0].innerText.split('\n').pop(), 'check that these 3 vouchers are right — the screen doesn’t clearly name their program');
}
{ // A full list: nothing added, and said so.
  const full = Array.from({ length: 200 }, (_, i) => ({ name: `Old ${i}`, note: '', exp: '2027-01-01' }));
  current = page({ vouchers: full });
  cardFor(current, ECREDIT);
  current.app.collectNow();
  check('200 vouchers: the new one isn’t added, and the toast says why', [current.app.state.vouchers.length, current.toasts.at(-1).message], [200, '1 voucher wasn’t added — you have 200; remove old ones first']);
  current = page({ vouchers: full.slice(1) });
  cardFor(current, TWO);
  current.app.collectNow();
  check('199 vouchers, two found: one added, and the toast says the other wasn’t', [current.app.state.vouchers.length, current.toasts.at(-1).message], [200, 'Added United $212.40 FutureFlight credit to your vouchers. 1 voucher wasn’t added — you have 200; remove old ones first']);
}
{ // Focus: a hidden control (the paste sheet's Read button) lets go, so the toast's Undo gets it.
  current = page();
  cardFor(current, ECREDIT);
  current.document.activeElement = { tag: 'button', offsetParent: null, blur() { current.document.activeElement = current.document.body; } };
  current.app.collectNow();
  check('after adding: focus left on a hidden control is let go, so Undo takes it', current.toasts.at(-1).focus, true);
}

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
