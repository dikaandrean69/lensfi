# LensFi demo

How to show LensFi on Even G2 glasses, and what the draft demo video covers.

## The draft video

`../lensfi-demo-draft.mp4` — 61 seconds, 1152×640, H.264, silent (no narration).
It is **not** in this git repo (large binary); the file lives one directory up,
next to this repo.

The video is assembled from frames of the real Even Hub simulator run on
18 Nov 2026 (`../screenshots/10–15-*-v2-onblack.png`). Prices shown are the
prices at capture time (e.g. BTC $63,605) — not live prices. It is a draft:
review it before using it for submission, and re-record with narration if
wanted.

Sequence (each segment captioned):

1. Title card
2. Home — watchlist BTC / ETH / BNB / SOL, price + 24h change
3. Movers — top 3 gainers / top 3 losers of the CoinGecko top 100 (24h)
4. AI Brief — one-screen digest (rules brief by default; Gemini summary only
   when the user pastes their own free Gemini key in settings)
5. Alerts — watched coins moving ±3% in 1h
6. Wrap-around navigation (swipe past screen 4 returns to screen 1)
7. Tap refresh
8. End card

## Reproduce the demo live

```bash
npm install
npm run build      # tsc --noEmit && vite build
npm run simulate   # Even Hub simulator (needs a display / Xvfb + WebKitGTK)
npm run pack       # build + evenhub pack app.json dist -> out.ehpk
```

On the glasses (576×288 canvas, one full-screen text container):

- Swipe up / down — change screen (wraps around: 4 → 1, 1 → 4)
- Tap — refresh data (on Alerts: acknowledge all pending alerts)
- Double press — exit (calls `bridge.shutDownPageContainer(1)`)

Data during the demo:

- CoinGecko public API v3, no key, refreshed every 60 s
  (`/coins/markets`: watchlist + top 100, 1h/24h change).
- BSC wallet balance is off by default; it only appears after an address is
  entered in settings on the phone-side page.
- AI Brief is the deterministic rules brief by default, honestly labelled
  "auto brief (rules)"; the Gemini summary is optional and labelled
  "AI brief (Gemini)".
- Read-only: no trading, no signing, no wallet connection, no paid APIs.

The phone-side page (`index.html`) mirrors the glasses screen live and hosts
the settings form (Gemini key, BSC address), stored via the SDK local storage
(falls back to `window.localStorage` in preview mode).

## Dates (no backdating)

- App built 18 Nov 2026 as prep (commit `688df05`).
- This file added 23 Nov 2026, day 1 of the official build week (23–29 Nov).
- Submission closes 29 Nov 19:59 UTC = 30 Nov 02:59 WIB. Before submitting,
  re-check the DoraHacks rules on whether pre-build-week work is eligible.
