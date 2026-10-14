// Look-alike account pages (made-up names and numbers), drawn on a canvas and pasted into the app, to check the
// whole screenshot path on the live site: the real text reader, both readings, the big-number re-read, the parser.
// Run on https://statuspoints.github.io with the programs on your list (see `programs` below), from the console:
//   const m = await import('/tests/lookalikes.js'); m.setUp();   // replaces this browser's tracker; reloads
//   const m = await import('/tests/lookalikes.js'); await m.run(); // then: m.results, m.results.filter((r) => !r.ok)
// It never applies a read (each card is closed), and setUp() is for a test browser only.

const W = '#fff';
const D = '#0f1115';
const t = (text, x, y, size, weight = 400, color, align = 'left') => [text, x, y, size, weight, color, align];

export const programs = [['delta', 'Delta SkyMiles', 'miles'], ['united', 'United MileagePlus', 'miles'], ['american', 'American AAdvantage', 'miles'],
  ['hilton', 'Hilton Honors'], ['marriott', 'Marriott Bonvoy'], ['ihg', 'IHG One Rewards'], ['hyatt', 'World of Hyatt'],
  ['amex', 'Amex Membership Rewards'], ['chase', 'Chase Ultimate Rewards'], ['southwest', 'Southwest Rapid Rewards'],
  ['alaska', 'Alaska Atmos Rewards'], ['capitalone', 'Capital One Miles', 'miles'], ['bilt', 'Bilt Rewards']];

