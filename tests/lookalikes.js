// Look-alike account pages (made-up names and numbers), drawn on a canvas and pasted into the app, to check the
// whole screenshot path on the live site: the real text reader, both readings, the big-number re-read, the parser.
// Run on https://statuspoints.github.io with the programs on your list (see `programs` below), from the console:
//   const m = await import('/tests/lookalikes.js'); m.setUp();   // replaces this browser's tracker; reloads
//   const m = await import('/tests/lookalikes.js'); await m.run(); // then: m.results, m.results.filter((r) => !r.ok)
// Harder copies: m.run(m.pages, { scale: 0.5 }) (a low-resolution screenshot), { jpeg: 0.5 } (compressed),
// { font: 'Georgia, serif' } or { light: true } (thin text) — any mix.
// 79 pages, 31 programs. It never applies a read (each card is closed), and setUp() is for a test browser only.

const W = '#fff';
const D = '#0f1115';
const t = (text, x, y, size, weight = 400, color, align = 'left') => [text, x, y, size, weight, color, align];

export const programs = [['delta', 'Delta SkyMiles', 'miles'], ['united', 'United MileagePlus', 'miles'], ['american', 'American AAdvantage', 'miles'],
  ['hilton', 'Hilton Honors'], ['marriott', 'Marriott Bonvoy'], ['ihg', 'IHG One Rewards'], ['hyatt', 'World of Hyatt'],
  ['amex', 'Amex Membership Rewards'], ['chase', 'Chase Ultimate Rewards'], ['southwest', 'Southwest Rapid Rewards'],
  ['alaska', 'Alaska Atmos Rewards'], ['capitalone', 'Capital One Miles', 'miles'], ['bilt', 'Bilt Rewards'],
  ['emirates', 'Emirates Skywards', 'miles'], ['ba', 'British Airways Club', 'Avios'], ['flyingblue', 'Air France-KLM Flying Blue', 'miles'],
  ['qatar', 'Qatar Privilege Club', 'Avios'], ['aeroplan', 'Air Canada Aeroplan'],
  ['wyndham', 'Wyndham Rewards'], ['choice', 'Choice Privileges'], ['accor', 'ALL Accor'], ['bestwestern', 'Best Western Rewards'],
  ['hertz', 'Hertz Gold Plus Rewards', ''], ['national', 'National Emerald Club', ''],
  ['koreanair', 'Korean Air SKYPASS', 'miles'], ['iberia', 'Iberia Club', 'Avios'], ['lufthansa', 'Lufthansa Miles & More', 'miles'], ['jal', 'JAL Mileage Bank', 'miles'],
  ['etihad', 'Etihad Guest', 'miles'], ['frontier', 'Frontier Miles', 'miles'], ['singapore', 'Singapore KrisFlyer', 'miles']];

