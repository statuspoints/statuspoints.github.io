// Checks Coming up, the calendar export and the backup nudge (from index.html): each person's calendar events stay
// their own, a Feb 29 renewal recurs every year, a "·" tier doesn't stop the export, the Add to calendar button
// shows only when there's something to add, a zero balance has no expiry reminder (nor a warning in the detail or a
// line in the text summary), the backup nudge notices every kind of change (marking a bonus earned too), and the text
// summary leaves perks out of expired statuses.
// Usage: node tests/run-fixes-calendar-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// The app's constants and helpers up to load(), plus named pieces from after it: a whole top-level function or
// const (its first line, the more-indented lines under it, and a closing "  }" / "  };").
const lines = js.split('\n');
const loadAt = lines.findIndex((l) => l.includes('const state = load();'));
const head = lines.slice(2, loadAt).join('\n');
const top = (name) => {
  const at = lines.findIndex((l) => new RegExp(`^  (?:async )?function ${name}\\(|^  (?:const|let) ${name} = `).test(l));
  if (at < 0) throw new Error(`not found in index.html: ${name}`);
  let end = at + 1;
  while (end < lines.length && (/^ {4}/.test(lines[end]) || (lines[end] === '' && /^ {4}/.test(lines[end + 1] || '')))) end++;
  if (/^ {2}[}\])]/.test(lines[end] || '')) end++;
  return lines.slice(at, end).join('\n');
};
const pieces = ['parseISODate', 'daysUntil', 'isoOf', 'todayISO', 'mergedLines', 'daysLeft', 'lineExpired', 'medallionProgram',
  'hasStatus', 'mqdYear', 'medallionThrough', 'effectiveMedallion', 'medallionFor', 'mqdNextText', 'relativeDay', 'bonuses',
  'bonusText', 'creditMoney', 'sortVouchers', 'slugify', 'statusItem', 'upcomingItems', 'renderUpcoming', 'updateBadge', 'icsText',
  'utf8Size', 'icsFold', 'uidPart', 'icsDate', 'buildICS', 'addAllToCalendar', 'nextRenewal', 'cardGrantsText',
  'dependsOn', 'comingUpLine', 'summaryText', 'fileTag', 'backupDue', 'renderBackupStatus', 'backUp', 'scheduleSave',
  'markChanged', 'pointsExpiry', 'expiryVerdict', 'bonusFilled', 'markBonusEarned'].filter((name) => lines.some((l) => new RegExp(`^  (?:async )?function ${name}\\(|^  (?:const|let) ${name} = `).test(l)));