export const pages = [
  { name: 'IHG web, balance beside the greeting', w: 2000, h: 644, rects: [[0, 120, 2000, 434, '#dde2e6'], [1374, 140, 2, 392, '#c9ced3']],
    text: [t('IHG', 60, 64, 52, 500), t('ONE', 212, 40, 22), t('REWARDS', 212, 62, 22), t('My Account', 968, 54, 26), t('Points', 1435, 54, 26),
      t('Hello Alex,', 46, 276, 42), t('Platinum Elite Member', 46, 362, 70, 700), t('Member #123456789', 46, 420, 42),
      t('YOUR POINTS', 1816, 208, 24, 700, '#111', 'right'), t('26,948', 1812, 302, 96, 700, '#111', 'right'), t('Purchase points', 1816, 470, 24, 400, '#111', 'right')],
    expect: { program: 'IHG', balance: 26948, tier: 'Platinum Elite' } },
  { name: 'Delta app', w: 1170, h: 1700,
    text: [t('SkyMiles', 60, 120, 56, 700, '#0b1f4a'), t('Hi, Alex', 60, 220, 40), t('Gold Medallion®', 60, 320, 52, 700, '#8a6d1d'),
      t('Status valid through Jan 31, 2028', 60, 390, 32, 400, '#444'), t('84,250', 60, 600, 120, 700), t('Miles available', 60, 670, 36, 400, '#444'),
      t('MQDs', 60, 820, 36, 700), t('$11,240 of $15,000', 60, 880, 42), t('SkyMiles # 9012345678', 60, 1050, 32, 400, '#444')],
    expect: { program: 'Delta', balance: 84250, tier: 'Gold Medallion', counts: ['$11,240 MQDs'] } },
  { name: 'Delta web', w: 1600, h: 800, rects: [[0, 0, 1600, 90, '#003366']],
    text: [t('DELTA', 40, 60, 40, 700, W), t('Hi, Alex', 60, 200, 40, 700), t('Diamond Medallion® Member', 60, 260, 32, 400, '#003366'),
      t('SkyMiles # 9012345678', 60, 320, 26, 400, '#444'), t('Miles Available', 1000, 200, 26, 400, '#444'), t('412,870', 1000, 285, 72, 700),
      t('MQDs', 60, 520, 26, 400, '#444'), t('$31,240', 60, 580, 44, 700), t('Status valid through Jan 31, 2028', 60, 650, 26, 400, '#444')],
    expect: { program: 'Delta', balance: 412870, tier: 'Diamond Medallion', counts: ['$31,240 MQDs'] } },
  { name: 'United web, PQP and PQF side by side', w: 1440, h: 820, rects: [[0, 0, 1440, 90, '#0c2340']],
    text: [t('UNITED', 40, 60, 40, 700, W), t('MileagePlus', 1100, 60, 28, 400, W), t('Alex Smith', 60, 200, 40, 700), t('Premier Gold', 60, 260, 32, 400, '#0c2340'),
      t('MileagePlus® #ABC12345', 60, 320, 26, 400, '#444'), t('Available miles', 1380, 200, 26, 400, '#444', 'right'), t('112,450', 1380, 280, 72, 700, '#111', 'right'),
      t('Premier qualifying points (PQP)', 60, 520, 26, 400, '#444'), t('9,820 of 12,000', 60, 570, 36, 700),
      t('Premier qualifying flights (PQF)', 760, 520, 26, 400, '#444'), t('24 of 30', 760, 570, 36, 700)],
    expect: { program: 'United', balance: 112450, tier: 'Premier Gold', counts: ['9,820 PQP', '24 flights'] } },
  { name: 'United app with recent activity and an offer', w: 1170, h: 2000,
    text: [t('9:41', 60, 60, 34, 700), t('100%', 1050, 60, 30, 700), t('MileagePlus', 60, 200, 52, 700), t('Premier Platinum', 60, 290, 44, 700, '#0c2340'),
      t('84,615', 60, 480, 110, 700), t('Available miles', 60, 550, 36, 400, '#444'), t('Recent activity', 60, 760, 40, 700),
      t('United Airlines SFO-EWR', 60, 840, 32), t('+3,420 miles', 1110, 840, 32, 700, '#111', 'right'), t('Award ticket redemption', 60, 920, 32),
      t('-25,000 miles', 1110, 920, 32, 700, '#111', 'right'), t('Chase card spend', 60, 1000, 32), t('+1,240 miles', 1110, 1000, 32, 700, '#111', 'right'),
      t('Earn up to 80,000 bonus miles with the United Quest Card', 60, 1200, 30, 400, '#0c2340')],
    expect: { program: 'United', balance: 84615, tier: 'Premier Platinum' } },
  { name: 'American app', w: 1170, h: 1700, rects: [[0, 0, 1170, 150, '#0078d2']],
    text: [t('AAdvantage®', 60, 100, 52, 700, W), t('Platinum Pro', 60, 300, 60, 700), t('AAdvantage # 7KX1P92', 60, 370, 32, 400, '#444'),
      t('57,900', 60, 560, 110, 700), t('Award miles', 60, 630, 36, 400, '#444'), t('Loyalty Points', 60, 800, 36, 400, '#444'), t('61,250', 60, 880, 64, 700),
      t('63,750 to Executive Platinum', 60, 950, 32, 400, '#444')],
    expect: { program: 'American', balance: 57900, tier: 'Platinum Pro', counts: ['61,250 Loyalty Points'] } },
  { name: 'Southwest app, dark mode', w: 1170, h: 1600, bg: D, ink: '#f2f2f2',
    text: [t('Rapid Rewards®', 60, 140, 52, 700), t('A-List', 60, 300, 60, 700, '#ffbf27'), t('Rapid Rewards # 51234567890', 60, 370, 30, 400, '#bbb'),
      t('63,410', 60, 560, 110, 700), t('Available points', 60, 630, 36, 400, '#bbb'), t('Tier qualifying points', 60, 820, 34, 400, '#bbb'),
      t('22,900 of 35,000', 60, 890, 48, 700), t('Flights', 60, 1040, 34, 400, '#bbb'), t('11 of 20', 60, 1110, 48, 700)],
    expect: { program: 'Southwest', balance: 63410, tier: 'A-List', counts: ['22,900 tier points', '11 flights'] } },
  { name: 'Alaska web', w: 1440, h: 760, rects: [[0, 0, 1440, 96, '#01426a']],
    text: [t('Atmos™ Rewards', 40, 62, 34, 700, W), t('Alaska Airlines', 1180, 62, 26, 400, W), t('Hi Alex', 60, 210, 40, 700), t('Gold', 60, 270, 34, 700, '#b08d3c'),
      t('Member # 123456789', 60, 330, 26, 400, '#444'), t('Points', 900, 210, 26, 400, '#444'), t('88,300', 900, 290, 72, 700),
      t('Status points', 60, 520, 26, 400, '#444'), t('31,500 / 40,000', 60, 580, 40, 700)],
    expect: { program: 'Alaska', balance: 88300, tier: 'Gold', counts: ['31,500 status points'] } },
  { name: 'Hilton app, tiles', w: 1170, h: 1600, rects: [[0, 0, 1170, 160, '#104c97']],
    text: [t('Hilton Honors', 60, 105, 52, 700, W), t('Diamond', 60, 300, 64, 700), t('Member since 2014', 60, 360, 30, 400, '#444'), t('245,100', 60, 560, 110, 700),
      t('Points', 60, 630, 36, 400, '#444'), t('Nights', 60, 800, 34, 400, '#444'), t('32', 60, 870, 56, 700), t('Stays', 500, 800, 34, 400, '#444'),
      t('14', 500, 870, 56, 700), t('Member # 1234567890', 60, 1050, 32, 400, '#444')],
    expect: { program: 'Hilton', balance: 245100, tier: 'Diamond', counts: ['32 nights', '14 stays'] } },
  { name: 'Hilton web, balance level with the status', w: 2000, h: 700, rects: [[0, 0, 2000, 110, '#104c97'], [1374, 150, 2, 420, '#ccc']],
    text: [t('Hilton Honors', 50, 72, 44, 700, W), t('Welcome back, Alex', 46, 250, 40), t('Gold Member', 46, 330, 64, 700), t('Member #1234567890', 46, 400, 34),
      t('Lifetime nights: 412', 46, 470, 28, 400, '#555'), t('Points balance', 1816, 220, 26, 700, '#111', 'right'), t('152,310', 1812, 315, 92, 700, '#111', 'right'),
      t('Nights this year 21', 1816, 400, 28, 400, '#444', 'right'), t('Free nights from 5,000 points', 1816, 470, 26, 400, '#444', 'right')],
    expect: { program: 'Hilton', balance: 152310, tier: 'Gold', counts: ['21 nights'] } },
  { name: 'Marriott web, two columns', w: 2000, h: 640, rects: [[0, 110, 2000, 420, '#f4efe9'], [1374, 140, 2, 360, '#ccc']],
    text: [t('MARRIOTT', 60, 60, 44, 700), t('BONVOY', 60, 95, 22), t('Welcome, Alex', 46, 270, 42), t('Gold Elite', 46, 350, 68, 700),
      t('Member number 123456789', 46, 420, 36), t('POINTS', 1816, 210, 24, 700, '#111', 'right'), t('128,400', 1812, 305, 96, 700, '#111', 'right'),
      t('31 nights this year', 1816, 380, 28, 400, '#444', 'right')],
    expect: { program: 'Marriott', balance: 128400, tier: 'Gold Elite', counts: ['31 nights'] } },
  { name: 'Marriott app, value-first tiles', w: 1170, h: 1500,
    text: [t('MARRIOTT BONVOY', 60, 120, 48, 700), t('Platinum Elite', 60, 260, 56, 700), t('128,400', 60, 480, 96, 700), t('Points', 60, 540, 34, 400, '#444'),
      t('52', 640, 480, 96, 700), t('Nights', 640, 540, 34, 400, '#444'), t('Member 123456789', 60, 720, 32, 400, '#444')],
    expect: { program: 'Marriott', balance: 128400, tier: 'Platinum Elite', counts: ['52 nights'] } },
  { name: 'Hyatt web', w: 1440, h: 760, rects: [[0, 0, 1440, 100, '#1a1a1a']],
    text: [t('WORLD OF HYATT', 40, 64, 34, 700, W), t('Alex Smith', 60, 210, 44, 700), t('Explorist', 60, 270, 34, 400, '#7a5c2e'), t('Member #123456789A', 60, 330, 26, 400, '#444'),
      t('Current Points', 900, 210, 26, 400, '#444'), t('41,200', 900, 290, 72, 700), t('Tier-qualifying nights', 60, 520, 26, 400, '#444'), t('23', 60, 580, 48, 700),
      t('Base points', 600, 520, 26, 400, '#444'), t('18,450', 600, 580, 48, 700)],
    expect: { program: 'Hyatt', balance: 41200, tier: 'Explorist', counts: ['23 nights'] } },
  { name: 'Hyatt app with pending points and a price', w: 1170, h: 1700,
    text: [t('World of Hyatt', 60, 150, 52, 700), t('Globalist', 60, 270, 52, 700, '#7a5c2e'), t('Points', 60, 430, 36, 400, '#444'), t('73,950', 60, 530, 100, 700),
      t('Pending points 1,200', 60, 600, 32, 400, '#444'), t('Qualifying nights 61', 60, 760, 36, 700), t('Book a Category 4 room for 15,000 points per night', 60, 920, 30, 400, '#444')],
    expect: { program: 'Hyatt', balance: 73950, tier: 'Globalist', counts: ['61 nights'] } },
  { name: 'Amex web with pending points', w: 1440, h: 700, rects: [[0, 0, 1440, 96, '#006fcf']],
    text: [t('AMERICAN EXPRESS', 40, 62, 32, 700, W), t('Membership Rewards®', 60, 200, 44, 700), t('Available Points', 60, 280, 28, 400, '#444'), t('152,340', 60, 370, 84, 700),
      t('Platinum Card® •••• 1004', 60, 460, 28, 400, '#444'), t('Pending points 4,250', 60, 520, 28, 400, '#444'), t('Use points', 1100, 280, 28, 700, '#006fcf')],
    expect: { program: 'Amex', balance: 152340 } },
  { name: 'Chase app with a card number', w: 1170, h: 1500, rects: [[0, 0, 1170, 150, '#117aca']],
    text: [t('CHASE', 60, 100, 52, 700, W), t('Ultimate Rewards®', 60, 280, 48, 700), t('98,765', 60, 460, 110, 700), t('Available points', 60, 530, 36, 400, '#444'),
      t('Sapphire Preferred (...4417)', 60, 680, 36, 400, '#444'), t('Book travel', 60, 860, 40, 700, '#117aca'), t('Transfer to partners', 60, 960, 40, 700, '#117aca')],
    expect: { program: 'Chase', balance: 98765 } },
  { name: 'Capital One app, dark mode', w: 1170, h: 1300, bg: '#0d1b2a', ink: '#eef',
    text: [t('Capital One', 60, 130, 52, 700), t('Venture X ...4821', 60, 230, 34, 400, '#aab'), t('Rewards balance', 60, 400, 36, 400, '#aab'), t('214,780 Miles', 60, 500, 90, 700),
      t('Redeem miles', 60, 680, 40, 700, '#7dd3fc'), t('Transfer to partners', 60, 780, 40, 700, '#7dd3fc')],
    expect: { program: 'Capital One', balance: 214780 } },
  { name: 'Bilt app', w: 1170, h: 1300,
    text: [t('BILT', 60, 140, 64, 700), t('Silver', 60, 260, 44, 700, '#666'), t('Points', 60, 420, 36, 400, '#444'), t('36,215', 60, 520, 100, 700),
      t('Rent Day: 2x points on the 1st', 60, 700, 32, 400, '#444')],
    expect: { program: 'Bilt', balance: 36215 } },
];

