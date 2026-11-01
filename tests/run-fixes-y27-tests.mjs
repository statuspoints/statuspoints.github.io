// Checks the switch to United's and Southwest's 2027 rules (from index.html) against a clock the checks set: both
// sides of midnight on Jan 1, 2027 for the rules and levels, saved A-List and A-List Preferred statuses, a level renewed
// across the rename, one that ended before it, a count from 2026 still judged by 2026's rules, the screenshot reader
// (a surname that ends in a level's word too), a backup round trip, and a page left open over midnight.
// Usage: node tests/run-fixes-y27-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import cases from './scan-cases.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const slice = (from, to) => js.slice(js.indexOf(from), js.indexOf(to));
// A whole top-level function or const: its first line, the more-indented lines under it, and its closing line.
const top = (name) => {
  const at = lines.findIndex((l) => new RegExp(`^  (?:async )?function ${name}\\(|^  (?:const|let) ${name} = `).test(l));
  if (at < 0) throw new Error(`not found in index.html: ${name}`);
  let end = at + 1;
  while (end < lines.length && (/^ {4}/.test(lines[end]) || (lines[end] === '' && /^ {4}/.test(lines[end + 1] || '')))) end++;
  if (/^ {2}[}\])]/.test(lines[end] || '')) end++;
  return lines.slice(at, end).join('\n');
};
const pieces = ['parseISODate', 'daysUntil', 'isoOf', 'mdy',  'todayISO', 'mergedLines', 'daysLeft', 'lineExpired', 'medallionProgram',
  'hasStatus', 'entryOnly', 'mqdYear', 'medallionThrough', 'effectiveMedallion', 'medallionFor', 'mqdGoal', 'medallionHolds', 'mqdNextText',
  'relativeDay', 'bonuses', 'bonusText', 'creditMoney', 'sortVouchers', 'slugify', 'statusItem', 'upcomingItems',
  'icsText', 'utf8Size', 'icsFold', 'uidPart', 'icsDate', 'buildICS', 'nextRenewal', 'cardGrantsText', 'dependsOn', 'comingUpLine', 'summaryText',
  'pointsExpiry', 'expiryVerdict', 'rollOver', 'viaSpans', 'statusLine', 'statusBlock', 'renderLevels', 'lifetimeLine', 'officialLine', 'perkBlock',
  'simpleStatus', 'statusEditorRow', 'statusOutcome', 'applyRead', 'creditNotesFor', 'realChanges', 'lootRows', 'goalWith', 'exampleSetup', 'expRow', 'renderDetailStatusNow', 'renderToday']
  .filter((name) => lines.some((l) => new RegExp(`^  (?:async )?function ${name}\\(|^  (?:const|let) ${name} = `).test(l)));

// A clock the checks set: `new Date()` and `Date.now()` give it; dates built from parts work as usual.
let now = new Date(2026, 9, 8, 12).getTime();
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
  static now() { return now; }
}
const setNow = (y, m, d, hour = 12, minute = 0, second = 0) => { now = new Date(y, m - 1, d, hour, minute, second).getTime(); };
const lastMinute = () => setNow(2026, 12, 31, 23, 59);
const firstMinute = () => setNow(2027, 1, 1, 0, 0);

const timers = [];
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const fakeEl = (tag) => ({ tag, attrs: {}, dataset: {}, kids: [], hidden: false, textContent: '', value: '', content: { firstChild: null },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; }, append(...k) { this.kids.push(...k); },
    replaceChildren(...k) { this.kids = k; }, addEventListener() {} });
  const els = {};
  const document = { querySelector: (sel) => els[sel] || (els[sel] = fakeEl(sel)), createElement: fakeEl };
`;
const context = vm.createContext({ console, Intl, Math, Date: FakeDate, Number, String, Object, Array, Set, Map, RegExp, JSON, URL, timers });
vm.runInContext(`${stubs}\n${head}
  let state = normalize({ programs: [] });
  const heldCredits = () => [];
  const shown = { draws: [], notes: [], toasts: [] };
  const showNote = (message) => shown.notes.push(message); const showToast = (message) => shown.toasts.push(message);
  const saveNow = () => {};
  const setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; const clearTimeout = () => {};
  ${pieces.map(top).join('\n')}
  ${slice('  // Words that identify each program in an account screen', '  // Loads the open-source text reader')}
  // Lets a page stay "open" over midnight: what's drawn is noted at the moment it's drawn.
  let detail = { open: false };
  const expEditing = null;
  const openFresh = (err) => { throw err; };
  const renderSafely = () => { shown.draws.push({ note: trackFor(state.programs[0]).note, level: (benefitsFor(state.programs[0])[0] || {}).name, block: textOf(statusBlock(state.programs[0])) }); return true; };
  const renderDetail = () => {}; const renderCredits = () => {}; const renderVouchers = () => {};
  ${slice('  let drawnDay = todayISO();', '  // An installed app is usually resumed')}
  const lootIcon = () => null; const lootText = (a, b) => { const el = fakeEl('b'); el.textContent = a + ' / ' + b; return el; }; const lootTag = () => null; const deltaTag = () => null;
  const MARK_COLORS = {}; const goalText = () => null;
  function textOf(el) {
    if (el == null || el === false) return '';
    if (typeof el !== 'object') return String(el);
    if (Array.isArray(el)) return el.map(textOf).join(' ');
    return [el.textContent, ...(el.kids || []).map(textOf)].filter(Boolean).join(' ');
  }
  globalThis.api = { normalize, programFromCatalog, CATALOG_BY_ID, trackFor, benefitsFor, progressInfo, earnedTier, nextText, findTier, topTier, perksFor, hasStatus,
    mergedLines, statusBlock, simpleStatus, rollOver, upcomingItems, comingUpLine, summaryText, buildICS, statusOutcome, parseAccountText, scanTiersFor,
    officialLine, statusEditorRow, renderLevels, renderDetailStatusNow, renderToday, refreshDay, lootRows, exampleSetup, applyRead, TRACKS, shown, textOf, els, setState: (s) => { state = s; }, getState: () => state,
    setDetail: (d) => { detail = d; } };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