// A small fake page: elements remember what's set on them, and $ finds them by selector.
const stubs = `
  const matchMedia = () => ({ matches: false, addEventListener() {} });
  const navigator = {}; const addEventListener = () => {};
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const fakeEl = (tag) => ({ tag, attrs: {}, kids: [], hidden: false, textContent: '', content: { firstChild: null },
    setAttribute(k, v) { this.attrs[k] = v; }, append(...k) { this.kids.push(...k); }, replaceChildren(...k) { this.kids = k; } });
  const els = {};
  const document = { querySelector: (sel) => els[sel] || (els[sel] = fakeEl(sel)), createElement: fakeEl };
`;
const context = vm.createContext({ console, Intl, Math, Date, Number, String, Object, Array, Set, Map, RegExp, JSON });
vm.runInContext(`${stubs}\n${head}
  let state = normalize({ programs: [] });
  const heldCredits = () => [];
  const shown = { toasts: [], saved: [], files: [] };
  const showToast = (message) => shown.toasts.push(message);
  const saveCalendar = (ics, name) => shown.saved.push({ ics, name });
  const saveFile = async (name, text) => { shown.files.push({ name, text }); return true; };
  const saveNow = () => {}; const renderStats = () => {};
  let saveTimer = 0;
  // Just enough of the game and the Cards sheet for marking a bonus earned.
  const game = () => state.game; const levelOf = () => ({ index: 0 }); const BADGE_XP = 50; const BADGES = [];
  let bonusEditing = null; const cardsSheet = { open: false };
  const renderAll = () => {}; const renderRenewals = () => {}; const focusBonus = () => {}; const queueAchievements = () => {};
  const setTimeout = () => 0; const clearTimeout = () => {};
  ${pieces.map(top).join('\n')}
  globalThis.api = { normalize, people, upcomingItems, renderUpcoming, buildICS, addAllToCalendar, nextRenewal, summaryText,
    backupDue, backUp, scheduleSave, expiryVerdict, markBonusEarned, els, shown, todayISO, isoOf, CATALOG_BY_ID, programFromCatalog,
    getState: () => state, setState: (s) => { state = s; } };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const attempt = (fn) => { try { return fn(); } catch (e) { return `threw ${e.message}`; } };

// Dates around today (the app counts days from the real clock).
const now = new Date();
const dayFrom = (days) => api.isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
const program = (id, extra = {}) => ({ ...api.programFromCatalog(api.CATALOG_BY_ID[id]), ...extra });
const uids = (ics) => [...ics.matchAll(/^UID:(.*)$/gm)].map((m) => m[1].trim());
const summaries = (ics) => [...ics.matchAll(/^SUMMARY:(.*)$/gm)].map((m) => m[1].trim());
const tracker = (fields) => api.normalize({ programs: [], ...fields });
const onePerson = () => { api.people.list = [{ id: 'me', name: '' }]; api.people.active = 'me'; };
const exportAll = () => { api.shown.saved.length = 0; api.shown.toasts.length = 0; api.addAllToCalendar(null); return api.shown.saved[0]; };

// Each person's calendar events are their own (two people with the same status, miles and card)
const shared = () => tracker({
  programs: [program('united', { status: [{ tier: 'Premier Gold', via: 'from your account', exp: dayFrom(40) }] })],
  activity: {}, cards: ['amex-platinum'], renewals: { 'amex-platinum': dayFrom(-300) },
});
onePerson();
api.setState(shared());
const alone = exportAll();
check('one person: ids as before, so events already added still update',
  uids(alone.ics), ['status-united-premier-gold@statuspoints.github.io', 'card-amex-platinum@statuspoints.github.io']);
check('one person: no name in the titles or the file name', [summaries(alone.ics)[0], alone.name],
  ['United MileagePlus Premier Gold expires', 'points-status-reminders.ics']);
api.people.list = [{ id: 'me', name: '' }, { id: 'alex', name: 'Alex' }];
api.people.active = 'me';
const mine = exportAll();
api.people.active = 'alex';
api.setState(shared());
const alexs = exportAll();
check('two people: the first keeps the ids it always had', uids(mine.ics),
  ['status-united-premier-gold@statuspoints.github.io', 'card-amex-platinum@statuspoints.github.io']);
check('two people: nobody’s event has the same id as someone else’s', uids(alexs.ics).filter((uid) => uids(mine.ics).includes(uid)), []);
check('two people: ids carry whose they are', uids(alexs.ics),
  ['alex-status-united-premier-gold@statuspoints.github.io', 'alex-card-amex-platinum@statuspoints.github.io']);
check('two people: titles say whose they are', [summaries(mine.ics)[0], summaries(alexs.ics)[0]],
  ['Me: United MileagePlus Premier Gold expires', 'Alex: United MileagePlus Premier Gold expires']);
check('two people: alerts say whose they are too', /DESCRIPTION:Alex: United MileagePlus Premier Gold expires in 30 days/.test(alexs.ics), true);
check('two people: file names say whose they are', [mine.name, alexs.name], ['me-points-status-reminders.ics', 'alex-points-status-reminders.ics']);
check('a single status’s calendar file is named for the person too',
  /buildICS\(\[statusItem\(p, group\)\]\), `\$\{fileTag\(\)\}/.test(js), true);
onePerson();

