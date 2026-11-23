# LensFi — glanceable DeFi companion for Even G2

Even Realities "Heads Up" Hackathon entry (Crypto & DeFi track), by Diki Setiawan
(@dikaandrean69). Built from the official `even-realities/evenhub-templates/minimal`
scaffold; all app logic written fresh for this project.

## What it is

A read-only Even Hub plugin that puts a crypto watchlist on the lens:

| Screen | Content |
|---|---|
| 1 · Home | Watchlist BTC / ETH / BNB / SOL — price + 24h change, optional BSC wallet balance |
| 2 · Movers | Top 3 gainers / top 3 losers of the CoinGecko top 100 (24h) |
| 3 · AI Brief | One-screen digest. Default: deterministic template from live data, honestly labelled “auto brief (rules)”. Optional: Gemini summary when the user pastes their own free Gemini key in settings, labelled “AI brief (Gemini)” |
| 4 · Alerts | Any watched coin moving ±3% in 1h; press to acknowledge |

Gestures: swipe up/down = change screen · tap = refresh (Alerts: acknowledge) ·
double press = exit (calls `bridge.shutDownPageContainer(1)`).

## Data (all free, no key)

- CoinGecko public API v3 — `/coins/markets` (watchlist + top 100, 1h/24h change),
  refreshed every 60 s.
- BSC public RPC (`bsc-dataseed.binance.org`) for the optional wallet balance
  — off by default, address entered in settings on the phone.
- No trading, no signing, no wallet connection, no paid APIs.

## Run

```bash
npm install
npm run dev        # serves http://localhost:5173
npm run simulate   # Even Hub simulator (needs a display / Xvfb + WebKitGTK)
npm run build      # tsc --noEmit && vite build
npm run pack       # build + evenhub pack app.json dist -> .ehpk
```

Settings (Gemini key, BSC address) are entered on the phone-side page served
alongside the app and stored via the SDK local storage (falls back to
`window.localStorage` in preview mode). The Gemini key never leaves the device
except in the direct call to `generativelanguage.googleapis.com`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Phone-side page: live mirror of the glasses screen + settings form |
| `src/main.ts` | Bridge wiring, screens, gestures, 60 s refresh loop |
| `src/data.ts` | CoinGecko + BSC RPC fetching, formatting helpers |
| `src/screens.ts` | Pure screen renderers (576×288, ~400–500 chars each) |
| `src/brief.ts` | Deterministic rules brief + optional Gemini summary |
| `app.json` | Manifest: `id.dikaandrean69.lensfi`, name `LensFi` |

## What existed before Nov 23 (build-week disclosure)

Per the hackathon rules, this is what existed before the Nov 23–29 build week:

- The app itself (`src/main.ts`, `src/data.ts`, `src/screens.ts`, `src/brief.ts`,
  `index.html`, `app.json`) was written 18 Nov 2026 as prep, from the official
  `even-realities/evenhub-templates/minimal` scaffold. All app logic is fresh
  work for this project, not copied from another entry.
- The packaged `.ehpk` on disk is from that 18 Nov build.
- Built during build week (23 Nov onward): this disclosure, `DEMO.md`, the
  demo video assembled 23 Nov from the real 18 Nov simulator frames, and any
  further polish commits dated 23–29 Nov. No commit is backdated.

## Status / caveats

- Not yet submitted anywhere; no GitHub repo created (needs the user's login).
- Simulator screenshots: see `../screenshots/` (real simulator runs only).
