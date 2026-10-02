# Points & Status Tracker

A personal airline and hotel loyalty tracker: point balances, elite status and progress toward the next level, what each status gets you, and reminders before statuses, points, vouchers, or card annual fees come due. One self-contained `index.html`, no frameworks or external requests, and it works offline once loaded.

**Live app:** https://statuspoints.github.io/

## Use it on your phone

Open the site in your phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app** (or **Add to Home screen**)

It launches full-screen from the home screen and works with no network. The app shows a one-time tip with these steps (or an **Install** button where the browser supports it) until you install it or dismiss the tip.

## Make it yours

**Update from a screenshot:** tap the **Update from a screenshot** card above the list (or **Start from a screenshot** when setting up) and choose a screenshot of your account page from an airline, hotel, or card app or website. On a computer you can also drop a screenshot anywhere on the page or paste one (⌘V / Ctrl+V). The app reads it on your device; the image is never uploaded. The first time, the open-source Tesseract text reader (about 6 MB) downloads from jsDelivr. It works out the program and reads the balance, status and its end date, this year's progress (MQDs, nights, stays, PQP and flights, Loyalty Points, tier points, status points, SQC), and member number. It recognizes 50+ programs: every airline, hotel, and card program in the app, including Emirates, Singapore, Qatar, Turkish, Lufthansa, Cathay, Qantas, ANA, JAL, Avianca, Etihad, Iberia, Aer Lingus, Aeromexico, LATAM, Frontier, Best Western, Sonesta, I Prefer, Shangri-La, Wells Fargo, U.S. Bank, and Bank of America. It also handles values printed above or below their labels, "8 of 25" targets, lifetime totals, day-first dates on European sites, and common misreads. If it can't tell the program, pick it from the list. You review it all next to a preview of your screenshot, adjust anything misread, and tap **Update** (with Undo). You can also paste text copied from a screenshot (on iPhone, press and hold the text in Photos).

**Scan & collect (the game):** a screenshot opens on a card that scans it with a moving beam, boxes what it found on the image (program, balance, status, counts), and lists the loot with what changes ("+2,400", "New status!", "No change"). **Collect** happens by itself after 4 seconds (tap anywhere on the card to pause, or **Fix something** to review). The points then fly into the program's row, the balance counts up, and a status upgrade or a new program sets off confetti. Each collect earns XP (10, +5 per thing updated, +25 for a new program, +40 for a new status) toward 10 levels from Rookie to Legend. Any update counts toward a **weekly streak**, and **up to date** counts balances updated in the last 30 days. There are 11 **badges** (First scan, Six figures, All caught up, On a roll, and more), worth 50 XP each. Tap the level, streak, or up-to-date chip under the screenshot card to see **Your progress**: your level, which balances need an update, and every badge.

**Simple or Detailed:** above the list, **Simple** shows just each program, your highest status with its end date, and your balance. **Detailed** adds perks, progress, and the Medallion tracker. **Type balances** opens one screen with every balance (and Delta MQDs) to type in and save at once.

The first time you open it, pick the programs you have and, optionally, the credit cards you hold (or tap **Use the example setup**). Tap **Edit** on the program list anytime to add, rename, reorder, or delete programs, set your own status levels and where they come from, and write a note under the list. Tap any number to update a balance.

### Knowing your perks

- **Under every status** in the list, a one-line summary of what it gets you (e.g. "✓ Breakfast / F&B credit · Room upgrades · 80% bonus") — for your highest level in that program.
- **Your perks** (the **Perks** button, or tap the Elite statuses tile): every benefit across all your statuses in one place, grouped into Food & breakfast, Lounges, Upgrades, Check-in & checkout, Airport/seats/bags, Bonus points & miles, Car rental, and more. Search it ("breakfast", "late checkout", "lounge") to see which status covers you; tap a source to open that program.

### Progress toward status

