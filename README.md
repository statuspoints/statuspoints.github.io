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

### Card presets

Pick your cards (setup screen, or **Edit → Choose cards**) and the complimentary statuses and lounge access they come with are filled in automatically, adding programs like Avis or National if needed. Tap a card again to take its statuses off; statuses you typed yourself are never touched. Presets cover 39 cards from Amex (including every Delta SkyMiles card), Chase, Capital One, Citi, Barclays, and Bilt, based on published benefits as of September 2026 (`CARDS` in `index.html`). Statuses you only unlock by spending are left out, and most card statuses need enrolling with the issuer.

## Your data

Everything — your program list, statuses, balances, MQDs, and vouchers — is saved only in your browser's local storage (`status-tracker-v2`) on that device. Nothing is uploaded, nothing syncs between devices, and each person who opens the site has their own separate tracker.

Use **Back up data** at the bottom to save a backup file (on a phone it opens the share sheet — save it to Files or AirDrop it), and **Restore from backup** to load it on a new device. Deleting the home-screen app or clearing the browser's website data erases your data, so keep a backup.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (inline CSS + vanilla JS) |
| `manifest.json` | Install-to-home-screen metadata |
| `sw.js` | Service worker that caches the app for offline use |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App icons |

## Updating

Edit and push. Installed copies load the cached version first and fetch the update in the background, so changes appear on the second launch after a deploy. If you add or rename files, list them in `SHELL` in `sw.js` and bump `VERSION`.