// A tracker with these catalog programs, statuses (by program) and saved counts.
const tracker = (ids, status = {}, fields = {}) => {
  const programs = ids.map((id) => ({ ...api.programFromCatalog(api.CATALOG_BY_ID[id]), status: status[id] || [] }));
  const s = api.normalize(JSON.parse(JSON.stringify({ programs, cards: [], ...fields })));
  api.setState(s);
  return s;
};
const program = (s, id) => s.programs.find((p) => p.id === id);
const rule = (id) => api.trackFor(api.CATALOG_BY_ID[id]);
const names = (id) => api.benefitsFor(api.CATALOG_BY_ID[id]).map((t) => t.name);
const earns = (id) => api.benefitsFor(api.CATALOG_BY_ID[id]).map((t) => t.earn);
const statuses = (p) => p.status.map((line) => [line.tier, line.via, line.exp || '']);
const blockText = (p) => api.textOf(api.statusBlock(p));

/* ---------- The rules, on both sides of midnight ---------- */

lastMinute();
check('Dec 31, 23:59 — United: the 2026 thresholds', rule('united').steps, [6000, 12000, 18000, 28000]);
check('Dec 31, 23:59 — United: flights still count', [rule('united').alt.unit, rule('united').alt.steps, rule('united').alt.with], ['flights', [15, 30, 45, 60], [5000, 10000, 15000, 22000]]);
check('Dec 31, 23:59 — United: the note still says what’s coming', /Announced for 2027/.test(rule('united').note), true);
check('Dec 31, 23:59 — United: the levels say either path', earns('united')[3], '28,000 PQP, or 22,000 PQP + 60 flights');
check('Dec 31, 23:59 — Southwest: the 2026 thresholds', [rule('southwest').steps, rule('southwest').alt.steps], [[35000, 70000], [20, 40]]);
check('Dec 31, 23:59 — Southwest: the 2026 levels', names('southwest'), ['A-List', 'A-List Preferred']);
check('Dec 31, 23:59 — Southwest: the 2026 requirements', earns('southwest'), ['20 flights or 35,000 tier points a year', '40 flights or 70,000 tier points a year']);
check('Dec 31, 23:59 — Southwest: the note still says what’s coming', /Announced for Jan 1, 2027/.test(rule('southwest').note), true);

firstMinute();
check('Jan 1, 00:00 — United: 1K needs 32,000', rule('united').steps, [6000, 12000, 18000, 32000]);
check('Jan 1, 00:00 — United: flights no longer count', rule('united').alt, undefined);
check('Jan 1, 00:00 — United: the note is no longer an announcement', /Announced/.test(rule('united').note), false);
check('Jan 1, 00:00 — United: the note keeps the 4-flight minimum', /at least 4 flights on United or United Express/.test(rule('united').note), true);
check('Jan 1, 00:00 — United: the same four levels', names('united'), ['Premier Silver', 'Premier Gold', 'Premier Platinum', 'Premier 1K']);
check('Jan 1, 00:00 — United: no level mentions a flights path', earns('united').some((e) => /\+|15 flights|60 flights/.test(e)), false);
check('Jan 1, 00:00 — United: 1K’s requirement', /^32,000 PQP/.test(earns('united')[3]), true);
check('Jan 1, 00:00 — United: status still lasts through January two years on', api.trackFor(api.CATALOG_BY_ID.united).thru(2027).getFullYear(), 2029);
check('Jan 1, 00:00 — Southwest: three thresholds', [rule('southwest').steps, rule('southwest').alt.steps], [[35000, 65000, 140000], [25, 50, 100]]);
check('Jan 1, 00:00 — Southwest: the new levels', names('southwest'), ['Silver', 'Gold', 'Platinum']);
check('Jan 1, 00:00 — Southwest: the requirements', earns('southwest'), ['25 flights or 35,000 tier points a year', '50 flights or 65,000 tier points a year', '100 flights or 140,000 tier points a year']);
check('Jan 1, 00:00 — Southwest: the note says what the old names became', /A-List is now Silver/.test(rule('southwest').note) && /A-List Preferred is now Gold/.test(rule('southwest').note), true);
check('Jan 1, 00:00 — Southwest: Platinum’s perks name the pass and three bags', api.benefitsFor(api.CATALOG_BY_ID.southwest)[2].perks.filter((perk) => /Companion Pass|3 free checked bags/.test(perk)).length, 2);
check('Jan 1, 00:00 — the other programs are untouched', [rule('hilton').steps, names('delta')[0]], [[10, 25, 50, 80], 'Silver Medallion']);
setNow(2026, 10, 8);
check('today’s rule tables are still what they were', [api.TRACKS.united.steps[3], api.TRACKS.southwest.steps.length], [28000, 2]);

/* ---------- A saved A-List or A-List Preferred ---------- */

const saved = () => tracker(['southwest'], { southwest: [{ tier: 'A-List Preferred', via: 'earned in 2026', exp: '2027-12-31' }] });
const savedAList = () => tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });

lastMinute();
let s = saved();
check('Dec 31: a saved A-List Preferred shows as it was saved', /A-List Preferred/.test(blockText(program(s, 'southwest'))), true);
check('Dec 31: …with its perks', api.topTier(program(s, 'southwest')).name, 'A-List Preferred');
s = savedAList();
check('Dec 31: a saved A-List shows as it was saved', /A-List/.test(blockText(program(s, 'southwest'))), true);
const decemberSummary = api.summaryText();
check('Dec 31: the text summary says A-List', [/\bA-List \(from your account\)/.test(decemberSummary), /\bSilver\b/.test(decemberSummary)], [true, false]);

firstMinute();
s = saved();
const p = program(s, 'southwest');
check('Jan 1: a saved A-List Preferred shows as Gold', [/\bGold\b/.test(blockText(p)), /A-List/.test(blockText(p))], [true, false]);
check('Jan 1: …not as expired or lost', [/Expired/.test(blockText(p)), api.hasStatus(p)], [false, true]);
check('Jan 1: …it’s your top level, with Gold’s perks', api.topTier(p).name, 'Gold');
check('Jan 1: …its end date is untouched', /12\/31\/27/.test(blockText(p)), true);
check('Jan 1: …and what’s saved hasn’t changed', statuses(p), [['A-List Preferred', 'earned in 2026', '2027-12-31']]);
s = savedAList();
const silver = program(s, 'southwest');
check('Jan 1: a saved A-List shows as Silver', [/\bSilver\b/.test(blockText(silver)), /A-List/.test(blockText(silver))], [true, false]);
check('Jan 1: …in Simple view too', [/\bSilver\b/.test(api.textOf(api.simpleStatus(silver))), /A-List/.test(api.textOf(api.simpleStatus(silver)))], [true, false]);
check('Jan 1: …with Silver’s perks', api.perksFor(silver, 'A-List').name, 'Silver');
check('Jan 1: …marked as yours under All levels', (() => { api.renderLevels(silver); return api.textOf(api.els['#d-levels']).split('Silver')[1].trim().startsWith('You'); })(), true);
const januarySummary = api.summaryText();
check('Jan 1: the text summary says Silver, with Silver’s perks', [/\bSilver \(from your account\)/.test(januarySummary), /A-List \(/.test(januarySummary), /40% bonus points/.test(januarySummary)], [true, false, true]);
check('Jan 1: the editor shows the new name', api.statusEditorRow(silver.status[0], silver).kids[0].attrs.value, 'Silver');
check('Jan 1: a saved "A-List" doesn’t fall out of the level finder', [api.findTier(api.benefitsFor(silver), 'A-List'), api.findTier(api.benefitsFor(silver), 'A-List Preferred'), api.findTier(api.benefitsFor(silver), 'Silver')], [0, 1, 0]);

// A status with no end date, and a second account in the program.
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: '' }] });
check('Jan 1: an A-List with no end date shows as Silver', /\bSilver\b/.test(blockText(program(s, 'southwest'))), true);
s = api.normalize({ programs: [{ id: 'southwest-2', name: 'Southwest Rapid Rewards', unit: 'points', who: 'Ms. Lee', status: [{ tier: 'A-List Preferred', via: '', exp: '2027-12-31' }] }], cards: [] });
api.setState(s);
check('Jan 1: a second Southwest account shows as Gold too', [/\bGold\b/.test(blockText(s.programs[0])), api.topTier(s.programs[0]).name], [true, 'Gold']);
// Saved as both names: one row.
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'typed', exp: '2027-12-31' }, { tier: 'Silver', via: 'from your account', exp: '2027-12-31' }] });
check('Jan 1: A-List and Silver saved side by side are one level', api.mergedLines(program(s, 'southwest').status, program(s, 'southwest')).map((g) => g.tier), ['Silver']);
// Some other program's "A-List" isn't Southwest's.
s = tracker(['hilton'], { hilton: [{ tier: 'A-List', via: '' }] });
check('Jan 1: "A-List" typed under another program stays as typed', /A-List/.test(blockText(program(s, 'hilton'))), true);

// A level that ended before the switch was never renamed: it reads as what it was, and as expired.
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'earned in 2025', exp: '2026-12-31' }] });
check('Jan 1: an A-List that ended Dec 31 keeps its name and reads as expired', [/A-List/.test(blockText(program(s, 'southwest'))), /Expired/.test(blockText(program(s, 'southwest'))), /\bSilver\b/.test(blockText(program(s, 'southwest')))], [true, true, false]);
check('Jan 1: …and isn’t held', api.hasStatus(program(s, 'southwest')), false);

// Keeping a level: the new thresholds, under the new names.
s = tracker(['southwest'], { southwest: [{ tier: 'A-List Preferred', via: 'earned in 2026', exp: '2027-12-31' }] },
  { progress: { southwest: 5000 }, updated: { 'prog:southwest': '2027-01-01' } });
let info = api.progressInfo(program(s, 'southwest'));
check('Jan 1: a 2026 A-List Preferred is kept on the new bar', api.nextText(info.next, info.track), '60,000 to keep Gold');

/* ---------- Coming up, reminders and the calendar ---------- */

setNow(2027, 11, 1);
s = saved();
const items = api.upcomingItems();
check('Coming up: the renamed level, by its new name', items.filter((i) => i.kind === 'status').map(api.comingUpLine), ['- Gold (Southwest Rapid Rewards) expires Dec 31, 2027, in 60 days']);
const ics = api.buildICS(items.filter((i) => i.kind === 'status')).replace(/\r\n /g, ''); // long lines unfolded
check('Calendar: the new name and the new requirement', [/SUMMARY:.*Gold/.test(ics), /A-List/.test(ics.replace(/UID:.*/g, '')), /65\\,000 tier points/.test(ics)], [true, false, true]);
const uidAfter = /UID:(.*)/.exec(ics)[1].trim();
setNow(2026, 11, 1);
s = saved();
const before = api.upcomingItems({ future: true }).filter((i) => i.kind === 'status');
const uidBefore = /UID:(.*)/.exec(api.buildICS(before))[1].trim();
check('Calendar: the same reminder keeps its id over the rename, so re-adding it doesn’t double it', uidAfter, uidBefore);