export const pages = [
  // A member card: the number has no label and ends in a letter (all made up).
  { name: 'Hyatt member card, number under “Member since”', w: 702, h: 422, bg: '#f4f6fb', ink: '#fff', rects: [[0, 0, 702, 316, '#2f6fc4'], [72, 2, 576, 360, ['#2f66b4', '#24558f']], [528, 26, 96, 96, '#2f6fc4']],
    text: [t('WORLD', 576, 52, 18, 600, '#fff', 'center'), t('OF', 576, 78, 18, 600, '#fff', 'center'), t('HYATT', 576, 104, 18, 600, '#fff', 'center'), t('MEMBER', 176, 92, 42, 600),
      t('Current point balance', 96, 158, 22), t('37,415', 96, 198, 31, 700), t('Member since Mar 14, 2026', 96, 242, 22), t('514807263K', 96, 282, 31, 700), t('DR PAT SAMPLE', 96, 332, 22)],
    expect: { program: 'Hyatt', balance: 37415, member: '263K' } },
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
  // International airlines, more hotels and car rental (car programs keep no points balance).
  {"name": "Emirates app, Tier Miles and recent activity", "w": 1170, "h": 1800, "rects": [[0, 0, 1170, 160, "#c8102e"]], "text": [["Emirates", 60, 115, 52, 700, "#fff", "left"], ["Skywards", 1110, 115, 36, 400, "#fff", "right"], ["Hello, Jordan", 60, 270, 40, 400, null, "left"], ["Gold", 60, 360, 60, 700, "#a8862f", "left"], ["Membership no. EK 123456789", 60, 420, 30, 400, "#666", "left"], ["Skywards Miles", 60, 590, 36, 400, "#444", "left"], ["73,240", 60, 700, 110, 700, null, "left"], ["Tier Miles", 60, 870, 34, 400, "#444", "left"], ["28,600 / 50,000 to Platinum", 60, 940, 44, 700, null, "left"], ["Gold valid until 31/03/2028", 60, 1010, 30, 400, "#666", "left"], ["Recent activity", 60, 1170, 40, 700, null, "left"], ["Emirates EK 202 DXB-JFK", 60, 1250, 32, 400, null, "left"], ["+11,750 Miles", 1110, 1250, 32, 700, "#111", "right"], ["Skywards Everyday purchase", 60, 1330, 32, 400, null, "left"], ["+640 Miles", 1110, 1330, 32, 700, "#111", "right"], ["Earn 25% bonus Miles on Business Class to Europe", 60, 1490, 30, 400, "#c8102e", "left"]], "expect": {"program": "Emirates", "balance": 73240, "tier": "Gold"}},
  {"name": "British Airways Club web, Tier Points and an offer", "w": 1600, "h": 860, "rects": [[0, 0, 1600, 96, "#075aaa"]], "text": [["BRITISH AIRWAYS", 40, 62, 34, 700, "#fff", "left"], ["The British Airways Club", 1560, 62, 24, 400, "#fff", "right"], ["Hello Sam", 60, 200, 40, 700, null, "left"], ["Silver", 60, 265, 36, 700, "#6d7378", "left"], ["Membership number 12345678", 60, 325, 26, 400, "#444", "left"], ["Avios balance", 1000, 200, 26, 400, "#444", "left"], ["96,320", 1000, 285, 72, 700, null, "left"], ["Tier Points", 60, 500, 26, 400, "#444", "left"], ["11,240 / 20,000 to Gold", 60, 560, 40, 700, null, "left"], ["Membership year ends 31/05/2027", 60, 630, 26, 400, "#444", "left"], ["Reward Flight Saver: fly from 1,250 Avios + £1", 60, 760, 26, 400, "#075aaa", "left"]], "expect": {"program": "British Airways", "balance": 96320, "tier": "Silver"}},
  {"name": "Flying Blue app, XP below the miles", "w": 1170, "h": 1700, "rects": [[0, 0, 1170, 170, "#051039"]], "text": [["Flying Blue", 60, 115, 52, 700, "#fff", "left"], ["Bonjour Camille", 60, 280, 40, 400, null, "left"], ["Platinum", 60, 370, 60, 700, "#5b6770", "left"], ["Flying Blue number 1234567890", 60, 430, 30, 400, "#555", "left"], ["Miles", 60, 600, 36, 400, "#444", "left"], ["41,875", 60, 710, 110, 700, null, "left"], ["Experience Points (XP)", 60, 880, 34, 400, "#444", "left"], ["214 / 300 XP", 60, 950, 48, 700, null, "left"], ["Qualifying period ends 31/03/2027", 60, 1020, 30, 400, "#555", "left"], ["Promo Rewards: Paris from 15,000 Miles", 60, 1200, 30, 400, "#051039", "left"], ["AIR FRANCE  KLM", 60, 1600, 28, 700, "#555", "left"]], "expect": {"program": "Flying Blue", "balance": 41875, "tier": "Platinum"}},
  {"name": "Qatar Privilege Club web, Qpoints and an offer", "w": 1600, "h": 860, "rects": [[0, 0, 1600, 100, "#5c0632"]], "text": [["QATAR AIRWAYS", 40, 64, 34, 700, "#fff", "left"], ["Privilege Club", 1560, 64, 26, 400, "#fff", "right"], ["Welcome, Lina", 60, 210, 40, 700, null, "left"], ["Gold", 60, 275, 36, 700, "#a8862f", "left"], ["Membership no. 123456789", 60, 335, 26, 400, "#444", "left"], ["Avios", 1000, 210, 26, 400, "#444", "left"], ["58,940", 1000, 295, 72, 700, null, "left"], ["Qpoints", 60, 520, 26, 400, "#444", "left"], ["214 / 300", 60, 580, 40, 700, null, "left"], ["Membership valid until 30/11/2027", 60, 650, 26, 400, "#444", "left"], ["Book with Avios + Cash and save up to 30%", 60, 760, 26, 400, "#5c0632", "left"]], "expect": {"program": "Qatar", "balance": 58940, "tier": "Gold"}},
  {"name": "KrisFlyer app, expiring miles and elite miles", "w": 1170, "h": 1750, "rects": [[0, 0, 1170, 170, "#1d2f5c"]], "text": [["KrisFlyer", 60, 115, 52, 700, "#fff", "left"], ["SINGAPORE AIRLINES", 1110, 115, 26, 400, "#fff", "right"], ["Hi Mei Lin", 60, 280, 40, 400, null, "left"], ["Elite Gold", 60, 370, 56, 700, "#a8862f", "left"], ["Membership no. 8812345678", 60, 430, 30, 400, "#555", "left"], ["KrisFlyer miles", 60, 600, 36, 400, "#444", "left"], ["126,480", 60, 710, 110, 700, null, "left"], ["Miles expiring 31 Mar 2027: 8,200", 60, 780, 30, 400, "#555", "left"], ["Elite miles", 60, 940, 34, 400, "#444", "left"], ["38,500 / 50,000", 60, 1010, 48, 700, null, "left"], ["Kris+ deal: earn 3 miles per S$1 at partner stores", 60, 1200, 30, 400, "#1d2f5c", "left"]], "expect": {"program": "KrisFlyer", "balance": 126480, "tier": "Elite Gold"}},
  {"name": "Aeroplan web, SQC and eUpgrades", "w": 1600, "h": 880, "rects": [[0, 0, 1600, 96, "#000"]], "text": [["AIR CANADA", 40, 62, 32, 700, "#fff", "left"], ["Aeroplan", 1560, 62, 26, 400, "#fff", "right"], ["Hi Chris", 60, 210, 40, 700, null, "left"], ["50K", 60, 275, 40, 700, "#c8102e", "left"], ["Aeroplan number 123456789", 60, 335, 26, 400, "#444", "left"], ["Points", 1000, 210, 26, 400, "#444", "left"], ["187,350", 1000, 295, 72, 700, null, "left"], ["Status Qualifying Credits (SQC)", 60, 520, 26, 400, "#444", "left"], ["41,200 of 50,000", 60, 580, 40, 700, null, "left"], ["eUpgrade credits: 20", 60, 650, 26, 400, "#444", "left"], ["Earn 2x points with an Aeroplan credit card", 60, 770, 26, 400, "#c8102e", "left"]], "expect": {"program": "Aeroplan", "balance": 187350, "tier": "50K", "counts": ["41,200 SQC"]}},
  {"name": "Wyndham web, balance column and qualifying nights", "w": 1440, "h": 760, "rects": [[0, 0, 1440, 96, "#0c57a0"], [860, 140, 2, 480, "#d5dbe3"]], "text": [["WYNDHAM", 40, 62, 34, 700, "#fff", "left"], ["REWARDS", 222, 62, 22, 400, "#fff", "left"], ["My Account", 1400, 62, 24, 400, "#fff", "right"], ["Hi, Morgan", 60, 210, 44, 700, null, "left"], ["Platinum", 60, 270, 34, 700, "#0c57a0", "left"], ["Member # 104837265", 60, 330, 26, 400, "#444", "left"], ["Points", 900, 210, 26, 400, "#444", "left"], ["38,750", 900, 290, 72, 700, null, "left"], ["Qualifying nights", 60, 520, 26, 400, "#444", "left"], ["12", 60, 580, 48, 700, null, "left"], ["Go Free® awards from 7,500 points per night", 900, 690, 24, 400, "#444", "left"]], "expect": {"program": "Wyndham", "balance": 38750, "tier": "Platinum", "counts": ["12 nights"]}},
  {"name": "Choice Privileges app with recent activity and a price", "w": 1170, "h": 1700, "rects": [[0, 0, 1170, 160, "#0b7468"]], "text": [["Choice Privileges®", 60, 105, 52, 700, "#fff", "left"], ["Hi, Jordan", 60, 260, 40, 400, null, "left"], ["Platinum Member", 60, 340, 56, 700, "#0b7468", "left"], ["Member # QRT4829156", 60, 400, 32, 400, "#444", "left"], ["48,250", 60, 600, 110, 700, null, "left"], ["Points available", 60, 670, 36, 400, "#444", "left"], ["Nights this year 17", 60, 820, 36, 700, null, "left"], ["Book a stay from 8,000 points", 60, 980, 30, 400, "#0b7468", "left"], ["Recent activity", 60, 1140, 40, 700, null, "left"], ["Comfort Inn Denver", 60, 1220, 32, 400, null, "left"], ["+2,150 points", 1110, 1220, 32, 700, "#111", "right"]], "expect": {"program": "Choice", "balance": 48250, "tier": "Platinum"}},
  {"name": "ALL Accor app, dark, status points above the balance", "w": 1170, "h": 1800, "bg": "#1b1a4a", "ink": "#f5f3ff", "text": [["ALL Accor", 60, 130, 56, 700, null, "left"], ["Bonjour Camille", 60, 240, 40, 400, null, "left"], ["Gold", 60, 340, 60, 700, "#d4b46a", "left"], ["Membership no. 3081031245678901", 60, 410, 30, 400, "#bbc", "left"], ["Reward points", 60, 580, 36, 400, "#bbc", "left"], ["4,820", 60, 680, 110, 700, null, "left"], ["Status points", 60, 860, 34, 400, "#bbc", "left"], ["5,310 / 7,000", 60, 930, 48, 700, null, "left"], ["Valid until 31/12/2027", 60, 1010, 30, 400, "#bbc", "left"], ["2,000 points = €40 off your stay", 60, 1180, 30, 400, "#bbc", "left"]], "expect": {"program": "Accor", "balance": 4820, "tier": "Gold"}},
  {"name": "Best Western web, Diamond Select", "w": 1440, "h": 760, "rects": [[0, 0, 1440, 96, "#003c7e"]], "text": [["BEST WESTERN", 40, 62, 34, 700, "#fff", "left"], ["Rewards", 320, 62, 26, 400, "#fff", "left"], ["Welcome, Taylor", 60, 210, 44, 700, null, "left"], ["Diamond Select Member", 60, 270, 34, 700, "#003c7e", "left"], ["Member # 6005123456789012", 60, 330, 26, 400, "#444", "left"], ["Points balance", 900, 210, 26, 400, "#444", "left"], ["61,480", 900, 290, 72, 700, null, "left"], ["Qualifying nights this year", 60, 520, 26, 400, "#444", "left"], ["27", 60, 580, 48, 700, null, "left"], ["Free nights from 8,000 points", 900, 690, 24, 400, "#444", "left"]], "expect": {"program": "Best Western", "balance": 61480, "tier": "Diamond Select"}},
  {"name": "Hertz app, Five Star with a President's Circle goal", "w": 1170, "h": 1600, "rects": [[0, 0, 1170, 160, "#f2c200"]], "text": [["Hertz", 60, 110, 60, 700, "#1a1a1a", "left"], ["Gold Plus Rewards®", 60, 280, 48, 700, null, "left"], ["Five Star", 60, 370, 56, 700, "#a07800", "left"], ["Member # 71482936", 60, 430, 32, 400, "#444", "left"], ["2,940", 60, 620, 110, 700, null, "left"], ["Points", 60, 690, 36, 400, "#444", "left"], ["Rentals this year: 9 of 15 to President's Circle", 60, 860, 32, 400, "#444", "left"], ["Redeem from 550 points per day", 60, 1000, 30, 400, "#444", "left"], ["Upcoming: Hertz LAX, Nov 14", 60, 1140, 32, 400, null, "left"]], "expect": {"program": "Hertz", "balance": null, "tier": "Five Star"}},
  {"name": "National web, no points balance", "w": 1440, "h": 760, "rects": [[0, 0, 1440, 96, "#0b7a3e"]], "text": [["National", 40, 62, 38, 700, "#fff", "left"], ["Emerald Club", 1400, 62, 26, 400, "#fff", "right"], ["Hi, Riley", 60, 210, 44, 700, null, "left"], ["Emerald Club Executive", 60, 270, 34, 700, "#0b7a3e", "left"], ["Member # 812345679", 60, 330, 26, 400, "#444", "left"], ["Rental credits", 900, 210, 26, 400, "#444", "left"], ["4 of 7", 900, 290, 64, 700, null, "left"], ["toward your next Free Day", 900, 340, 26, 400, "#444", "left"], ["Paid rentals this year", 60, 520, 26, 400, "#444", "left"], ["14 of 25", 60, 580, 48, 700, null, "left"], ["Reach Executive Elite at 25 rentals", 60, 640, 24, 400, "#444", "left"]], "expect": {"program": "National", "balance": null, "tier": "Executive"}},
  {"name": "Amex Platinum benefits web, four statuses with member numbers", "w": 2000, "h": 620, "rects": [[160, 20, 840, 220, "#f3f4f6"], [1040, 20, 840, 220, "#f3f4f6"], [160, 280, 840, 280, "#f3f4f6"], [1040, 280, 840, 280, "#f3f4f6"]], "text": [["Marriott Bonvoy® Gold Elite Status", 194, 105, 32, 700, "#333", "left"], ["Marriott Bonvoy Number: - 4471", 206, 155, 20, 600, "#1a7f4b", "left"], ["Hilton Honors™ Gold Status", 1076, 105, 32, 700, "#333", "left"], ["Hilton Honors Number: 2045318860", 1086, 155, 20, 600, "#1a7f4b", "left"], ["Leaders Club Sterling Status from The", 194, 380, 32, 700, "#333", "left"], ["Leading Hotels of the World®", 194, 420, 32, 700, "#333", "left"], ["Leaders Club Number: 5523190", 206, 472, 20, 600, "#1a7f4b", "left"], ["The American Express Global Lounge", 1076, 366, 32, 700, "#333", "left"], ["Collection®", 1076, 406, 32, 700, "#333", "left"], ["Enrolled in Priority Pass Select Membership Number:", 1086, 458, 20, 600, "#1a7f4b", "left"], ["3301742255", 1086, 486, 20, 600, "#1a7f4b", "left"]], "expect": {"many": ["Marriott Bonvoy", "Hilton Honors", "Leading Hotels of the World", "Airport lounges"]}},
  {"name": "Hilton web, Welcome back, Jordan, no member number (two accounts)", "w": 1600, "h": 800, "rects": [[0, 0, 1600, 100, "#104c97"]], "text": [["Hilton Honors", 50, 66, 44, 700, "#fff", "left"], ["Welcome back, Jordan", 60, 230, 40, 400, null, "left"], ["Gold", 60, 310, 64, 700, null, "left"], ["Points", 1000, 230, 26, 400, "#444", "left"], ["88,210", 1000, 315, 72, 700, null, "left"], ["Nights this year 18", 60, 470, 28, 400, "#444", "left"]], "expect": {"program": "Hilton", "balance": 88210, "tier": "Gold", "counts": ["18 nights"]}},
  {"name": "Chase Sapphire Reserve benefits: IHG Platinum Elite and Priority Pass Select", "w": 1600, "h": 900, "rects": [[0, 0, 1600, 90, "#117aca"]], "text": [["CHASE", 40, 60, 36, 700, "#fff", "left"], ["Sapphire Reserve", 1560, 60, 28, 400, "#fff", "right"], ["Your card benefits", 60, 190, 44, 700, null, "left"], ["IHG One Rewards Platinum Elite status", 60, 300, 34, 700, "#333", "left"], ["IHG One Rewards number: 209876543", 60, 350, 24, 600, "#1a7f4b", "left"], ["Priority Pass Select membership", 60, 470, 34, 700, "#333", "left"], ["Membership number: 7781234560", 60, 520, 24, 600, "#1a7f4b", "left"], ["Complimentary DoorDash DashPass", 60, 640, 34, 700, "#333", "left"], ["$300 annual travel credit", 60, 760, 34, 700, "#333", "left"]], "expect": {"many": ["IHG One Rewards", "Airport lounges"]}},
  {"name": "Benefits page with only lounge memberships (names Delta Sky Club)", "w": 1600, "h": 760, "rects": [[0, 0, 1600, 90, "#006fcf"]], "text": [["AMERICAN EXPRESS", 40, 60, 32, 700, "#fff", "left"], ["Airport lounge access", 60, 190, 44, 700, null, "left"], ["The Centurion Lounge", 60, 300, 34, 700, "#333", "left"], ["Priority Pass Select", 60, 420, 34, 700, "#333", "left"], ["Membership number: 3301742255", 60, 470, 24, 600, "#1a7f4b", "left"], ["Delta Sky Club (when flying Delta)", 60, 590, 34, 700, "#333", "left"], ["Escape Lounges", 60, 690, 34, 700, "#333", "left"]], "expect": {"many": ["Airport lounges"]}},
  {"name": "Venture X benefits: Hertz President's Circle and Priority Pass", "w": 1600, "h": 760, "rects": [[0, 0, 1600, 90, "#0b4b73"]], "text": [["Capital One", 40, 60, 36, 700, "#fff", "left"], ["Venture X", 1560, 60, 28, 400, "#fff", "right"], ["Travel benefits", 60, 190, 44, 700, null, "left"], ["Hertz President's Circle status", 60, 300, 34, 700, "#333", "left"], ["Hertz Gold Plus Rewards number: 71482936", 60, 350, 24, 600, "#1a7f4b", "left"], ["Priority Pass", 60, 470, 34, 700, "#333", "left"], ["Membership number: 1122334455", 60, 520, 24, 600, "#1a7f4b", "left"], ["$300 annual travel credit", 60, 640, 34, 700, "#333", "left"]], "expect": {"many": ["Hertz Gold Plus Rewards", "Airport lounges"]}},
  {"name": "Amex Platinum benefits, five statuses in two columns with member numbers", "w": 2000, "h": 900, "rects": [[160, 20, 840, 240, "#f3f4f6"], [1040, 20, 840, 240, "#f3f4f6"], [160, 300, 840, 240, "#f3f4f6"], [1040, 300, 840, 240, "#f3f4f6"], [160, 580, 840, 240, "#f3f4f6"]], "text": [["Marriott Bonvoy Gold Elite Status", 194, 105, 32, 700, "#333", "left"], ["Marriott Bonvoy Number: 557812349", 206, 155, 20, 600, "#1a7f4b", "left"], ["Hilton Honors Gold Status", 1076, 105, 32, 700, "#333", "left"], ["Hilton Honors Number: 9900112233", 1086, 155, 20, 600, "#1a7f4b", "left"], ["Avis Preferred Plus Status", 194, 385, 32, 700, "#333", "left"], ["Avis Wizard Number: AB12C34", 206, 435, 20, 600, "#1a7f4b", "left"], ["Hertz Gold Plus Rewards President's Circle Status", 1076, 385, 32, 700, "#333", "left"], ["Hertz Number: 71482936", 1086, 435, 20, 600, "#1a7f4b", "left"], ["National Car Rental Emerald Club Executive Status", 194, 665, 32, 700, "#333", "left"], ["Emerald Club Number: 812345679", 206, 715, 20, 600, "#1a7f4b", "left"]], "expect": {"many": ["Marriott Bonvoy", "Hilton Honors", "Avis Preferred", "Hertz Gold Plus Rewards", "National Emerald Club"]}},
  {"name": "Choice web, program named only by a white logo on a dark green header", "w": 1600, "h": 800, "rects": [[0, 0, 1600, 110, "#0b4a3f"]], "text": [["Choice Privileges", 40, 70, 40, 700, "#fff", "left"], ["Hi, Jordan", 60, 230, 40, 400, null, "left"], ["Platinum Member", 60, 310, 56, 700, null, "left"], ["Member # QRT4829156", 60, 370, 28, 400, "#444", "left"], ["Points available", 1000, 230, 26, 400, "#444", "left"], ["48,250", 1000, 315, 72, 700, null, "left"], ["Nights this year 17", 60, 480, 28, 400, "#444", "left"]], "expect": {"program": "Choice", "balance": 48250, "tier": "Platinum"}},
  {"name": "Delta app dark, white header, Platinum Medallion, MQDs and member number", "w": 1170, "h": 1800, "bg": "#0f1115", "ink": "#f2f2f2", "rects": [[0, 0, 1170, 170, "#000"]], "text": [["9:41", 60, 60, 34, 700, "#fff", "left"], ["84%", 1110, 60, 30, 700, "#fff", "right"], ["Delta SkyMiles", 60, 135, 48, 700, "#fff", "left"], ["Hi, Alex", 60, 290, 40, 400, "#ccc", "left"], ["Platinum Medallion", 60, 380, 52, 700, "#c9a7d1", "left"], ["Status valid through Jan 31, 2028", 60, 440, 30, 400, "#aaa", "left"], ["412,870", 60, 640, 110, 700, null, "left"], ["Miles available", 60, 710, 36, 400, "#aaa", "left"], ["MQDs", 60, 880, 36, 700, null, "left"], ["$18,240 of $28,000", 60, 950, 44, 700, null, "left"], ["SkyMiles # 9012345678", 60, 1100, 30, 400, "#aaa", "left"]], "expect": {"program": "Delta", "balance": 412870, "tier": "Platinum Medallion", "counts": ["$18,240 MQDs"]}},
  // A level in light or colored type (gold, teal, orange, pale gray; white on a gold, teal or light badge; black on a
  // yellow card), which the gray picture loses: read from the darkened second look.
  { name: 'ALL Accor app, gold level on white', w: 1170, h: 1700,
    text: [t('ALL Accor', 60, 130, 56, 700, '#1e1852'), t('Bonjour Camille', 60, 240, 40), t('Gold', 60, 340, 60, 700, '#b8962e'),
      t('Membership no. 3081031245678901', 60, 410, 30, 400, '#666'), t('Reward points', 60, 580, 36, 400, '#666'), t('12,480', 60, 680, 100, 700),
      t('Status points', 60, 860, 34, 400, '#666'), t('2,150 / 3,000', 60, 930, 44, 700)],
    expect: { program: 'Accor', balance: 12480, tier: 'Gold' } },
  { name: 'Hilton app, teal Diamond', w: 1170, h: 1500,
    text: [t('Hilton Honors', 60, 120, 52, 700, '#104c97'), t('Hi, Morgan', 60, 220, 40), t('Diamond', 60, 320, 64, 700, '#00a3ad'),
      t('245,100', 60, 540, 110, 700), t('Points', 60, 610, 36, 400, '#444'), t('Member # 1234567890', 60, 760, 32, 400, '#444')],
    expect: { program: 'Hilton', balance: 245100, tier: 'Diamond' } },
  { name: 'Marriott app, light gray Titanium Elite', w: 1170, h: 1500,
    text: [t('MARRIOTT BONVOY', 60, 120, 48, 700), t('Titanium Elite', 60, 260, 56, 700, '#a7a9ac'), t('128,400', 60, 480, 96, 700),
      t('Points', 60, 540, 34, 400, '#444'), t('Member 123456789', 60, 720, 32, 400, '#444')],
    expect: { program: 'Marriott', balance: 128400, tier: 'Titanium Elite' } },
  { name: 'IHG app, orange Gold Elite', w: 1170, h: 1500,
    text: [t('IHG One Rewards', 60, 130, 52, 700, '#1b2a3a'), t('Hello Alex', 60, 230, 40), t('Gold Elite', 60, 320, 56, 700, '#e87722'),
      t('41,200', 60, 520, 100, 700), t('Points', 60, 590, 36, 400, '#444'), t('Member # 123456789', 60, 740, 32, 400, '#444')],
    expect: { program: 'IHG', balance: 41200, tier: 'Gold Elite' } },
  { name: 'Delta app, silver-blue Platinum Medallion', w: 1170, h: 1500,
    text: [t('SkyMiles', 60, 120, 56, 700, '#0b1f4a'), t('Hi, Alex', 60, 220, 40), t('Platinum Medallion', 60, 320, 52, 700, '#8c9bab'),
      t('84,250', 60, 560, 120, 700), t('Miles available', 60, 630, 36, 400, '#444')],
    expect: { program: 'Delta', balance: 84250, tier: 'Platinum Medallion' } },
  { name: 'Southwest app light, orange A-List Preferred', w: 1170, h: 1500,
    text: [t('Rapid Rewards®', 60, 140, 52, 700, '#304cb2'), t('A-List Preferred', 60, 300, 60, 700, '#f9a01b'),
      t('Rapid Rewards # 51234567890', 60, 370, 30, 400, '#666'), t('63,410', 60, 560, 110, 700), t('Available points', 60, 630, 36, 400, '#666')],
    expect: { program: 'Southwest', balance: 63410, tier: 'A-List Preferred' } },
  { name: 'Emirates web, light silver Silver', w: 1600, h: 800, rects: [[0, 0, 1600, 96, '#c8102e']],
    text: [t('Emirates', 40, 62, 36, 700, W), t('Skywards', 1560, 62, 26, 400, W, 'right'), t('Hello, Jordan', 60, 210, 40, 700),
      t('Silver', 60, 275, 36, 700, '#b5b5b5'), t('Membership no. EK 123456789', 60, 335, 26, 400, '#444'),
      t('Skywards Miles', 1000, 210, 26, 400, '#444'), t('38,600', 1000, 295, 72, 700)],
    expect: { program: 'Emirates', balance: 38600, tier: 'Silver' } },
  { name: 'Qatar app, pale silver Platinum', w: 1170, h: 1500,
    text: [t('Privilege Club', 60, 130, 52, 700, '#5c0632'), t('Welcome, Lina', 60, 230, 40), t('Platinum', 60, 330, 60, 700, '#c0c0c0'),
      t('Avios', 60, 520, 36, 400, '#444'), t('64,300', 60, 620, 100, 700)],
    expect: { program: 'Qatar', balance: 64300, tier: 'Platinum' } },
  { name: 'Wyndham app, white Gold on a gold badge', w: 1170, h: 1500, rects: [[60, 290, 220, 90, '#c9a227']],
    text: [t('Wyndham Rewards', 60, 130, 52, 700, '#0c57a0'), t('Hi, Morgan', 60, 220, 40), t('Gold', 85, 355, 52, 700, W),
      t('Points', 60, 520, 36, 400, '#444'), t('27,450', 60, 620, 100, 700)],
    expect: { program: 'Wyndham', balance: 27450, tier: 'Gold' } },
  { name: 'Choice app, white Platinum on a light pill', w: 1170, h: 1500, rects: [[60, 290, 300, 90, '#e6cf8b']],
    text: [t('Choice Privileges®', 60, 130, 52, 700, '#0b7468'), t('Hi, Jordan', 60, 220, 40), t('Platinum', 85, 355, 52, 700, W),
      t('48,250', 60, 600, 110, 700), t('Points', 60, 670, 36, 400, '#444')],
    expect: { program: 'Choice', balance: 48250, tier: 'Platinum' } },
  { name: 'Flying Blue app, gold level and a blue balance', w: 1170, h: 1500,
    text: [t('Flying Blue', 60, 130, 52, 700, '#051039'), t('Bonjour Camille', 60, 230, 40), t('Gold', 60, 330, 60, 700, '#d4a017'),
      t('Miles', 60, 520, 36, 400, '#444'), t('41,875', 60, 620, 100, 700, '#0a6ebd')],
    expect: { program: 'Flying Blue', balance: 41875, tier: 'Gold' } },
  { name: 'Alaska app, white Platinum on a teal badge', w: 1170, h: 1500, rects: [[60, 290, 300, 90, '#2e9fa6']],
    text: [t('Atmos™ Rewards', 60, 130, 52, 700, '#01426a'), t('Hi Alex', 60, 220, 40), t('Platinum', 85, 355, 52, 700, W),
      t('Points', 60, 520, 36, 400, '#444'), t('88,300', 60, 620, 100, 700)],
    expect: { program: 'Alaska', balance: 88300, tier: 'Platinum' } },
  { name: 'Hyatt app, light tan Explorist', w: 1170, h: 1500,
    text: [t('World of Hyatt', 60, 130, 52, 700), t('Explorist', 60, 260, 52, 700, '#c5a572'), t('Points', 60, 430, 36, 400, '#444'),
      t('41,200', 60, 530, 100, 700)],
    expect: { program: 'Hyatt', balance: 41200, tier: 'Explorist' } },
  { name: 'Aeroplan app, red 75K', w: 1170, h: 1500,
    text: [t('Aeroplan', 60, 130, 56, 700), t('Hi Chris', 60, 230, 40), t('75K', 60, 330, 60, 700, '#d22630'),
      t('Points', 60, 520, 36, 400, '#444'), t('112,400', 60, 620, 100, 700)],
    expect: { program: 'Aeroplan', balance: 112400, tier: '75K' } },
  { name: 'Best Western app, gold Diamond and a yellow offer banner', w: 1170, h: 1600, rects: [[0, 900, 1170, 220, '#ffd200']],
    text: [t('Best Western Rewards', 60, 130, 52, 700, '#003c7e'), t('Welcome, Taylor', 60, 230, 40), t('Diamond', 60, 330, 60, 700, '#b8962e'),
      t('Points', 60, 520, 36, 400, '#444'), t('56,780', 60, 620, 100, 700), t('Double points this fall', 60, 990, 44, 700, '#111'),
      t('Stay twice, get 2x on every stay', 60, 1060, 32, 400, '#111')],
    expect: { program: 'Best Western', balance: 56780, tier: 'Diamond' } },
  { name: 'United app, light gold Premier Gold beside the balance', w: 1170, h: 1300,
    text: [t('MileagePlus', 60, 130, 52, 700, '#0c2340'), t('Hi, Sam', 60, 230, 40), t('84,615', 60, 430, 110, 700), t('Premier Gold', 600, 410, 44, 700, '#d8b45a'),
      t('Available miles', 60, 500, 36, 400, '#444')],
    expect: { program: 'United', balance: 84615, tier: 'Premier Gold' } },
  // Pale levels that aren't the one held: a ladder, a next level, an offer. No level.
  { name: 'Hyatt app, no level yet, a pale ladder of levels', w: 1170, h: 1400,
    text: [t('World of Hyatt', 60, 130, 52, 700), t('Hi, Riley', 60, 230, 40), t('Member', 60, 320, 52, 700),
      t('Discoverist', 60, 460, 32, 400, '#c8c8c8'), t('Explorist', 470, 460, 32, 400, '#c8c8c8'), t('Globalist', 860, 460, 32, 400, '#c8c8c8'),
      t('Points', 60, 640, 36, 400, '#444'), t('14,200', 60, 740, 100, 700)],
    expect: { program: 'Hyatt', balance: 14200, tier: null } },
  { name: 'IHG app, club member, pale next level and a card offer', w: 1170, h: 1400,
    text: [t('IHG One Rewards', 60, 130, 52, 700), t('Hello Sam', 60, 230, 40), t('Club Member', 60, 320, 52, 700),
      t('12 nights to Silver Elite', 60, 400, 34, 400, '#bbbbbb'), t('Points', 60, 560, 36, 400, '#444'), t('22,150', 60, 660, 100, 700),
      t('Earn Gold Elite with the IHG card', 60, 840, 34, 400, '#c0c0c0')],
    expect: { program: 'IHG', balance: 22150, tier: null } },
  { name: 'Marriott app, member, a pale orange status match offer', w: 1170, h: 1400,
    text: [t('MARRIOTT BONVOY', 60, 120, 48, 700), t('Member', 60, 260, 56, 700), t('Status match to Gold Elite', 60, 340, 36, 400, '#f0a868'),
      t('9,400', 60, 520, 96, 700), t('Points', 60, 580, 34, 400, '#444')],
    expect: { program: 'Marriott', balance: 9400, tier: null } },
  { name: 'Hertz app, yellow card with black Five Star, pale goal', w: 1170, h: 1400, rects: [[40, 240, 1090, 300, '#ffd200']],
    text: [t('Hertz', 60, 130, 60, 700), t('Gold Plus Rewards®', 80, 320, 44, 700), t('Five Star', 80, 420, 56, 700),
      t('9 of 15 rentals to President’s Circle', 60, 640, 34, 400, '#c8c8c8')],
    expect: { program: 'Hertz', balance: null, tier: 'Five Star' } },
  // Pages from the real reader's readings of fresh look-alikes (2026-11-01): each one was read wrong, or asked for no reason.
  { name: 'KrisFlyer app, dark type on a silver gradient card, expiring miles below', w: 1170, h: 1300, rects: [[66, 360, 1040, 400, ['#9aa0a6', '#d6d9dc']]],
    text: [t('KrisFlyer', 66, 200, 62, 700, '#00266b'), t('Mr Lee Chan · 8812345678', 66, 280, 42), t('Elite Silver', 114, 440, 42), t('Valid through 31 Jan 2028', 114, 490, 36),
      t('42,800', 114, 640, 108, 700), t('KrisFlyer miles', 114, 710, 39), t('Expiring soon', 66, 860, 42, 700), t('1,200 miles on 30 Apr 2027', 66, 920, 42), t('Elite miles', 66, 1040, 42, 700), t('18,500 of 25,000', 66, 1100, 42)],
    expect: { program: 'Singapore', balance: 42800, tier: 'Elite Silver' } },
  { name: 'SKYPASS web, a level’s threshold in miles, three captions over three values', w: 1280, h: 760,
    text: [t('KOREAN AIR', 40, 50, 22, 700, '#00256c'), t('My SKYPASS', 60, 130, 22, 600), t('SKYPASS No. KE 112233445566', 60, 170, 15), t('Morning Calm Club', 60, 220, 18, 600, '#00256c'),
      t('Available mileage', 60, 290, 14), t('Miles expiring Dec 31, 2027', 320, 290, 14), t('Accrued flight miles', 640, 290, 14), t('63,120', 60, 340, 38, 700), t('2,100', 320, 340, 38, 700), t('38,400', 640, 340, 38, 700),
      t('Morning Calm Premium Club at 500,000 miles', 60, 410, 15)],
    expect: { program: 'Korean Air', balance: 63120, tier: 'Morning Calm Club' } },
  { name: 'Southwest app, “A-List progress” and Companion Pass, no level held', w: 1170, h: 1500,
    text: [t('Rapid Rewards', 66, 200, 66, 700, '#304cb2'), t('41,200', 66, 370, 132, 700), t('points', 66, 430, 42), t('A-List progress', 66, 560, 45, 600), t('Tier qualifying points 18,400 of 35,000', 66, 620, 42),
      t('Qualifying flights 11 of 20', 66, 680, 42), t('Companion Pass', 66, 810, 45, 600), t('86,400 of 135,000 points', 66, 870, 42), t('48,600 to go', 66, 930, 42)],
    expect: { program: 'Southwest', balance: 41200, tier: null, counts: ['18,400 tier points', '11 flights'] } },
  { name: 'Iberia Club in Spanish, the next level named', w: 1170, h: 1300,
    text: [t('Iberia Club', 66, 200, 66, 700, '#d7192d'), t('Hola, Lucía', 66, 280, 45), t('Tarjeta Plata', 66, 360, 48, 600), t('Tus Avios', 66, 480, 39), t('18.300', 66, 600, 120, 700), t('Elite Points', 66, 700, 39),
      t('450', 66, 780, 72, 600), t('Te faltan 350 Elite Points para Oro', 66, 850, 39), t('Válida hasta 31/12/2027', 66, 920, 39)],
    expect: { program: 'Iberia', balance: 18300, tier: 'Plata' } },
  { name: 'Lufthansa in German, points for the next level beside the miles', w: 1440, h: 640, rects: [[0, 0, 1440, 80, '#05164d']],
    text: [t('Lufthansa', 40, 54, 26, 700, W), t('Miles & More', 1200, 50, 18, 400, W), t('Ihr Meilenkonto', 60, 150, 24), t('Senator · Gültig bis 31.03.2028', 60, 190, 16), t('Prämienmeilen', 60, 260, 14), t('Punkte für HON Circle Member', 420, 260, 14),
      t('210.000', 60, 310, 40, 700), t('12.550', 420, 310, 40, 700), t('Noch 7.450 Punkte bis zum nächsten Status', 60, 380, 15)],
    expect: { program: 'Lufthansa', balance: 210000, tier: 'Senator' } },
  { name: 'Flying Blue in French, spaced thousands', w: 1170, h: 1400,
    text: [t('Flying Blue', 66, 200, 66, 700, '#002157'), t('Bonjour Camille', 66, 280, 45), t('Gold', 66, 360, 54, 600), t('Solde de Miles', 66, 470, 39), t('78 450', 66, 590, 120, 700), t('Points d’expérience', 66, 680, 39), t('182 XP', 66, 760, 72, 600),
      t('98 XP pour atteindre Platinum', 66, 820, 39), t('Valable jusqu’au 30/04/2027', 66, 890, 39), t('Numéro Flying Blue 1234567890', 66, 950, 39)],
    expect: { program: 'Flying Blue', balance: 78450, tier: 'Gold' } },
  { name: 'Qatar web, Avios, Qpoints and Qpoints to Gold in a row', w: 1440, h: 560, rects: [[0, 0, 1440, 80, '#5c0632']],
    text: [t('QATAR AIRWAYS', 40, 54, 24, 700, W), t('Privilege Club', 60, 150, 24), t('Silver · Membership number 112233445', 60, 190, 15), t('Avios', 60, 260, 14), t('Qpoints', 280, 260, 14), t('Qpoints to Gold', 480, 260, 14), t('38,200', 60, 310, 40, 700), t('180', 280, 310, 40, 700), t('120', 480, 310, 40, 700)],
    expect: { program: 'Qatar', balance: 38200, tier: 'Silver' } },
  { name: 'IHG web, a wide row of captions over balance, nights and points', w: 1440, h: 560,
    text: [t('IHG One Rewards', 60, 50, 22, 700), t('Welcome, Sam', 60, 130, 26), t('Gold Elite · Member #210987654', 60, 170, 15), t('Point balance', 60, 240, 14), t('Qualifying nights', 330, 240, 14), t('Qualifying points', 560, 240, 14), t('184,210', 60, 295, 42, 700), t('18', 330, 295, 42, 700), t('22,400', 560, 295, 42, 700),
      t('22 more nights or 37,600 more points to reach Platinum Elite', 60, 360, 15)],
    expect: { program: 'IHG', balance: 184210, tier: 'Gold Elite', counts: ['18 nights'] } },
  { name: 'American web, tier widget with four big numbers', w: 1440, h: 700, rects: [[0, 0, 1440, 80, '#0078d2']],
    text: [t('American Airlines', 40, 54, 24, 700, W), t('Hi, Casey', 60, 140, 24), t('Award miles', 60, 210, 14), t('Lifetime miles', 320, 210, 14), t('61,040', 60, 260, 40, 700), t('412,905', 320, 260, 40, 700), t('Platinum', 60, 340, 18, 600), t('Your status through Mar 31, 2028', 60, 370, 14),
      t('Loyalty Points', 60, 430, 14), t('Next level', 480, 430, 14), t('Points to go', 900, 430, 14), t('82,350', 60, 475, 28, 700), t('125,000', 480, 475, 28, 700), t('42,650', 900, 475, 28, 700)],
    expect: { program: 'American', balance: 61040, tier: 'Platinum', counts: ['82,350 Loyalty Points'] } },
  { name: 'Chase, two cards each with its own points: the card asks', w: 1440, h: 620,
    text: [t('CHASE', 40, 50, 24, 700, '#117aca'), t('Sapphire Reserve (...4821)', 60, 130, 18, 600), t('Ultimate Rewards', 60, 160, 15), t('84,210 pts', 60, 210, 34, 700), t('Freedom Unlimited (...9033)', 60, 300, 18, 600), t('Ultimate Rewards', 60, 330, 15), t('12,345 pts', 60, 380, 34, 700)],
    expect: { program: 'Chase', balance: 84210, ask: true } },
  { name: 'Marriott household page, two members: the card asks', w: 1440, h: 520,
    text: [t('MARRIOTT BONVOY', 40, 50, 24, 700), t('Household accounts', 60, 120, 22, 600), t('Alex Rivera', 60, 180, 18, 600), t('Sam Rivera', 760, 180, 18, 600), t('Gold Elite · Member 123456789', 60, 210, 15), t('Silver Elite · Member 987654321', 760, 210, 15), t('41,200 points', 60, 270, 34, 700), t('12,800 points', 760, 270, 34, 700)],
    expect: { program: 'Marriott', balance: 41200, ask: true } },
  { name: 'United app, the first digit cut off at the left edge: the card asks', w: 1170, h: 1000,
    text: [t('MileagePlus', 66, 200, 66, 700, '#002244'), t('Premier Gold', 66, 280, 42), t('184,250', -108, 560, 168, 700), t('miles', 66, 640, 42)],
    expect: { program: 'United', balance: 84250, tier: 'Premier Gold', ask: true } },
  { name: 'Marriott app, a bank’s notification across the top', w: 1170, h: 1300, rects: [[30, 90, 1110, 170, '#e9e9ee']],
    text: [t('9:41', 84, 60, 45, 600), t('Chase · now', 66, 140, 39, 700), t('Your balance of $12,500 is due Nov 14. You earned 4,210 points.', 66, 200, 34), t('Marriott Bonvoy', 66, 380, 66, 600), t('Gold Elite', 66, 450, 45), t('48,320', 66, 620, 126, 700), t('Points', 66, 680, 42), t('Nights this year: 32', 66, 770, 42)],
    expect: { program: 'Marriott', balance: 48320, tier: 'Gold Elite', counts: ['32 nights'] } },
  { name: 'Aeroplan web, dark, points and SQC side by side, a transfer offer', w: 1440, h: 600, bg: D, ink: '#e6edf3',
    text: [t('Air Canada', 40, 50, 24, 700), t('Aeroplan', 60, 130, 24), t('50K · Aeroplan number 123 456 789', 60, 170, 15), t('Points balance', 60, 240, 14, 400, '#9aa'), t('SQC', 330, 240, 14, 400, '#9aa'), t('187,350', 60, 290, 40, 700), t('41,200', 330, 290, 40, 700), t('Transfer from Chase Ultimate Rewards at 1:1 and get a 30% bonus', 60, 360, 15)],
    expect: { program: 'Aeroplan', balance: 187350, tier: '50K', counts: ['41,200 SQC'] } },
  { name: 'Marriott on a big monitor, small type, partner rates in a sidebar', w: 1920, h: 700, rects: [[1580, 70, 340, 630, '#f5f5f5']],
    text: [t('MARRIOTT BONVOY', 40, 44, 22, 700), t('Welcome back, Dana', 80, 110, 15), t('Titanium Elite · Member number 123456789', 80, 135, 14), t('Points', 80, 180, 12), t('Nights', 260, 180, 12), t('250,145', 80, 215, 26, 700), t('76', 260, 215, 26, 700),
      t('Earn with partners', 1610, 110, 13, 700), t('Hertz: 500 points per rental', 1610, 135, 13), t('United Airlines: 1 mile per $1', 1610, 180, 13), t('Uber: 2 points per $1', 1610, 215, 13)],
    expect: { program: 'Marriott', balance: 250145, tier: 'Titanium Elite', counts: ['76 nights'] } },
  { name: 'Hyatt app, a bold 5 in the balance', w: 1170, h: 1400,
    text: [t('World of Hyatt', 66, 200, 60), t('Discoverist', 66, 280, 45), t('54,320', 66, 470, 132, 700), t('Current points', 66, 530, 42), t('Tier progress', 66, 650, 42, 600), t('18 of 30 Qualifying nights', 66, 710, 42), t('28,400 of 50,000 Base points', 66, 770, 42), t('12 nights to Explorist', 66, 830, 42)],
    expect: { program: 'Hyatt', balance: 54320, tier: 'Discoverist', counts: ['18 nights'] } },
  { name: 'Hilton app, dark type on a flat gray card', w: 1170, h: 1300, rects: [[66, 280, 1040, 390, '#b4b9be']],
    text: [t('Hilton Honors', 66, 200, 66, 700, '#104c97'), t('Gold Member', 114, 360, 48, 600), t('152,310', 114, 530, 114, 700), t('Points', 114, 600, 39), t('Nights this year 21', 66, 760, 42), t('Stays this year 8', 66, 820, 42)],
    expect: { program: 'Hilton', balance: 152310, tier: 'Gold', counts: ['21 nights'] } },
  { name: 'Etihad web, a level as a tile’s value in a row of numbers', w: 1440, h: 520,
    text: [t('Etihad', 40, 50, 24, 700, '#6a5a3a'), t('Hello Sam', 60, 130, 26), t('Etihad Guest 501234567890', 60, 165, 14), t('Guest Miles', 60, 230, 14), t('Tier Miles', 300, 230, 14), t('Your tier', 560, 230, 14), t('33,420', 60, 285, 40, 700), t('18,000', 300, 285, 40, 700), t('Silver', 560, 285, 40, 700), t('of 25,000 to retain', 300, 320, 13)],
    expect: { program: 'Etihad', balance: 33420, tier: 'Silver' } },
  { name: 'JAL app, a second points number with its own caption', w: 780, h: 1100,
    text: [t('JAL Mileage Bank', 44, 120, 40, 600, '#c00'), t('JMB Sapphire', 44, 170, 28), t('Available miles', 44, 260, 26), t('52,008', 44, 340, 72, 700), t('FLY ON Points', 44, 420, 26), t('38,200', 44, 480, 48, 600), t('JMB No. 301234567', 44, 560, 26)],
    expect: { program: 'JAL', balance: 52008, tier: 'JMB Sapphire' } },
  { name: 'Frontier app, dark, a level then two tiles', w: 1170, h: 1100, bg: D, ink: '#f1f3f5',
    text: [t('FRONTIER Miles', 66, 200, 72, 800, '#3fb56f'), t('Elite Silver', 66, 270, 42, 400, '#bbb'), t('Miles', 66, 400, 39, 400, '#bbb'), t('18,250', 66, 520, 120, 700), t('Elite Status Points', 66, 620, 39, 400, '#bbb'), t('12,500 / 20,000', 66, 700, 72, 600)],
    expect: { program: 'Frontier', balance: 18250, tier: 'Elite Silver' } },
  { name: 'Hyatt web, a sidebar beside tier progress', w: 1440, h: 700, rects: [[0, 0, 300, 700, '#1a2a44']],
    text: [t('World of Hyatt', 26, 50, 20, 400, W), t('Taylor Quinn', 26, 100, 14, 400, W), t('Globalist', 26, 122, 14, 400, W), t('Current points', 26, 200, 13, 400, W), t('91,450', 26, 240, 30, 400, W),
      t('My tier progress', 330, 60, 26), t('Qualifying nights: 41 of 60', 330, 100, 15), t('Base points: 62,300 of 100,000', 330, 128, 15), t('Earn 5,000 bonus points on your next stay', 330, 170, 15)],
    expect: { program: 'Hyatt', balance: 91450, tier: 'Globalist', counts: ['41 nights'] } },
];

