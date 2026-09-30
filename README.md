# Points & Status Tracker

A personal airline and hotel loyalty tracker: point balances, elite status and progress toward the next level, what each status gets you, and reminders before statuses, points, vouchers, or card annual fees come due. One self-contained `index.html`, no frameworks or external requests, and it works offline once loaded.

**Live app:** https://statuspoints.github.io/

## Use it on your phone

Open the site in your phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app** (or **Add to Home screen**)

It launches full-screen from the home screen and works with no network. The app shows a one-time tip with these steps (or an **Install** button where the browser supports it) until you install it or dismiss the tip.

## Make it yours

The first time you open it, pick the programs you have and, optionally, the credit cards you hold (or tap **Use the example setup**). Tap **Edit** on the program list anytime to add, rename, reorder, or delete programs, set your own status levels and where they come from, and write a note under the list. Tap any number to update a balance.

### Knowing your perks

- **Under every status** in the list, a one-line summary of what it gets you (e.g. "✓ Breakfast / F&B credit · Room upgrades · 80% bonus") — for your highest level in that program.
- **Your perks** (the **Perks** button, or tap the Elite statuses tile): every benefit across all your statuses in one place, grouped into Food & breakfast, Lounges, Upgrades, Check-in & checkout, Airport/seats/bags, Bonus points & miles, Car rental, and more. Search it ("breakfast", "late checkout", "lounge") to see which status covers you; tap a source to open that program.

### Progress toward status

- **Delta:** type your MQDs for the year. The row shows the Medallion you've earned, e.g. "Gold Medallion · earned in 2026 · thru 1/31/28" (Delta status earned in a year lasts through January 31 two years later). If you still hold a higher tier from last year, add it with Edit, for example "Platinum Medallion" expiring Jan 31. The bar then shows what it takes to keep it ("10,000 to keep Platinum"). **Plan ahead** previews expected MQDs; if you hold a Delta Platinum or Reserve card, a second slider converts planned card spend at its MQD Boost rate ($20 or $10 per MQD). It tells you whether that gets you a new tier, requalifies the one you hold, or how far short you'd be.
- **Hilton, Marriott, IHG, Hyatt, Wyndham, United, American, Southwest, Alaska Atmos, and Aeroplan:** open the program and tap the number in its progress section (e.g. **2026 progress**) to enter this year's nights, PQP, Loyalty Points, tier points, status points, or SQC. The row shows "42 nights · 8 to Platinum". Once you reach a level, it counts as your status with its real end date, for example "Platinum Elite · earned in 2026 · thru 2/28/28". Levels that also need spend (Hilton Diamond Reserve, Marriott Ambassador) are never awarded from a count alone.
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
  - When you last updated the balance, plus a link to the program's website.
  - Perks cover Delta, United, American, Southwest, Alaska Atmos, Aeroplan, Hilton, Marriott, IHG, Hyatt, Wyndham, Leading Hotels, Omni, Avis, Hertz, and National (as of September 2026).
- **Filter chips** above the list show All, Elite (programs where you hold status), Airlines, Hotels, Points, or Cars & lounges.
- **Header tiles** are tappable: Elite statuses filters the list, Medallion jumps to your Delta progress, Vouchers jumps to your vouchers.
- **Plan ahead** (under the Medallion bar): drag to add expected MQDs (and Delta card spend) and see which tier you'd reach or keep. It's a preview only and isn't saved.
- Reaching a new level, whether a Medallion tier or one earned from a progress count, gets a little confetti. All motion is skipped if your device has Reduce Motion on.

### Card presets

Pick your cards (setup screen, or **Edit → Choose cards**) and the complimentary statuses and lounge access they come with are filled in automatically, adding programs like Avis or National if needed. Tap a card again to take its statuses off; statuses you typed yourself are never touched. Presets cover 61 cards from Amex (including every Delta SkyMiles card), Chase, Capital One, Citi, Barclays, Bilt, Bank of America, and Wells Fargo — searchable in the picker — based on published benefits as of September 2026. Cards with no elite status (e.g. Sapphire Preferred, Venture) are included so everyone can find theirs (`CARDS` in `index.html`). Statuses you only unlock by spending are left out, and most card statuses need enrolling with the issuer.

**Annual fee dates:** under the card picker, add the date each card's annual fee posts (it's on your statement). **Coming up** shows it 60 days ahead with what depends on the card ("6 statuses and lounge access depend on it"), and **Add to calendar** adds a yearly event with alerts 30 and 7 days before, so you can decide whether to keep the card before the fee hits.

## Sharing a device

Everyone who opens the site on their own phone gets their own tracker automatically. To share one device (a family iPad, say), tap **Add a person** at the bottom. Each person gets a completely separate tracker: programs, statuses, balances, cards, and reminders. Their name appears at the top; tap it to switch people, rename someone, or remove them (with Undo). Backups and exports cover whoever is showing and include their name in the file name.

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

## Updating

Edit and push. Installed copies load the cached version first and fetch the update in the background. When the new page differs (by ETag), open windows show "A new version is ready — Reload". Otherwise the update appears on the next launch. If you add or rename files, list them in `SHELL` in `sw.js` and bump `VERSION`.
