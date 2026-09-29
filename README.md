# Points & Status Tracker

A personal airline and hotel loyalty tracker: point balances, elite status, Delta Medallion progress, and voucher expirations. One self-contained `index.html`, no frameworks or external requests, and it works offline once loaded.

**Live app:** https://statuspoints.github.io/

## Use it on your phone

Open the site in your phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app** (or **Add to Home screen**)

It launches full-screen from the home screen and works with no network.

## Make it yours

The first time you open it, pick the programs you have and, optionally, the credit cards you hold (or tap **Use the example setup**). Tap **Edit** on the program list anytime to add, rename, reorder, or delete programs, set your own status levels and where they come from, and write a note under the list. Tap any number to update a balance.

### Expiration dates & reminders

- Add an expiration date to any status from its detail sheet (**Add date**) or in **Edit**. Statuses noted "thru 12/31/27" (like IHG Platinum from the Sapphire Reserve) get their date automatically.
- **Coming up** at the top lists statuses expiring within 90 days and vouchers within 60 (plus anything that lapsed in the last month). Rows show "48 days left" or "Expired"; expired statuses stop counting as elite.
- **Add to calendar** saves every upcoming expiration as calendar events with alerts 30 days before, 7 days before, and on the day (9 a.m.) — real reminders even when the app is closed. On iPhone it opens straight into Calendar; elsewhere it downloads a `.ics` file to open.
- On devices that support it, the installed app's icon shows a badge for anything due within 30 days.

### Getting around

- **Tap a program** to open its details:
  - **What your status gets you:** headline perks for your level and what it normally takes to earn or keep it.
  - **All levels** in the program, with yours marked and the next one up opened, so you can see what you'd gain.
  - **Your member number:** masked on screen, with Show and Copy for check-in or booking.
  - When you last updated the balance, plus a link to the program's website.
  - Perks cover Delta, United, American, Southwest, Alaska Atmos, Aeroplan, Hilton, Marriott, IHG, Hyatt, Wyndham, Leading Hotels, Omni, Avis, Hertz, and National (as of September 2026).
- **Filter chips** above the list show All, Elite (programs where you hold status), Airlines, Hotels, Points, or Cars & lounges.
- **Header tiles** are tappable: Elite statuses filters the list, Medallion jumps to your Delta progress, Vouchers jumps to your vouchers.
- **Plan ahead** (under the Medallion bar): drag the slider to add expected MQDs and see which tier you'd reach. It's a preview only and isn't saved.
- Reaching a new Medallion tier gets a little confetti. All motion is skipped if your device has Reduce Motion on.

### Card presets

Pick your cards (setup screen, or **Edit → Choose cards**) and the complimentary statuses and lounge access they come with are filled in automatically, adding programs like Avis or National if needed. Tap a card again to take its statuses off; statuses you typed yourself are never touched. Presets cover 60 cards from Amex (including every Delta SkyMiles card), Chase, Capital One, Citi, Barclays, Bilt, Bank of America, and Wells Fargo — searchable in the picker — based on published benefits as of September 2026. Cards with no elite status (e.g. Sapphire Preferred, Venture) are included so everyone can find theirs (`CARDS` in `index.html`). Statuses you only unlock by spending are left out, and most card statuses need enrolling with the issuer.

## Your data

Everything — your program list, statuses, balances, MQDs, and vouchers — is saved only in your browser's local storage (`status-tracker-v2`) on that device. Nothing is uploaded, nothing syncs between devices, and each person who opens the site has their own separate tracker.

Use **Export as text** at the bottom to save an easy-to-read `.txt` summary of your programs, balances, statuses, Medallion progress, vouchers, and cards. Use **Back up data** to save a backup file (on a phone it opens the share sheet — save it to Files or AirDrop it), and **Restore from backup** to load it on a new device. Deleting the home-screen app or clearing the browser's website data erases your data, so keep a backup.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (inline CSS + vanilla JS) |
| `manifest.json` | Install-to-home-screen metadata |
| `sw.js` | Service worker that caches the app for offline use |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App icons |

## Updating

Edit and push. Installed copies load the cached version first and fetch the update in the background, so changes appear on the second launch after a deploy. If you add or rename files, list them in `SHELL` in `sw.js` and bump `VERSION`.
