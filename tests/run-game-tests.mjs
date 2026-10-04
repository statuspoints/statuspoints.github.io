// Checks the screenshot game's math (from index.html): levels, XP, combos, weekly streaks, and up-to-date balances.
// Usage: node tests/run-game-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const slice = (from, to) => js.slice(js.indexOf(from), js.indexOf(to));
const gameCode = slice('  const game = () =>', '  const GAME_ICONS');
const dates = slice('  function parseISODate', '  // Soonest expiration first');

const context = vm.createContext({ Date, Math, Number, String, Object, Array, Set });
vm.runInContext(`let state = { programs: [], balances: {}, updated: {}, game: { xp: 0, scans: 0, best: 0, weeks: [], badges: {} } };
  ${dates}
  const isoOf = (d) => \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
  const todayISO = () => isoOf(new Date());
  const hasStatus = () => false;
  const categoryOf = () => 'Airlines';
  ${gameCode}
  globalThis.api = { levelOf, xpFor, comboBonus, weekNo, markWeek, streakWeeks, freshness, award, BADGES,
    setState: (s) => { state = s; }, getState: () => state, setLastCollect: (t, c) => { lastCollectAt = t; combo = c; }, comboNext };`, context);
const { api } = context;

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};
const fresh = () => ({ programs: [], balances: {}, updated: {}, game: { xp: 0, scans: 0, best: 0, weeks: [], badges: {} } });

// Levels
check('0 XP is level 1, Rookie', [api.levelOf(0).n, api.levelOf(0).name], [1, 'Rookie']);
check('60 XP reaches Explorer', api.levelOf(60).name, 'Explorer');
check('59 XP is still Rookie, almost there', [api.levelOf(59).name, Math.round(api.levelOf(59).progress * 100)], ['Rookie', 98]);
check('3,200 XP is Legend, the top', [api.levelOf(3200).name, api.levelOf(3200).next, api.levelOf(9999).progress], ['Legend', null, 1]);

// XP and combos
check('a plain scan with 2 updates', api.xpFor(2, false, false), 20);
check('a new program with a new status', api.xpFor(3, true, true), 90);
check('combo bonuses: none, +10, +20, capped at +50', [1, 2, 3, 6, 9].map(api.comboBonus), [0, 10, 20, 50, 50]);
api.setLastCollect(Date.now() - 30_000, 2);
check('a collect 30 s after a ×2 makes ×3', api.comboNext(), 3);
api.setLastCollect(Date.now() - 5 * 60_000, 4);
check('5 minutes later the combo starts over', api.comboNext(), 1);

// Weeks start Monday
check('Sun Oct 4 and Mon Oct 5, 2026 are different weeks', api.weekNo(new Date(2026, 9, 5)) - api.weekNo(new Date(2026, 9, 4)), 1);
check('Mon Oct 5 to Sun Oct 11, 2026 is one week', api.weekNo(new Date(2026, 9, 11)) - api.weekNo(new Date(2026, 9, 5)), 0);

// Streaks
const w = api.weekNo();
const streakWith = (weeks) => { const s = fresh(); s.game.weeks = weeks; api.setState(s); return api.streakWeeks(); };
check('updates this week and the 2 before: 3', streakWith([w - 2, w - 1, w]), 3);
check('nothing yet this week still counts the last 3', streakWith([w - 3, w - 2, w - 1]), 3);
check('a missed week breaks it', streakWith([w - 3, w - 1, w]), 2);
check('two weeks ago only: no streak', streakWith([w - 2]), 0);
api.setState(fresh());
api.markWeek();
api.markWeek();
check('marking twice in a week counts once', api.getState().game.weeks.length, 1);

// Up to date
const s = fresh();
const today = new Date();
const daysAgo = (n) => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
s.programs = [{ id: 'a', unit: 'miles' }, { id: 'b', unit: 'points' }, { id: 'c', unit: 'points' }, { id: 'car', unit: '' }];
s.updated = { a: daysAgo(3), b: daysAgo(45) };
api.setState(s);
const f = api.freshness();
check('3 programs with balances, 1 updated this month', [f.fresh, f.total, f.stale.map((p) => p.id)], [1, 3, ['b', 'c']]);

// Award
const a = fresh();
a.programs = [{ id: 'x', unit: 'points' }];
a.balances = { x: 150000 };
api.setState(a);
api.setLastCollect(0, 0);
const r = api.award({ changes: ['balance'], added: false, statusNew: false });
check('first collect: 15 XP + First scan + Six figures badges', [r.xp, r.unlocked.map((b) => b.id).sort()], [115, ['first', 'six']]);
check('saved: 1 scan, 115 XP, this week marked', [api.getState().game.scans, api.getState().game.xp, api.getState().game.weeks.includes(w)], [1, 115, true]);
const r2 = api.award({ changes: ['balance'], added: false, statusNew: false });
check('second collect right after: combo ×2, no repeat badges', [r2.combo, r2.xp, r2.unlocked.length], [2, 25, 0]);

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
