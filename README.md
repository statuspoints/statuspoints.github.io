# Points & Status Tracker

A personal airline and hotel loyalty tracker: point balances, elite status, Delta Medallion progress, and voucher expirations. One self-contained `index.html`, no frameworks or external requests, and it works offline once loaded.

**Live app:** https://dannykcho.github.io/points-status-tracker/

## Use it on your phone

Open the site in your phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app** (or **Add to Home screen**)

It launches full-screen from the home screen and works with no network.

## Your data

Balances, MQDs, and vouchers are saved only in your browser's local storage (`status-tracker-v2`) on that device. Nothing is uploaded, and nothing syncs between devices. The status labels are hard-coded in `index.html`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (inline CSS + vanilla JS) |
| `manifest.json` | Install-to-home-screen metadata |
| `sw.js` | Service worker that caches the app for offline use |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App icons |

## Updating

Edit and push. Installed copies load the cached version first and fetch the update in the background, so changes appear on the second launch after a deploy. If you add or rename files, list them in `SHELL` in `sw.js` and bump `VERSION`.
