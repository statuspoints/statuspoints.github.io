// Checks (from index.html's stylesheet) round 3's phone layout fixes: a program's sheet no longer scrolls sideways
// on a 320px phone; Credits card names stay on one line; a Done/Save that wraps stays on the right; the person
// switcher has room for a name; small buttons get a 44px touch area; the Credits date field doesn't zoom iPhone;
// "Coming up · 3" and the scan card's labels stay on one line; a long website name is cut short with its full name
// as a tooltip; larger text doesn't push headers, cards, the scan form, toasts or the footer off the screen; Type
// balances shows 8 digits on small phones and moves the field under the name with larger text; a phone held
// sideways keeps Done/Save on screen (but a short laptop window doesn't); the Site password sheet lines up with the
// others; tick boxes don't double-tap zoom; tapped buttons don't stay tinted; the inline balance editor fits;
// program links use the app's own color. Real-browser measurements are in the round 3 notes (WebKit, many sizes).
// Usage: node tests/run-fixes-layout-tests.mjs  — exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}index.html`, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const rawCss = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

let failed = 0;
let total = 0;
const check = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`}`);
};

/* ---------- A small stylesheet reader: rules with the @media they sit in ---------- */

const rules = [];
const parse = (text, media) => {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const inner = text.slice(open + 1, j - 1);
    if (prelude.startsWith('@media')) parse(inner, [...media, prelude.slice(6).trim()]);
    else if (prelude.startsWith('@')) { /* @keyframes, @supports...: not needed here */ }
    else {
      const decls = {};
      for (const d of inner.split(';')) { const k = d.indexOf(':'); if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).trim(); }
      rules.push({ selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), media, decls });
    }
    i = j;
  }
};
parse(css, []);

// The value a property gets for a selector: the last matching rule wins, as in the browser (same selector, so order decides).
// media: null = top level only; a string = exactly that @media; a function(env) = evaluate media queries for a screen.
const mediaMatches = (q, env) => q.split(/,(?![^(]*\))/).some((alt) => {
  return [...alt.matchAll(/\(([^)]+)\)/g)].every(([, f]) => {
    const [k, v] = f.split(':').map((s) => s.trim());
    const n = parseFloat(v);
    if (k === 'max-width') return env.w <= n;
    if (k === 'min-width') return env.w >= n;
    if (k === 'max-height') return env.h <= n;
    if (k === 'min-height') return env.h >= n;
    if (k === 'pointer') return env.pointer === v;
    if (k === 'hover') return (env.pointer === 'fine') === (v === 'hover');
    return false; // prefers-*, display-mode, print...
  });
});
const value = (selector, prop, media = null) => {
  let got;
  for (const r of rules) {
    if (!r.selectors.includes(selector) || !(prop in r.decls)) continue;
    if (media === null && r.media.length) continue;
    if (typeof media === 'string' && (r.media.length !== 1 || r.media[0] !== media)) continue;
    if (typeof media === 'object' && media && !r.media.every((q) => mediaMatches(q, media))) continue;
    got = r.decls[prop];
  }
  return got;
};
const mediaOf = (selector) => rules.filter((r) => r.selectors.includes(selector)).map((r) => r.media.join(' & '));

/* ---------- Program sheet at 320px (no sideways scroll) ---------- */

check('sheet forms and bodies have one column that can shrink', value('.sheet-body', 'grid-template-columns'), 'minmax(0, 1fr)');
check('...the details sections too', value('.d-sec', 'grid-template-columns'), 'minmax(0, 1fr)');
check('the member number row can shrink below its field', value('.member-edit', 'min-width'), '0');
check('the member number placeholder ends in …', value('.member-input', 'text-overflow'), 'ellipsis');
check('the screenshot review form shrinks with larger text', [value('.scan-result', 'grid-template-columns'), value('.scan-field', 'grid-template-columns')], ['minmax(0, 1fr)', 'auto minmax(0, 1fr)']);

/* ---------- Sticky Done/Save: phones either way up, not short laptop windows ---------- */