export function draw(page) {
  const canvas = document.createElement('canvas');
  canvas.width = page.w;
  canvas.height = page.h;
  const g = canvas.getContext('2d');
  g.fillStyle = page.bg || W;
  g.fillRect(0, 0, page.w, page.h);
  for (const [x, y, w, h, color] of page.rects || []) { g.fillStyle = color; g.fillRect(x, y, w, h); }
  for (const [text, x, y, size, weight, color, align] of page.text) {
    g.font = `${weight} ${size}px Helvetica Neue, Arial`;
    g.fillStyle = color || page.ink || '#111';
    g.textAlign = align;
    g.fillText(text, x, y);
  }
  return canvas;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pastes one page and reads the result card, then closes it without applying anything.
export async function scan(page) {
  const blob = await new Promise((resolve) => draw(page).toBlob(resolve, 'image/png'));
  const data = new DataTransfer();
  data.items.add(new File([blob], 'lookalike.png', { type: 'image/png', lastModified: Date.now() }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  let title = '';
  for (let i = 0; i < 600; i++) {
    await pause(250);
    title = document.querySelector('#play-title').textContent;
    if (/^Found|^New program|up to date|Which program|Couldn|looks like|no points or status/.test(title)) break;
  }
  document.querySelector('#play').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); // no automatic update
  const rows = [...document.querySelectorAll('#play-loot li')].map((li) => li.innerText.replace(/\n+/g, ' | '));
  document.querySelector('#play-close').click();
  await pause(300);
  const balance = rows.map((r) => /^([\d,]+) (?:points|miles)/i.exec(r)).find(Boolean);
  const status = rows.find((r) => /\| Status/.test(r));
  const got = { title, balance: balance ? Number(balance[1].replace(/,/g, '')) : null, tier: status ? status.split(' | ')[0] : null,
    counts: rows.filter((r) => !/Balance|\| Status|Member number|On your list|Adding it|Check this/.test(r)).map((r) => r.split(' | ')[0]) };
  const e = page.expect;
  const ok = title.includes(e.program) && got.balance === e.balance && (e.tier === undefined || got.tier === e.tier)
    && (e.counts || []).every((c) => got.counts.includes(c));
  return { name: page.name, ok, got };
}

export const results = [];
export async function run(list = pages) {
  results.length = 0;
  for (const page of list) results.push(await scan(page));
  results.done = true;
  return results;
}

// A test browser's tracker with every program above on the list (replaces what's saved here).
export function setUp() {
  localStorage.setItem('status-tracker-v2', JSON.stringify({ programs: programs.map(([id, name, unit = 'points']) => ({ id, name, unit, status: [] })),
    cards: [], balances: {}, vouchers: [], game: { xp: 100, scans: 3, best: 1, weeks: [], badges: {}, confirmed: {}, log: [] } }));
  location.reload();
}
