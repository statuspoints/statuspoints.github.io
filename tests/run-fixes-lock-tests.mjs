// The site password: lock codes made from a password, checked against it, and the page locked only when a code is set.
// Made-up passwords only.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let total = 0, failed = 0;
const check = (name, got, want) => { total++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`); };
const headLock = html.match(/<script>\/\* The site password: set SITE_LOCK[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
const lockScript = html.match(/<script id="lock-script">([\s\S]*?)<\/script>/)[1];
const page = (code, unlocked) => {
  const classes = new Set();
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, value: '', textContent: '', disabled: false, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, focus() { page.focused = id; }, select() {} });
  const store = new Map(unlocked ? [['status-tracker-unlocked', unlocked]] : []);
  const ctx = vm.createContext({ crypto: globalThis.crypto, TextEncoder, Uint8Array, String, atob, btoa, Promise,
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    document: { documentElement: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } }, getElementById: el } });
  vm.runInContext(headLock.replace('var SITE_LOCK = null;', `var SITE_LOCK = ${JSON.stringify(code)};`) + '\n' + lockScript, ctx);
  return { ctx, classes, el, store };
};
const p0 = page(null);
check('no code set: nothing locked', p0.classes.has('site-locked'), false);
const code = await vm.runInContext('siteLock.make("correct horse battery staple")', p0.ctx);
check('a code: "v1", a 16-byte salt and a 32-byte key', [code.split('.')[0], atob(code.split('.')[1]).length, atob(code.split('.')[2]).length], ['v1', 16, 32]);
check('…the password isn’t in it', code.includes('horse'), false);
check('…two codes from one password differ (their salts do)', code === await vm.runInContext('siteLock.make("correct horse battery staple")', p0.ctx), false);
check('the right password matches', await vm.runInContext(`siteLock.matches("correct horse battery staple", ${JSON.stringify(code)})`, p0.ctx), true);
check('a wrong one doesn’t', await vm.runInContext(`siteLock.matches("correct horse battery stapler", ${JSON.stringify(code)})`, p0.ctx), false);
check('nor anything against a damaged code', await vm.runInContext('siteLock.matches("x", "v1.abc")', p0.ctx), false);
const p1 = page(code);
check('a code set: locked, the box focused', [p1.classes.has('site-locked'), page.focused], [true, 'gate-pass']);
const submit = async (p, pass) => { p.el('gate-pass').value = pass; await p.el('site-gate').listeners.submit({ preventDefault() {} }); };
await submit(p1, 'wrong password here');
check('a wrong password: still locked, told so', [p1.classes.has('site-locked'), p1.el('gate-msg').textContent], [true, 'That isn’t the password.']);
await submit(p1, 'correct horse battery staple');
check('the right one: open, remembered for this visit, the box emptied', [p1.classes.has('site-locked'), p1.store.get('status-tracker-unlocked') === code, p1.el('gate-pass').value], [false, true, '']);
check('opened again in the same visit: not asked', page(code, code).classes.has('site-locked'), false);
check('a new code: asked again', page(code, 'v1.old.code').classes.has('site-locked'), true);
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
check('locked: everything but the box hidden', /html\.site-locked body > :not\(\.site-gate\) \{ display: none !important; \}/.test(style), true);
console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