export function draw(page, variant = {}) {
  const k = variant.scale || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(page.w * k);
  canvas.height = Math.round(page.h * k);
  const g = canvas.getContext('2d');
  g.scale(k, k);
  g.fillStyle = page.bg || W;
  g.fillRect(0, 0, page.w, page.h);
  for (const [x, y, w, h, color] of page.rects || []) {
    // Two colors: a gradient across the box.
    if (Array.isArray(color)) { const fill = g.createLinearGradient(x, y, x + w, y); fill.addColorStop(0, color[0]); fill.addColorStop(1, color[1]); g.fillStyle = fill; } else g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }
  for (const [text, x, y, size, weight, color, align] of page.text) {
    g.font = `${variant.light ? Math.min(weight, 300) : weight} ${size}px ${variant.font || 'Helvetica Neue, Arial'}`;
    g.fillStyle = color || page.ink || '#111';
    g.textAlign = align;
    g.fillText(text, x, y);
  }
  return canvas;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pastes one page and reads the result card, then closes it without applying anything.
export async function scan(page, variant = {}) {
  const blob = await new Promise((resolve) => draw(page, variant).toBlob(resolve, variant.jpeg ? 'image/jpeg' : 'image/png', variant.jpeg));
  const data = new DataTransfer();
  data.items.add(new File([blob], 'lookalike', { type: blob.type, lastModified: Date.now() }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  let title = '';
  for (let i = 0; i < 600; i++) {
    await pause(250);
    title = document.querySelector('#play-title').textContent;
    if (/^Found|^New program|up to date|Which program|Couldn|looks like|no points or status|^These/.test(title)) break;
  }
  document.querySelector('#play').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); // no automatic update
  // A row's lines; innerText drops them when the page isn't being laid out (tabs switching), so its pieces then.
  const pieces = (li) => { const out = []; const walk = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) out.push(walk.currentNode.nodeValue.trim()); return out.join(' | '); };
  const rows = [...document.querySelectorAll('#play-loot li')].map((li) => (li.innerText.includes('\n') ? li.innerText.replace(/\n+/g, ' | ') : pieces(li)));
  document.querySelector('#play-close').click();
  await pause(300);
  const balance = rows.map((r) => /^([\d,]+) (?:points|miles|avios)/i.exec(r)).find(Boolean);
  const status = rows.find((r) => /\| Status/.test(r));
  const got = { title, flagged: rows.some((r) => /^Check this first/.test(r)) || /Which program/.test(title),
    member: (rows.find((r) => /Member number/.test(r)) || '').match(/•+ *(\w{4})/)?.[1] || null,
    balance: balance ? Number(balance[1].replace(/,/g, '')) : null, tier: status ? status.split(' | ')[0] : null,
    counts: rows.filter((r) => !/Balance|\| Status|Member number|On your list|Adding it|Check this/.test(r)).map((r) => r.split(' | ')[0]) };
  const e = page.expect;
  // A page with several statuses (a card's benefits page): every program named, each with its level.
  if (e.many) {
    const ok = /^Found \d+ status(?:es)?|^These \d+ statuses/.test(title) && e.many.every((name) => rows.some((r) => r.startsWith(`${name} |`) || r.includes(`| ${name} |`)));
    return { name: page.name, ok, silentlyWrong: !ok && !got.flagged, got: { ...got, rows } };
  }
  // `ask`: the page can't be read for sure (two balances, a number cut off), so a right card still has to ask.
  const ok = title.includes(e.program) && got.balance === e.balance && (e.tier === undefined || got.tier === e.tier)
    && (e.member === undefined || got.member === e.member)
    && (e.counts || []).every((c) => got.counts.includes(c)) && (!e.ask || got.flagged);
  // Wrong without saying so is the failure that matters: a flagged card waits for you to check it.
  return { name: page.name, ok, silentlyWrong: !ok && !got.flagged, got };
}

export const results = [];
export async function run(list = pages, variant = {}) {
  results.length = 0;
  results.done = false;
  for (const page of list) results.push(await scan(page, variant));
  results.done = true;
  return results;
}

// A test browser's tracker with every program above on the list (replaces what's saved here).
export function setUp() {
  localStorage.setItem('status-tracker-v2', JSON.stringify({ programs: programs.map(([id, name, unit = 'points']) => ({ id, name, unit, status: [] })),
    cards: [], balances: {}, vouchers: [], game: { xp: 100, scans: 3, best: 1, weeks: [], badges: {}, confirmed: {}, log: [] } }));
  location.reload();
}