// A card renewing on Feb 29 comes back every year, on the last day of February
const renewing = (iso) => {
  api.setState(tracker({ cards: ['amex-platinum'], renewals: { 'amex-platinum': iso } }));
  const ics = api.buildICS(api.upcomingItems({ future: true }));
  return { rule: (ics.match(/^RRULE:.*$/m) || [''])[0].trim(), start: (ics.match(/^DTSTART;VALUE=DATE:(\d{8})/m) || [])[1] };
};
const leap = renewing('2024-02-29');
check('Feb 29: repeats on the last day of February every year', leap.rule, 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1');
check('Feb 29: starts on the last day of a February', /^\d{4}02(28|29)$/.test(leap.start)
  && new Date(Number(leap.start.slice(0, 4)), 2, 0).getDate() === Number(leap.start.slice(6)), true);
check('any other date: plain yearly', [renewing('2024-02-28').rule, renewing('2023-03-31').rule], ['RRULE:FREQ=YEARLY', 'RRULE:FREQ=YEARLY']);

// A status typed as just "·" doesn't stop the calendar export
api.setState(tracker({ programs: [program('hilton', { status: [{ tier: '·', via: '', exp: dayFrom(20) }] })] }));
const dots = attempt(() => api.buildICS(api.upcomingItems({ future: true })));
check('"·" as the level: the file is still made', typeof dots === 'string' && dots.startsWith('BEGIN:VCALENDAR'), true);
check('"·" as the level: titled by the program', typeof dots === 'string' && summaries(dots), ['Hilton Honors expires']);
api.setState(tracker({ programs: [program('hilton', { status: [{ tier: '·', via: '', exp: dayFrom(20) }] })], cards: ['amex-platinum'], renewals: { 'amex-platinum': dayFrom(-300) } }));
check('"·" as the level: Add all to calendar still saves a file', attempt(() => !!exportAll()), true);

// The Add to calendar button in Coming up shows only when there's something to add
const render = (fields) => {
  api.setState(tracker({ programs: [program('hilton')], ...fields }));
  api.renderUpcoming();
  return { list: api.els['#upcoming'].hidden, button: api.els['#up-cal'].hidden, header: api.els['#cal-btn'].hidden };
};
check('only a voucher that just expired: listed, but no Add to calendar',
  render({ vouchers: [{ name: 'Companion pass', note: '', exp: dayFrom(-5) }] }), { list: false, button: true, header: true });
check('a voucher still ahead: Add to calendar shows',
  render({ vouchers: [{ name: 'Companion pass', note: '', exp: dayFrom(10) }] }), { list: false, button: false, header: false });
check('nothing at all: Coming up hidden', render({}).list, true);

// No points-expiry reminder for a zero balance
const twoYearsAgo = (days) => api.isoOf(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate() + days));
const expiring = (balance) => {
  api.setState(tracker({ programs: [program('hilton')], balances: balance == null ? {} : { hilton: balance }, activity: { hilton: twoYearsAgo(30) } }));
  return api.upcomingItems().filter((i) => i.kind === 'points').length;
};
check('5,000 points expiring: a reminder', expiring(5000), 1);
check('no balance entered yet: still a reminder (you may have points)', expiring(null), 1);
check('a zero balance: nothing to expire, no reminder', expiring(0), 0);
check('a zero balance: no calendar event', api.upcomingItems({ future: true }).filter((i) => i.kind === 'points').length, 0);
const verdict = (balance) => { expiring(balance); const el = api.expiryVerdict(api.getState().programs[0]); return [el.className, el.kids.join('')]; };
check('5,000 points expiring: the detail warns', verdict(5000)[0], 'exp-text warn');
check('a zero balance: the detail says there’s nothing to expire', verdict(0), ['exp-text', 'Nothing to expire at a zero balance.']);
const expireLine = (balance) => { expiring(balance); return api.summaryText().split('\n').filter((l) => / without activity /.test(l)).length; };
check('5,000 points expiring: the text summary says when', expireLine(5000), 1);
check('a zero balance: no expiry line in the text summary', expireLine(0), 0);

// Backup nudge
const due = (fields) => { api.setState(tracker({ programs: [program('hilton')], ...fields })); return api.backupDue(); };
check('saves from before: entering data 30 days ago, every balance updated today, never backed up: nudge',
  due({ updated: { hilton: dayFrom(0) }, history: { hilton: [[dayFrom(-30), 100, 't'], [dayFrom(0), 200, 't']] } }), 'never');
check('first data entered 15 days ago, everything updated since: nudge', due({ since: dayFrom(-15), updated: { hilton: dayFrom(0) } }), 'never');
check('first data entered 15 days ago, only cards and vouchers (no balances): nudge', due({ since: dayFrom(-15), cards: ['amex-platinum'] }), 'never');
check('first data entered 13 days ago: not yet', due({ since: dayFrom(-13), updated: { hilton: dayFrom(-13) } }), null);
check('nothing entered: no nudge', due({}), null);
api.setState(tracker({ programs: [program('hilton')] }));
api.scheduleSave();
check('a first change records the day you started', [api.getState().since, api.getState().changed], [dayFrom(0), dayFrom(0)]);
api.getState().since = dayFrom(-30);
api.scheduleSave();
check('…and later changes don’t move it', api.getState().since, dayFrom(-30));