/* ---------- A count from 2026 is judged by 2026's rules ---------- */

const rollFrom2026 = (id, count, alt) => {
  setNow(2026, 12, 31, 18);
  const fields = { progress: { [id]: count, ...(alt != null ? { [`${id}+alt`]: alt } : {}) }, updated: { [`prog:${id}`]: '2026-12-31', ...(alt != null ? { [`prog:${id}+alt`]: '2026-12-31' } : {}) } };
  const t = tracker([id], {}, fields);
  const onTheDay = api.earnedTier(program(t, id));
  firstMinute();
  const stillOld = api.earnedTier(program(t, id));
  api.rollOver();
  return { t, onTheDay: onTheDay && onTheDay.tier.name, stillOld: stillOld && stillOld.tier.name, kept: statuses(program(t, id)) };
};
let r = rollFrom2026('united', 28000);
check('United, Dec 31: 28,000 PQP is 1K', r.onTheDay, 'Premier 1K');
check('United, Jan 1: 2026’s 28,000 PQP still earned 1K', [r.stillOld, r.kept], ['Premier 1K', [['Premier 1K', 'earned in 2026', '2028-01-31']]]);
check('United, Jan 1: …and the count starts over', [r.t.progress.united, r.t.updated['prog:united']], [undefined, undefined]);
r = rollFrom2026('united', 22000, 60);
check('United, Jan 1: 2026’s 60 flights + 22,000 PQP still earned 1K', r.kept, [['Premier 1K', 'earned in 2026', '2028-01-31']]);
check('United, Jan 1: …and the flights count is cleared with it', r.t.progress['united+alt'], undefined);
r = rollFrom2026('southwest', 70000);
check('Southwest, Dec 31: 70,000 tier points is A-List Preferred', r.onTheDay, 'A-List Preferred');
check('Southwest, Jan 1: kept through the end of 2027 under its new name', r.kept, [['Gold', 'earned in 2026', '2027-12-31']]);
r = rollFrom2026('southwest', 1000, 40);
check('Southwest, Jan 1: 2026’s 40 flights still earned the level that became Gold', r.kept, [['Gold', 'earned in 2026', '2027-12-31']]);
r = rollFrom2026('southwest', 1000, 20);
check('Southwest, Jan 1: 2026’s 20 flights still earned the level that became Silver', r.kept, [['Silver', 'earned in 2026', '2027-12-31']]);
check('Southwest, Jan 1: the note says so', api.shown.notes.at(-1), 'New qualifying year: Southwest Rapid Rewards Silver stays on your list until it ends');

/* ---------- Counts in 2027 follow the new rules ---------- */

setNow(2027, 2, 1);
s = tracker(['united'], {}, { progress: { united: 28000 }, updated: { 'prog:united': '2027-01-20' } });
info = api.progressInfo(program(s, 'united'));
check('United 2027: 28,000 PQP is Platinum, 4,000 from 1K', [api.earnedTier(program(s, 'united')).tier.name, api.nextText(info.next, info.track)], ['Premier Platinum', '4,000 to 1K']);
check('United 2027: …with one count on the row', api.textOf(api.statusBlock(program(s, 'united'))).includes('flights'), false);
check('United 2027: earned in 2027, lasting through Jan 31, 2029', api.earnedTier(program(s, 'united')).via, 'earned in 2027 · thru 1/31/29');
s = tracker(['united'], {}, { progress: { united: 32000 }, updated: { 'prog:united': '2027-01-20' } });
check('United 2027: 32,000 PQP is 1K', api.earnedTier(program(s, 'united')).tier.name, 'Premier 1K');
// A flights count left in saved data (a backup from 2026, restored) earns nothing now, and stays saved.
s = tracker(['united'], {}, { progress: { united: 10000, 'united+alt': 90 }, updated: { 'prog:united': '2027-01-20' } });
check('United 2027: a leftover flights count earns nothing', api.earnedTier(program(s, 'united')).tier.name, 'Premier Silver');
s = tracker(['southwest'], {}, { progress: { southwest: 66000 }, updated: { 'prog:southwest': '2027-01-20' } });
check('Southwest 2027: 66,000 tier points is Gold', api.earnedTier(program(s, 'southwest')).tier.name, 'Gold');
check('Southwest 2027: …lasting through the end of 2028', api.earnedTier(program(s, 'southwest')).via, 'earned in 2027 · thru 12/31/28');
s = tracker(['southwest'], {}, { progress: { southwest: 1000, 'southwest+alt': 100 }, updated: { 'prog:southwest': '2027-01-20', 'prog:southwest+alt': '2027-01-20' } });
check('Southwest 2027: 100 flights is Platinum', api.earnedTier(program(s, 'southwest')).tier.name, 'Platinum');
s = tracker(['southwest'], {}, { progress: { southwest: 139000 }, updated: { 'prog:southwest': '2027-01-20' } });
info = api.progressInfo(program(s, 'southwest'));
check('Southwest 2027: next stop Platinum', api.nextText(info.next, info.track), '1,000 to Platinum');
// A date after today (a clock set back, a backup from a device set ahead) mustn't index past the old list of levels.
setNow(2026, 12, 1);
s = tracker(['southwest'], {}, { progress: { southwest: 150000 }, updated: { 'prog:southwest': '2027-03-01' } });
check('A count dated in 2027 read on a clock set back: the rules of today, no crash', api.earnedTier(program(s, 'southwest')).tier.name, 'A-List Preferred');