const STICKY = '.sheet > form > .sheet-actions';
const screens = {
  'iPhone SE 320x568': { w: 320, h: 568, pointer: 'coarse', sticky: true },
  'iPhone 14 390x664': { w: 390, h: 664, pointer: 'coarse', sticky: true },
  'iPhone 14 sideways 750x340': { w: 750, h: 340, pointer: 'coarse', sticky: true },
  'iPhone SE sideways 667x375': { w: 667, h: 375, pointer: 'coarse', sticky: true },
  'Pro Max sideways 932x430': { w: 932, h: 430, pointer: 'coarse', sticky: true },
  'short laptop window 1280x450': { w: 1280, h: 450, pointer: 'fine', sticky: false },
  'short laptop window 1100x480': { w: 1100, h: 480, pointer: 'fine', sticky: false },
  'iPad 810x1080': { w: 810, h: 1080, pointer: 'coarse', sticky: false },
  'iPad sideways 1180x820': { w: 1180, h: 820, pointer: 'coarse', sticky: false },
  'desktop 1440x900': { w: 1440, h: 900, pointer: 'fine', sticky: false },
};
for (const [name, env] of Object.entries(screens)) {
  check(`${name}: Done/Save row ${env.sticky ? 'is' : "isn't"} sticky`, value(STICKY, 'position', env) === 'sticky', env.sticky);
  check(`${name}: the scroll padding above that row ${env.sticky ? 'is' : "isn't"} there`, !!value('.sheet', 'scroll-padding-bottom', env), env.sticky);
}
for (const name of ['iPhone 14 sideways 750x340', 'Pro Max sideways 932x430']) {
  const env = screens[name];
  check(`${name}: the sheet sits on the bottom edge (so the toast clears the row)`, [value('.sheet', 'margin-bottom', env), value('.sheet > .toast', 'bottom', env)], ['0', 'calc(76px + env(safe-area-inset-bottom))']);
}
check('sideways, a focused field stops a little higher (WebKit treats a partly hidden Notes box as visible)', [value('.sheet', 'scroll-padding-bottom', screens['iPhone 14 sideways 750x340']), value('.sheet', 'scroll-padding-bottom', screens['iPhone 14 390x664'])], ['calc(100px + env(safe-area-inset-bottom))', 'calc(80px + env(safe-area-inset-bottom))']);
check('short laptop window: the sheet stays a centered card', value('.sheet', 'margin-bottom', screens['short laptop window 1280x450']), undefined);
check('Site password: its nested form also gets the sticky row', value('.sheet > .sheet-body > form > .sheet-actions', 'position', screens['iPhone 14 390x664']), 'sticky');
check("Site password: the nested form isn't padded twice", value('.sheet #lock-form', 'padding'), '0');
check('Site password: its fields keep the usual 16px gap', [value('#lock-entry', 'display'), value('#lock-entry', 'gap')], ['grid', '16px']);
check("the comment doesn't promise Done/Save stays on screen while you type", /while you scroll or type/.test(rawCss), false);

/* ---------- Done/Save rows on a 320px phone ---------- */

check('a button that wraps to a second row stays on the right', value('.sheet-actions', 'justify-content'), 'flex-end');
check('below 375px the row is tighter so it fits on one line', [value('.sheet-actions', 'gap', '(max-width: 374px)'), value('.sheet-actions .add', 'padding-inline', '(max-width: 374px)')], ['8px', '12px']);
check("the program sheet's website link is cut short on one line", [value('.d-actions', 'flex-wrap'), value('#d-site', 'text-overflow'), value('#d-site', 'white-space'), value('#d-site', 'min-width')], ['nowrap', 'ellipsis', 'nowrap', '0']);
check('...and its full name is the tooltip', /\$\('#d-site'\)\.title = site\.replace\(\/\^www\\\.\/, ''\)/.test(js), true);

/* ---------- Main page and Credits on small phones ---------- */