// Changes other than balances count as changes since the last backup
api.setState(tracker({ programs: [program('hilton')], backedUp: dayFrom(-70), updated: { hilton: dayFrom(-80) }, changed: '' }));
check('backed up 70 days ago, nothing changed since: no nudge', api.backupDue(), null);
api.getState().vouchers.push({ name: 'Free night', note: '', exp: dayFrom(200) });
api.scheduleSave();
check('…then a voucher added: nudge', api.backupDue(), 'stale');
api.setState(tracker({ programs: [program('hilton')], cards: ['amex-platinum'], backedUp: dayFrom(-70), updated: { hilton: dayFrom(-80) }, changed: '',
  bonuses: { 'amex-platinum': { points: 80000, program: 'amex', spend: 8000, spent: 8000, by: '', landed: '' } } }));
api.markBonusEarned('amex-platinum');
check('…or a welcome bonus marked earned: nudge', [api.getState().bonuses['amex-platinum'].landed, api.backupDue()], [dayFrom(0), 'stale']);

// Same-day edits after a backup
check('saves from before: backed up the day of the last balance change, 61 days ago: nudge (it may have come after)',
  due({ backedUp: dayFrom(-61), updated: { hilton: dayFrom(-61) } }), 'stale');
check('saves from before: last change the day before the backup: no nudge', due({ backedUp: dayFrom(-61), updated: { hilton: dayFrom(-62) } }), null);
api.setState(tracker({ programs: [program('hilton')], updated: { hilton: dayFrom(0) } }));
api.scheduleSave();
await api.backUp();
const file = JSON.parse(api.shown.files.pop().text);
check('the backup file has nothing changed since itself', [file.data.backedUp, file.data.changed], [dayFrom(0), '']);
check('backing up clears the change mark', [api.getState().backedUp, api.getState().changed], [dayFrom(0), '']);
api.getState().backedUp = dayFrom(-61); // as if that backup were 61 days old
check('a backup with nothing after it stays quiet', api.backupDue(), null);
api.getState().backedUp = dayFrom(0);
api.scheduleSave(); // an edit later the same day
api.getState().backedUp = dayFrom(-61);
check('an edit later the same day as the backup: nudge once it’s old', api.backupDue(), 'stale');

// Saved data
const kept = api.normalize(JSON.parse(JSON.stringify({ programs: [], since: '2026-01-05', changed: '2026-09-30', backedUp: '2026-08-01' })));
check('since and changed survive saving', [kept.since, kept.changed], ['2026-01-05', '2026-09-30']);
const junk = api.normalize({ programs: [], since: 'soon', changed: 42 });
check('junk values are dropped', [junk.since, junk.changed], ['', '']);
check('an old save still loads', !!api.normalize({ programs: [], updated: { a: '2026-01-01' }, backedUp: '2026-02-01' }), true);

// Text summary: no perks under an expired status
const summaryOf = (status) => {
  api.setState(tracker({ programs: [program('hilton', { status })] }));
  return api.summaryText().split('\n');
};
const after = (out, start) => { const i = out.findIndex((l) => l.startsWith(start)); return i < 0 ? null : out.slice(i + 1).filter((l, j, rest) => rest.slice(0, j + 1).every((x) => x.startsWith('      - '))); };
check('an expired status: no perks listed under it', after(summaryOf([{ tier: 'Diamond', via: 'Hilton Aspire', exp: dayFrom(-10) }]), '  Diamond (Hilton Aspire) — EXPIRED'), []);
check('a current status: perks listed', after(summaryOf([{ tier: 'Gold', via: 'from your account', exp: dayFrom(100) }]), '  Gold (from your account) — valid through').length > 0, true);
check('a status with no end date: perks listed', after(summaryOf([{ tier: 'Gold', via: 'Amex Platinum' }]), '  Gold (Amex Platinum)').length > 0, true);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