/* ---------- The screenshot reader ---------- */

const read = (text) => {
  const f = api.parseAccountText(text);
  return { program: f.programId, level: f.tierIndex >= 0 ? api.scanTiersFor(f.programId)[f.tierIndex].name : null };
};
const page = (level) => `Rapid Rewards\n${level}\nAvailable points 45,980\nTier qualifying points 40,100`;
lastMinute();
check('Reader, Dec 31: "A-List"', read(page('A-List')), { program: 'southwest', level: 'A-List' });
check('Reader, Dec 31: "A-List Preferred"', read(page('A-List Preferred')), { program: 'southwest', level: 'A-List Preferred' });
check('Reader, Dec 31: "Silver" isn’t a Southwest level yet', read(page('Silver')), { program: 'southwest', level: null });
check('Reader, Dec 31: "Platinum" isn’t a Southwest level yet', read(page('Platinum')), { program: 'southwest', level: null });
check('Reader, Dec 31: United’s flights are read', api.parseAccountText('MileagePlus\nPremier Gold\nPQP 9,820\nPQF 24').altProgress, 24);
firstMinute();
check('Reader, Jan 1: "Silver"', read(page('Silver')), { program: 'southwest', level: 'Silver' });
check('Reader, Jan 1: "Gold"', read(page('Gold')), { program: 'southwest', level: 'Gold' });
check('Reader, Jan 1: "Platinum"', read(page('Platinum')), { program: 'southwest', level: 'Platinum' });
check('Reader, Jan 1: "Platinum Member"', read(page('Platinum Member')), { program: 'southwest', level: 'Platinum' });
check('Reader, Jan 1: an old "A-List" page', read(page('A-List')), { program: 'southwest', level: 'Silver' });
check('Reader, Jan 1: an old "A-List Preferred" page', read(page('A-List Preferred')), { program: 'southwest', level: 'Gold' });
check('Reader, Jan 1: "A-List" alone still names the program', read('A-List\n45,980 points'), { program: 'southwest', level: 'Silver' });
check('Reader, Jan 1: a ladder isn’t a level', read('Rapid Rewards\nSilver Gold Platinum\nAvailable points 45,980'), { program: 'southwest', level: null });
check('Reader, Jan 1: what’s left to a level isn’t the level', read('Rapid Rewards\n10,000 tier qualifying points from Gold\nAvailable points 45,980'), { program: 'southwest', level: null });
check('Reader, Jan 1: another program’s page is still that program’s', read('Hilton Honors\nGold\n45,980 points'), { program: 'hilton', level: 'Gold' });
check('Reader, Jan 1: a Companion Pass section ends at "Gold progress"', api.parseAccountText('Rapid Rewards\nGold\nPoints\n45,980\nCompanion Pass progress\nQualifying points\n98,000 of 135,000\nGold progress\nTier qualifying points\n22,400').progress, 22400);
check('Reader, Jan 1: United’s flights aren’t read as a count', api.parseAccountText('MileagePlus\nPremier Gold\nPQP 9,820\nPQF 24').altProgress, null);
check('Reader, Jan 1: …nor as the balance', api.parseAccountText('MileagePlus\nPremier Gold\n84,250 miles\nPQP 9,820\nPQF 24').balances[0], 84250);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
check('Reader, Jan 1: a "Silver" page confirms a saved A-List', api.statusOutcome(program(s, 'southwest'), 0, '2027-12-31').kind, 'same');
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
check('Reader, Jan 1: a "Gold" page is a change from a saved A-List', api.statusOutcome(program(s, 'southwest'), 1, '2027-12-31').kind, 'new');
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
let applied = api.applyRead('southwest', { tierIndex: 0, exp: '2028-12-31' });
check('Reader, Jan 1: a "Silver" page updates a saved A-List in place, and says Silver', [applied.notes, statuses(program(s, 'southwest'))], [['Silver through 12/31/28'], [['A-List', 'from your account', '2028-12-31']]]);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
applied = api.applyRead('southwest', { tierIndex: 2, exp: '2028-12-31' });
check('Reader, Jan 1: a "Platinum" page replaces what an earlier screen showed', [applied.notes, statuses(program(s, 'southwest'))], [['Platinum'], [['Platinum', 'from your account', '2028-12-31']]]);
check('…and Platinum is what shows', [/\bPlatinum\b/.test(blockText(program(s, 'southwest'))), api.topTier(program(s, 'southwest')).name], [true, 'Platinum']);

// Every screen the reader is tested on for these two programs reads the same in 2027: the same numbers, the old
// names understood under the new ones, and United's flights left out.
const renamed = { 'A-List': 'Silver', 'A-List Preferred': 'Gold' };
const mine = cases.filter((c) => c.text && c.expect && ['southwest', 'united'].includes(c.expect.program));
const after = (expect, key) => (key === 'tier' ? renamed[expect.tier] ?? expect.tier : key === 'alt' && expect.program === 'united' ? null : expect[key]);
const gotOf = (c) => {
  const f = api.parseAccountText(c.text);
  return { program: f.programId, balance: f.balances[0] ?? null, tier: f.tierIndex >= 0 ? api.scanTiersFor(f.programId)[f.tierIndex].name : null, exp: f.exp, progress: f.progress, alt: f.altProgress, mqd: f.mqd, member: f.member };
};
const wrong = mine.flatMap((c) => {
  const got = gotOf(c);
  return Object.keys(c.expect).filter((k) => k in got && (got[k] ?? null) !== after(c.expect, k)).map((k) => `${c.name}: ${k} ${JSON.stringify(got[k])}`);
});
check(`Reader, Jan 1: the ${mine.length} United and Southwest screens read the same`, wrong, []);