- **Delta:** type your MQDs for the year. The row shows the Medallion you've earned, e.g. "Gold Medallion · earned in 2026 · thru 1/31/28" (Delta status earned in a year lasts through January 31 two years later). If you still hold a higher tier from last year, add it with Edit, for example "Platinum Medallion" expiring Jan 31. The bar then shows what it takes to keep it ("10,000 to keep Platinum"). **Plan ahead** previews expected MQDs; if you hold a Delta Platinum or Reserve card, a second slider converts planned card spend at its MQD Boost rate ($20 or $10 per MQD). It tells you whether that gets you a new tier, requalifies the one you hold, or how far short you'd be.
- **Hilton, Marriott, IHG, Hyatt, Wyndham, United, American, Southwest, Alaska Atmos, and Aeroplan:** open the program and tap the number in its progress section (e.g. **2026 progress**) to enter this year's nights, PQP, Loyalty Points, tier points, status points, or SQC. The row shows "42 nights · 8 to Platinum". Once you reach a level, it counts as your status with its real end date, for example "Platinum Elite · earned in 2026 · thru 2/28/28". Levels that also need spend (Hilton Diamond Reserve, Marriott Ambassador) are never awarded from a count alone.
- **Second ways to qualify:** Hilton (stays), IHG (qualifying points), Hyatt (base points), Southwest (one-way flights), and United (Premier qualifying flights plus a lower PQP) have a second counter under the first. A level counts once either path reaches it, and the progress line shows both, e.g. "7 nights (or 3 stays) to Gold".
- **Keeping what you have:** if you hold a level from last year that this year's count hasn't re-earned, progress shows "8 nights to keep Platinum" (Delta: "$1,000 to keep Gold"). In the last 100 days of the qualifying year, **Coming up** lists each status you're still short of keeping.
- **New qualifying year:** counts start over (American's year starts March 1; the others January 1). Anything you earned with last year's count stays on your list as a status with its end date, so it keeps counting and gets reminders.

| Program | Counted in | Status earned in 2026 lasts through |
| --- | --- | --- |
| Delta | MQDs | Jan 31, 2028 |
| United | PQP | Jan 31, 2028 |
| American | Loyalty Points (Mar–Feb year) | Mar 31, 2028 (for Mar 2026–Feb 2027) |
| Southwest, Alaska, Aeroplan | tier points, status points, SQC | Dec 31, 2027 |
| Hilton | nights | Mar 31, 2028 |
| Marriott, Hyatt | nights | end of Feb 2028 |
| IHG, Wyndham | nights | Dec 31, 2027 |

### What your points are worth

Each balance shows an estimated dollar value ("points · ≈ $480"), and **≈ $4,820 in points & miles** under the Programs heading opens a breakdown. Estimates use The Points Guy's September 2026 valuations of what points are typically worth when redeemed well (cash back is usually less). Set your own value in any program's details, or turn dollar values off at the bottom (**Dollar values: Hide**). Programs with no published value, like Korean Air, count only once you add one.

### Transfer partners

Open Amex Membership Rewards, Chase Ultimate Rewards, Citi ThankYou, Capital One, or Bilt to see every airline and hotel their points transfer to, with ratios (as of September 2026). Programs on your list come first, with what your balance would become ("120,000 → 240,000 points" to Hilton), and tapping one opens it. Each airline and hotel shows **Top up with card points**: which banks feed it and how much you have. Notes cover the fine print, like Chase transfers needing a Sapphire or Ink Preferred, Chase-to-Hyatt dropping to 4:3 on the Sapphire Preferred and Ink Preferred from Oct 1, 2026, and Citi's lower ratios on no-fee cards.

### Points that expire

Each program's details say whether its points or miles expire (as of September 2026):

- **Never:** Delta, United, Southwest, Alaska Atmos, JetBlue, Virgin Atlantic; card points (Amex, Chase, Capital One, Citi) while the card account is open.
- **After inactivity:** IHG and Accor 12 months; Aeroplan, Wyndham, Choice, and Bilt 18 months; American, Flying Blue, Hilton, Marriott, and Hyatt 24 months; British Airways 36 months. Add your last activity date to see "Safe until…". Changing a balance counts as activity automatically. When the date is within 90 days, it shows in **Coming up** and the calendar export.
- **Exemptions it knows about:** elite status keeps IHG, Aeroplan, and Choice points alive. The AAdvantage Executive, Chase Aeroplan, and Wyndham Earner Premier cards do the same for their programs. Aeroplan's expiration is paused until Nov 30, 2026.
- **Fixed dates:** Korean Air miles expire 10 years after they're earned, and Wyndham points 4 years after, whatever your activity. Check those programs' statements.

### Expiration dates & reminders

- Add an expiration date to any status from its detail sheet (**Add date**) or in **Edit**. Statuses noted "thru 12/31/27" (like IHG Platinum from the Sapphire Reserve) get their date automatically.
- **Coming up** at the top lists statuses expiring within 90 days and vouchers within 60 (plus anything that lapsed in the last month). Rows show "48 days left" or "Expired"; expired statuses stop counting as elite. A status you keep anyway (you've requalified, or a card gives the same level) is left out, so reminders are only for things you'd actually lose.
- Statuses with a far-off end date show it on the row ("thru 2/28/28").
- **Add to calendar** saves every upcoming expiration as calendar events with alerts 30 days before, 7 days before, and on the day (9 a.m.) — real reminders even when the app is closed. On iPhone it opens straight into Calendar; elsewhere it downloads a `.ics` file to open.
- On devices that support it, the installed app's icon shows a badge for anything due within 30 days.

### Getting around

- **Tap a program** to open its details:
  - **What your status gets you:** headline perks for your level and what it normally takes to earn or keep it.
  - **All levels** in the program, with yours marked and the next one up opened, so you can see what you'd gain.
  - **Your member number:** masked on screen, with Show and Copy for check-in or booking.
  - **Notes:** anything worth remembering for that program ("2 suite night awards left"), included in the text export.
  - When you last updated the balance, plus a link to the program's website. After a couple of updates, a small trend line shows the balance over time ("+12,000 points since Mar 2").
  - Perks cover Delta, United, American, Southwest, Alaska Atmos, Aeroplan, Hilton, Marriott, IHG, Hyatt, Wyndham, Leading Hotels, Omni, Avis, Hertz, and National (as of September 2026).
- **Filter chips** above the list show All, Elite (programs where you hold status), Airlines, Hotels, Points, or Cars & lounges.
- **Header tiles** are tappable: Elite statuses filters the list, Medallion jumps to your Delta progress, Vouchers jumps to your vouchers.
- **Plan ahead** (under the Medallion bar): drag to add expected MQDs (and Delta card spend) and see which tier you'd reach or keep. It's a preview only and isn't saved.
- **Appearance** at the bottom: Auto (follows your device), Light, or Dark.
- A balance you haven't updated in 4+ months shows how old it is ("· 5 mo old") so you know to refresh it.
- Reaching a new level, whether a Medallion tier or one earned from a progress count, gets a little confetti. All motion is skipped if your device has Reduce Motion on.

### Card presets

Pick your cards (setup screen, or **Edit → Choose cards**) and the complimentary statuses and lounge access they come with are filled in automatically, adding programs like Avis or National if needed. Tap a card again to take its statuses off; statuses you typed yourself are never touched. Presets cover 61 cards from Amex (including every Delta SkyMiles card), Chase, Capital One, Citi, Barclays, Bilt, Bank of America, and Wells Fargo — searchable in the picker — based on published benefits as of September 2026. Cards with no elite status (e.g. Sapphire Preferred, Venture) are included so everyone can find theirs (`CARDS` in `index.html`). Statuses you only unlock by spending are left out, and most card statuses need enrolling with the issuer.

**Annual fee dates:** under the card picker, add the date each card's annual fee posts (it's on your statement). **Coming up** shows it 60 days ahead with what depends on the card ("6 statuses and lounge access depend on it"), and **Add to calendar** adds a yearly event with alerts 30 and 7 days before, so you can decide whether to keep the card before the fee hits.

## Card credits and certificates

- **Card credits:** for each card you hold, a **Card credits** section lists its statement credits (verified September 2026), such as Amex Platinum's $100 quarterly Resy credit or the Sapphire Reserve's $300 travel credit. Tap **Mark used** once you've used one. It resets on its own when the period ends: month, quarter, half-year, calendar year, or card year (from your annual fee date). Unused quarterly, half-year, and yearly credits show in **Coming up** in their last three weeks. Hide credits you don't use, and **Add a credit** for any card the app doesn't list.
- **Free nights and companion certificates:** under Vouchers, **From your cards** offers one-tap entries for the certificates your cards issue (Hilton, Marriott, IHG, and Hyatt free nights; Delta companion certificates; Atmos companion awards; United award discounts). It fills in what the certificate covers and a 12-month expiration to adjust, so it gets a reminder like any voucher.

## Sharing a device

Everyone who opens the site on their own phone gets their own tracker automatically. To share one device (a family iPad, say), tap **Add a person** at the bottom. Each person gets a completely separate tracker: programs, statuses, balances, cards, and reminders. Their name appears at the top; tap it to switch people, rename someone, or remove them (with Undo). Backups and exports cover whoever is showing and include their name in the file name.

## Moving to another device

**Send to another device** (at the bottom) makes a link that carries your whole tracker. Share it to yourself (Messages, AirDrop, email), open it on the other device, and choose **Add as another person** or **Replace the tracker on this device**. A device with nothing set up yet takes it right away. Nothing is uploaded: the data rides in the part of the link after `#`, which browsers never send to a server. The link includes member numbers, so only send it to yourself or someone you trust.

## Your data

Everything — your program list, statuses, balances, MQDs, and vouchers — is saved only in your browser's local storage (`status-tracker-v2`, plus `status-tracker-v2:<id>` for each extra person on the device) on that device. Nothing is uploaded, nothing syncs between devices, and each person who opens the site has their own separate tracker.

The app reminds you in **Coming up** to save a backup if you've never made one, or if your last one is two months old and your data has changed since.

Use **Export as text** at the bottom to save an easy-to-read `.txt` summary of your programs, balances, notes, statuses and their perks, progress, points expiration dates, vouchers, and cards with their annual fee dates. Use **Back up data** to save a backup file (on a phone it opens the share sheet — save it to Files or AirDrop it), and **Restore from backup** to load it on a new device. Deleting the home-screen app or clearing the browser's website data erases your data, so keep a backup.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (inline CSS + vanilla JS) |
| `manifest.json` | Install-to-home-screen metadata |
| `sw.js` | Service worker that caches the app for offline use |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App icons |
| `tests/` | Screenshot-reader test cases (`node tests/run-scan-tests.mjs`) |

## Updating

Edit and push. Installed copies load the cached version first and fetch the update in the background. When the new page differs (by ETag), open windows show "A new version is ready — Reload". Otherwise the update appears on the next launch. If you add or rename files, list them in `SHELL` in `sw.js` and bump `VERSION`.
