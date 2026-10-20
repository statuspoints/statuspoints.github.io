// Runs every bug-fix check (tests/run-fixes-*-tests.mjs: cards, Delta, progress, people, Undo, money, calendar, review sheet) in
// one go. Each area keeps its own file, since each builds its own small fake app around different pieces of
// index.html; this runs them one after another and adds up the results.
// Usage: node tests/run-regression-tests.mjs  — exits non-zero if any check fails.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const dir = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(dir).filter((f) => /^run-fixes-.+-tests\.mjs$/.test(f)).sort();

let passed = 0;
let total = 0;
const broken = [];
for (const file of files) {
  const run = spawnSync(process.execPath, [`${dir}${file}`], { encoding: 'utf8' });
  const out = `${run.stdout}${run.stderr}`;
  // Each file ends with "n/m passed"; a file that stops early (a check that throws) has no such line.
  const tally = /(\d+)\/(\d+) passed\s*$/.exec(run.stdout);
  if (tally) {
    passed += Number(tally[1]);
    total += Number(tally[2]);
  }
  const ok = run.status === 0 && tally;
  if (!ok) broken.push(file);
  console.log(`${ok ? '✓' : '✗'} ${file}${tally ? ` — ${tally[1]}/${tally[2]}` : ' — stopped early'}`);
  if (!ok) console.log(out.split('\n').filter((line) => !line.startsWith('✓')).join('\n'));
}

console.log(`\n${passed}/${total} passed in ${files.length} files`);
if (broken.length || !files.length) process.exit(1);