/* ---------- Backups ---------- */

setNow(2026, 12, 20);
s = tracker(['southwest', 'united'], {
  southwest: [{ tier: 'A-List Preferred', via: 'earned in 2026', exp: '2027-12-31' }, { tier: 'A-List', via: 'typed' }],
  united: [{ tier: 'Premier Gold', via: 'earned in 2025', exp: '2027-01-31' }],
}, { progress: { united: 9000, 'united+alt': 20, southwest: 4000 }, updated: { 'prog:united': '2026-12-20', 'prog:united+alt': '2026-12-20', 'prog:southwest': '2026-12-20' } });
const backup = JSON.stringify(s);
check('Backup, December: what’s saved round-trips unchanged', JSON.stringify(api.normalize(JSON.parse(backup))), JSON.stringify(api.normalize(JSON.parse(JSON.stringify(api.normalize(JSON.parse(backup)))))));
firstMinute();
s = api.normalize(JSON.parse(backup));
api.setState(s);
check('Backup made in December, restored in January: the saved names are still there', statuses(program(s, 'southwest')).map((l) => l[0]), ['A-List Preferred', 'A-List']);
check('…they show under the new ones', [/\bGold\b/.test(blockText(program(s, 'southwest'))), /A-List/.test(blockText(program(s, 'southwest')))], [true, false]);
check('…2026’s counts are still there before the new year rolls in', [s.progress.united, s.progress['united+alt'], s.progress.southwest], [9000, 20, 4000]);
api.rollOver();
check('…the new year then keeps what they earned, under 2026’s rules', statuses(program(s, 'united')), [['Premier Silver', 'earned in 2026', '2028-01-31'], ['Premier Gold', 'earned in 2025', '2027-01-31']]);
const again = api.normalize(JSON.parse(JSON.stringify(s)));
check('Backup made in January, restored in January: nothing changes', JSON.stringify(again.programs), JSON.stringify(s.programs));
check('…and a level above Dec 31’s (Platinum) survives normalize', api.normalize({ programs: [{ id: 'southwest', name: 'Southwest Rapid Rewards', unit: 'points', status: [{ tier: 'Platinum', via: 'from your account', exp: '2028-12-31' }] }] }).programs[0].status[0].tier, 'Platinum');

/* ---------- A page left open over midnight ---------- */

setNow(2026, 12, 31, 23, 59, 50);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'earned in 2025', exp: '2027-12-31' }] });
api.renderToday();
check('Left open, before midnight: the date at the top of the page', api.els['#today'].textContent, 'Thursday, December 31, 2026');
api.shown.draws.length = 0;
context.timers.length = 0;
vm.runInContext(`(function atMidnight() {
  const now = new Date();
  setTimeout(() => { refreshDay(); atMidnight(); }, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5) - now);
})();`, context);
check('Left open: the timer is set for just after midnight', context.timers[0].ms, 15000);
now += context.timers[0].ms;
context.timers[0].fn();
const [drawn] = api.shown.draws;
check('Left open, 00:00:05: the page is drawn again', api.shown.draws.length, 1);
check('…with the new level name', [drawn.level, /\bSilver\b/.test(drawn.block), /A-List/.test(drawn.block)], ['Silver', true, false]);
check('…and the new note', /A-List is now Silver/.test(drawn.note), true);
check('…and the timer is set again for the next midnight', context.timers.length, 2);
check('…and the date at the top of the page is the new day', api.els['#today'].textContent, 'Friday, January 1, 2027');
// Any new day, not only this one: back on the page later, then a return with no new day.
setNow(2027, 3, 9, 8);
api.refreshDay();
check('Back on the page on a later day: the date at the top moves too', api.els['#today'].textContent, 'Tuesday, March 9, 2027');
api.shown.draws.length = 0;
api.els['#today'].textContent = '';
api.refreshDay();
check('Back on the page the same day: the date is still drawn, the page isn’t', [api.els['#today'].textContent, api.shown.draws.length], ['Tuesday, March 9, 2027', 0]);

/* ---------- Renewing a level across the rename ---------- */