check('Credits card names take the room they need before the summary', value('.cp-card-head h3', 'flex'), '1 1 auto');
check("the Credits 'day you used' field is 16px (no iPhone zoom)", value('.cp-others .cp-other-date', 'font-size'), '16px');
check('below 375px, Credits lines up with the logo and the switcher gets room for a name', [value('.hero-link', 'margin-left', '(max-width: 374px)'), value('.hero-link:not([hidden]) + .person-chip', 'max-width', '(max-width: 374px)')], ['0', 'calc(100% - 108px)']);
check("'Coming up · 3' keeps the count with it", [value('#up-count', 'white-space'), value('.up-head', 'gap', '(max-width: 359px)'), value('.up-head .pill-btn', 'padding', '(max-width: 359px)')], ['nowrap', '8px', '0 10px']);
check("the scan card's 'Screenshot 1 of 2' and 'Skip this one' stay on one line", [value('.play-count', 'white-space'), value('#play-skip', 'white-space'), value('#play-skip', 'font-size')], ['nowrap', 'nowrap', '14px']);
check("section headers' buttons wrap only when the title needs the room", [value('.sec-actions', 'flex-wrap'), value('.sec-actions', 'min-width'), value('.sec-row > :first-child', 'flex')], ['wrap', '0', '1 1 0']);
check("the '≈ $… in points & miles ›' line keeps › with 'miles'", [value('.worth', 'text-align'), /in points & miles\\u00a0›`/.test(js)], ['left', true]);
check('card tiles grow for a three-line name', [value('.cc', 'height'), value('.cc', 'min-height'), value('.cc-name', '-webkit-line-clamp')], [undefined, '92px', '3']);
check('toasts show up to four lines', value('.toast-msg', '-webkit-line-clamp'), '4');
check('footer buttons and pickers wrap with larger text', [value('.ghost-btn', 'height'), value('.ghost-btn', 'min-height'), value('.ghost-btn', 'max-width'), value('.theme-pick', 'flex-wrap')], [undefined, '34px', '100%', 'wrap']);
check('status editor fields end in … when a name is too long', value('.sl-via', 'text-overflow'), 'ellipsis');

/* ---------- Typing balances ---------- */

check('Type balances field is 7.5em (120px at 16px)', value('.quick-input', 'width'), '7.5em');
check('below 380px it is 7em with 8px padding (8 digits with commas fit)', [value('.quick-input', 'width', '(max-width: 379px)'), value('.quick-input', 'padding', '(max-width: 379px)')], ['7em', '0 8px']);
check('below 380px, with larger text the field moves under the name', [value('.quick-row', 'flex-wrap', '(max-width: 379px)'), value('.quick-name', 'min-width', '(max-width: 379px)')], ['wrap', '4.5em']);
check('with larger text the field and its unit move together (one box), right-aligned', [/h\('span', \{ class: 'quick-field' \}, input, h\('span', \{ class: 'quick-unit' \}, unit\)\)/.test(js), value('.quick-field', 'display'), value('.quick-field', 'margin-left'), value('.quick-input', 'margin-left', '(max-width: 379px)')], [true, 'flex', 'auto', undefined]);
check('below 380px the field box keeps the 8px gap', value('.quick-field', 'gap', '(max-width: 379px)'), '8px');
check("the scan card's top row wraps before 'Skip this one' can run under the close button", [value('.play-top', 'flex-wrap'), value('.play-top', 'row-gap')], ['wrap', '4px']);
check("...and on a 320px phone 'Screenshot 1 of 2' and 'Skip this one' still share a row", [value('.play-top', 'column-gap', '(max-width: 359px)'), value('.play-top', 'margin-right', '(max-width: 359px)')], ['8px', '30px']);
check("the Appearance picker's wrapped rows leave room for the 44px touch areas", value('.theme-pick', 'gap'), '12px 4px');
check('the inline balance editor is 6.5em, so it stays inside the card at 320px', value('.num-input', 'width'), '6.5em');
check('while a balance is typed, the status pill wraps inside itself', value('.row-main:has(.num-input) .pill', 'white-space'), 'normal');

/* ---------- Touch ---------- */

const ta = rules.find((r) => r.selectors.includes('summary') && r.decls['touch-action']);
check('tick boxes, labels and summaries are touch-action: manipulation', ta && ['button', 'summary', 'label', 'input[type="checkbox"]', 'input[type="radio"]'].every((s) => ta.selectors.includes(s)) && ta.decls['touch-action'], 'manipulation');
check("text fields aren't in that list", ta && ta.selectors.some((s) => /^input(?!\[type="(checkbox|radio)"\])|^select|^textarea/.test(s)), false);
check('the Credits button only tints on hover with a mouse', mediaOf('.hero-link:hover'), ['(hover: hover)']);
check('the person switcher only tints on hover with a mouse', mediaOf('.person-chip:hover'), ['(hover: hover)']);
const coarse = { w: 390, h: 664, pointer: 'coarse' };
const fine = { w: 1440, h: 900, pointer: 'fine' };
check('small buttons get a 44px tall touch area on touch screens', ['.pill-btn::after', '.view-pick button::after', '.theme-pick button::after', '#toast-undo::after'].map((s) => value(s, 'inset', coarse)), ['-6px 0', '-6px 0', '-6px 0', '-6px 0']);
check("the Credits skip button's touch area grows on every side", value('.cp-skip::after', 'inset', coarse), '-6px');
check('those buttons are positioned so the area sits on them', ['.pill-btn', '.cp-skip', '#toast-undo'].map((s) => value(s, 'position', coarse)), ['relative', 'relative', 'relative']);
check('...but not with a mouse', value('.pill-btn::after', 'inset', fine), undefined);

/* ---------- Program links ---------- */

check('program-page links use the app color, visited or not', [value('.fine a', 'color'), value('.fine a:focus-visible', 'outline')], ['var(--accent)', '2px solid var(--accent)']);

console.log(`\n${total - failed}/${total} passed`);
if (failed) process.exit(1);