// A level held through Dec 31 and earned again in 2026: one row under the new name, as on any other New Year.
const renewed = (old, count) => {
  setNow(2027, 1, 1, 9);
  const t = tracker(['southwest'], { southwest: [{ tier: old, via: 'earned in 2025', exp: '2026-12-31' }] }, { progress: { southwest: count }, updated: { 'prog:southwest': '2026-12-20' } });
  api.rollOver();
  return t;
};
const groupsOf = (x) => api.mergedLines(x.status, x).map((g) => [g.tier, g.via, g.exp]);
const sheetText = (x) => { api.renderDetailStatusNow(x); return api.textOf(api.els['#d-status']); };
s = renewed('A-List Preferred', 72000);
let row = program(s, 'southwest');
check('Renewed A-List Preferred, Jan 1: what’s saved', statuses(row), [['Gold', 'earned in 2026', '2027-12-31'], ['A-List Preferred', 'earned in 2025', '2026-12-31']]);
check('…one row, lasting through 2027', groupsOf(row), [['Gold', 'earned in 2026 · earned in 2025', '2027-12-31']]);
check('…not expired, and no old name beside the new one', [/Expired/.test(blockText(row)), /A-List/.test(blockText(row))], [false, false]);
check('…one block on the detail sheet', [/Expired/.test(sheetText(row)), /A-List Preferred earned/.test(sheetText(row)), sheetText(row).split('Normally requires').length - 1], [false, false, 1]);
check('…and one line in the text summary', [/EXPIRED/.test(api.summaryText()), /A-List Preferred \(/.test(api.summaryText()), /\bGold \(earned in 2026 · earned in 2025\)/.test(api.summaryText())], [false, false, true]);
setNow(2027, 7, 1);
check('…still one row on Jul 1, 2027', [groupsOf(row).length, /Expired/.test(blockText(row))], [1, false]);
s = renewed('A-List', 40000);
row = program(s, 'southwest');
check('Renewed A-List, Jan 1: one row as Silver', groupsOf(row), [['Silver', 'earned in 2026 · earned in 2025', '2027-12-31']]);
// Saved under the old name twice: from a backup, or typed in by hand.
setNow(2027, 1, 1, 9);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'typed', exp: '2026-12-31' }, { tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
check('The old name twice, one ending after the switch: one row', groupsOf(program(s, 'southwest')), [['Silver', 'typed · from your account', '2027-12-31']]);
// A different level is a different row, as on any New Year.
s = tracker(['southwest'], { southwest: [{ tier: 'Gold', via: 'earned in 2026', exp: '2027-12-31' }, { tier: 'A-List', via: 'earned in 2025', exp: '2026-12-31' }] });
check('Moved up from A-List: the old level is its own expired row', [groupsOf(program(s, 'southwest')).map((g) => g[0]), /Expired/.test(blockText(program(s, 'southwest')))], [['Gold', 'A-List'], true]);
setNow(2026, 12, 31, 18);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List Preferred', via: 'earned in 2025', exp: '2026-12-31' }] }, { progress: { southwest: 72000 }, updated: { 'prog:southwest': '2026-12-20' } });
check('Dec 31: nothing changes until the switch', [groupsOf(program(s, 'southwest')).map((g) => g[0]), /Expired/.test(blockText(program(s, 'southwest')))], [['A-List Preferred'], false]);

/* ---------- A level that ended before the switch keeps its own name and terms ---------- */

setNow(2027, 1, 1, 9);
const lapsed = (tier) => sheetText(program(tracker(['southwest'], { southwest: [{ tier, via: 'earned in 2025', exp: '2026-12-31' }] }), 'southwest'));
let block = lapsed('A-List');
check('Ended A-List: its own perks, not Silver’s', [/25% bonus/.test(block), /40% bonus/.test(block), /the second is \$35/.test(block)], [true, false, false]);
check('…and its own requirement', [/20 flights or 35,000/.test(block), /25 flights or 35,000/.test(block)], [true, false]);
check('…and it reads as expired', /Expired Dec 31, 2026/.test(block), true);
block = lapsed('A-List Preferred');
check('Ended A-List Preferred: its own perks, not Gold’s', [/Double points on flights/.test(block), /60% bonus/.test(block)], [true, false]);
check('…and its own requirement', [/40 flights or 70,000/.test(block), /50 flights or 65,000/.test(block)], [true, false]);
s = renewed('A-List Preferred', 72000);
block = sheetText(program(s, 'southwest'));
check('A renewed level: the new level’s perks and requirement', [/60% bonus/.test(block), /50 flights or 65,000/.test(block)], [true, true]);
// A "Silver" that ended in 2026 can only be one you typed: the name it has on today's list still finds its perks.
check('A typed Silver that ended in 2026 still finds perks', /40% bonus/.test(lapsed('Silver')), true);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
block = sheetText(program(s, 'southwest'));
check('A saved A-List lasting past the switch: Silver’s perks', [/40% bonus/.test(block), /25% bonus/.test(block)], [true, false]);

// Made after the switch: rolled over from a count two years old, or read off an old page.
setNow(2027, 1, 3);
s = tracker(['southwest'], {}, { progress: { southwest: 40000 }, updated: { 'prog:southwest': '2025-10-01' } });
api.rollOver();
check('A 2025 count rolled over in 2027: saved under the name it had', statuses(program(s, 'southwest')), [['A-List', 'earned in 2025', '2026-12-31']]);
check('…so that’s what the row says', [/A-List/.test(blockText(program(s, 'southwest'))), /\bSilver\b/.test(blockText(program(s, 'southwest')))], [true, false]);
check('…and the note', api.shown.notes.at(-1), 'New qualifying year: Southwest Rapid Rewards A-List stays on your list until it ends');
s = tracker(['southwest'], {}, { progress: { southwest: 70000 }, updated: { 'prog:southwest': '2025-10-01' } });
api.rollOver();
check('A 2025 count of 70,000: A-List Preferred', statuses(program(s, 'southwest')), [['A-List Preferred', 'earned in 2025', '2026-12-31']]);
s = tracker(['southwest'], {}, { progress: { southwest: 40000 }, updated: { 'prog:southwest': '2026-10-01' } });
api.rollOver();
check('A 2026 count: the new name, lasting past the switch', statuses(program(s, 'southwest')), [['Silver', 'earned in 2026', '2027-12-31']]);

firstMinute();
const oldPage = api.parseAccountText('Rapid Rewards\nA-List through 12/31/2026\nAvailable points 45,980');
check('Reader, Jan 1: a page ending Dec 31 reads as that level, with its end date', [oldPage.tierIndex, oldPage.exp], [0, '2026-12-31']);
s = tracker(['southwest']);
applied = api.applyRead('southwest', { tierIndex: 0, exp: '2026-12-31' });
check('Read, ended before the switch: saved as A-List', [applied.notes, statuses(program(s, 'southwest'))], [['A-List'], [['A-List', 'from your account', '2026-12-31']]]);
check('…and the row says so', [/A-List/.test(blockText(program(s, 'southwest'))), /Expired/.test(blockText(program(s, 'southwest'))), /\bSilver\b/.test(blockText(program(s, 'southwest')))], [true, true, false]);
s = tracker(['southwest']);
check('…and so does the card', api.textOf(api.lootRows(program(s, 'southwest'), program(s, 'southwest'), { tierIndex: 0, exp: '2026-12-31' }, { kind: 'new' })).includes('A-List'), true);
s = tracker(['southwest']);
api.applyRead('southwest', { tierIndex: 1, exp: '2026-12-31' });
check('Read, A-List Preferred ended: saved under that name', statuses(program(s, 'southwest')), [['A-List Preferred', 'from your account', '2026-12-31']]);
s = tracker(['southwest']);
applied = api.applyRead('southwest', { tierIndex: 0, exp: '2027-12-31' });
check('Read, lasting past the switch: Silver', [applied.notes, statuses(program(s, 'southwest'))], [['Silver'], [['Silver', 'from your account', '2027-12-31']]]);
s = tracker(['southwest']);
api.applyRead('southwest', { tierIndex: 0, exp: '' });
check('Read, no end date: Silver', statuses(program(s, 'southwest')), [['Silver', 'from your account', '']]);
s = tracker(['southwest']);
api.applyRead('southwest', { tierIndex: 2, exp: '2026-12-31' });
check('Read, a level that had no old name: as it is', statuses(program(s, 'southwest')), [['Platinum', 'from your account', '2026-12-31']]);
s = tracker(['southwest'], { southwest: [{ tier: 'A-List', via: 'from your account', exp: '2027-12-31' }] });
applied = api.applyRead('southwest', { tierIndex: 0, exp: '2026-12-31' });
check('Read, an old page moving a saved A-List’s end back: the note says A-List', [applied.notes, statuses(program(s, 'southwest'))], [['A-List through 12/31/26'], [['A-List', 'from your account', '2026-12-31']]]);

/* ---------- A surname isn't a level ---------- */

const namePage = (line, name = 'Rapid Rewards') => `${name}\n${line}\nAvailable points 45,980`;
for (const clock of [lastMinute, firstMinute]) {
  clock();
  const when = clock === lastMinute ? 'Dec 31' : 'Jan 1';
  check(`Surname, ${when}: "Hi, Pat Gold" isn’t a level`, read(namePage('Hi, Pat Gold')).level, null);
  check(`Surname, ${when}: "PAT GOLD" on its own line isn’t a level`, read(namePage('PAT GOLD')).level, null);
  check(`Surname, ${when}: "Hello Sam Silver," isn’t a level`, read(namePage('Hello Sam Silver,')).level, null);
  check(`Surname, ${when}: "Good morning, Pat Lee Platinum" isn’t a level`, read(namePage('Good morning, Pat Lee Platinum')).level, null);
  check(`Surname, ${when}: nor at Hilton`, read(namePage('Hi, Pat Gold', 'Hilton Honors')).level, null);
  check(`Surname, ${when}: nor at American`, read(namePage('Hi, Pat Gold', 'AAdvantage')).level, null);
  check(`Surname, ${when}: at Hilton, the level under it is read`, read(namePage('Hi, Pat Gold\nDiamond', 'Hilton Honors')).level, 'Diamond');
  check(`Surname, ${when}: the name is still read`, api.parseAccountText(namePage('Hi, Pat Gold', 'Hilton Honors')).name, 'Pat');
}
firstMinute();
check('Surname, Jan 1: the level under it is read', read(namePage('Hi, Pat Gold\nSilver')).level, 'Silver');
for (const line of ['Gold', 'GOLD', 'Gold Member', 'Status: Gold', 'Status Gold', 'Tier Gold', 'Elite Gold', 'Your Gold', 'Rapid Rewards Gold', 'Southwest Gold', 'Welcome Gold Member', 'Hi Gold Member', 'Hi Pat Gold Member', 'Hi Gold']) {
  check(`Still a level, Jan 1: "${line}"`, read(namePage(line)).level, 'Gold');
}
check('Still a level: "Hilton Gold"', read(namePage('Hilton Gold', 'Hilton Honors')).level, 'Gold');
check('Still a level: "Honors Diamond"', read(namePage('Honors Diamond', 'Hilton Honors')).level, 'Diamond');
check('Still a level: "Gold Medallion"', read('SkyMiles\nGold Medallion\n84,250 miles').level, 'Gold Medallion');
check('Still a level: "Premier Gold" at United', read('MileagePlus\nPremier Gold\n84,250 miles').level, 'Premier Gold');
check('Still a level: "Hi Jordan Platinum Elite"', read('IHG One Rewards\nHi Jordan Platinum Elite\n26,948 points').level, 'Platinum Elite');

/* ---------- The rest of what names a level ---------- */

firstMinute();
// A screen read at 23:59 with a flights count, its card drawn at 00:00: no flights row, and no crash.
s = tracker(['united']);
check('A United reading from before midnight, drawn after it: its flights are left off', api.lootRows(program(s, 'united'), program(s, 'united'), { progress: 9000, alt: 12 }, null).filter((row) => /flights/.test(api.textOf(row))).length, 0);
s = tracker(['southwest']);
check('Official line, Jan 1: says these are the rules as announced', /announced/i.test(api.textOf(api.officialLine(program(s, 'southwest')))), true);
lastMinute();
check('Official line, Dec 31: as before', /^Checked against the program’s official page on Oct 7, 2026/.test(api.textOf(api.officialLine(program(tracker(['southwest']), 'southwest')))), true);
check('Example setup, Dec 31: as before', /Southwest A-List\.$/.test(api.exampleSetup().notes), true);
firstMinute();
check('Example setup, Jan 1: the new name', /Southwest Silver\.$/.test(api.exampleSetup().notes), true);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
