// LensFi screens — pure renderers for the 576x288 monochrome canvas.
// Budget: ~400-500 chars per screen, max 8 text containers per page
// (we use exactly 1 full-canvas text container per screen).

import { fmtBnb, fmtPct, fmtPrice, fmtTime } from './data'
import type { CoinQuote, MarketData } from './data'

export const SCREEN_NAMES = ['Home', 'Movers', 'AI Brief', 'Alerts'] as const
export type ScreenIndex = 0 | 1 | 2 | 3

export interface Alert {
  key: string
  symbol: string
  chg1h: number
  price: number
}

export function computeAlerts(watchlist: CoinQuote[]): Alert[] {
  return watchlist
    .filter(q => Math.abs(q.chg1h) >= 3)
    .map(q => ({ key: `${q.symbol}:${q.chg1h >= 0 ? 'up' : 'down'}`, symbol: q.symbol, chg1h: q.chg1h, price: q.price }))
}

function footer(screen: ScreenIndex, extra: string): string {
  return `[${screen + 1}/4 ${SCREEN_NAMES[screen]}] ${extra}`
}

function renderHome(data: MarketData | null, err: string | null): string {
  const head = 'LENSFI  •  WATCHLIST'
  if (err || !data) {
    return `${head}\n\n${err ? 'No live data yet.' : 'Loading prices…'}\n${err ?? ''}\n\n${footer(0, 'tap = retry')}`.trim()
  }
  const lines = data.watchlist.map(
    q => `${q.symbol} ${fmtPrice(q.price)}  ${fmtPct(q.chg24h)}`,
  )
  const wallet =
    data.bscBalanceBnb !== null
      ? `\nBSC wallet: ${fmtBnb(data.bscBalanceBnb)}`
      : ''
  return [
    head,
    ...lines,
    wallet,
    '',
    `${footer(0, 'swipe = screens')}`,
    `Updated ${fmtTime(data.fetchedAt)} · tap = refresh`,
  ]
    .filter(l => l !== '')
    .join('\n')
}

function renderMovers(data: MarketData | null, err: string | null): string {
  const head = 'MOVERS 24H  •  TOP 100'
  if (err || !data || data.movers.length === 0) {
    return `${head}\n\n${err ? 'No live data yet.' : 'Loading movers…'}\n\n${footer(1, 'tap = retry')}`.trim()
  }
  const sorted = [...data.movers].sort((a, b) => b.chg24h - a.chg24h)
  const gainers = sorted.slice(0, 3)
  const losers = sorted.slice(-3).reverse()
  const line = (q: CoinQuote) => `${q.symbol} ${fmtPct(q.chg24h)}`
  return [
    head,
    '▲ GAINERS',
    ...gainers.map(line),
    '▼ LOSERS',
    ...losers.map(line),
    footer(1, 'tap = refresh'),
    `Updated ${fmtTime(data.fetchedAt)}`,
  ].join('\n')
}

function renderBrief(
  data: MarketData | null,
  briefText: string,
  briefLabel: string,
  err: string | null,
): string {
  const head = `AI BRIEF  •  ${briefLabel}`
  if (err || !data) {
    return `${head}\n\n${err ? 'No live data yet.' : 'Loading brief…'}\n\n${footer(2, 'tap = retry')}`.trim()
  }
  return [head, '', briefText, '', footer(2, 'tap = refresh'), `Updated ${fmtTime(data.fetchedAt)}`].join('\n')
}

function renderAlerts(
  alerts: Alert[],
  acknowledged: Set<string>,
  data: MarketData | null,
  err: string | null,
): string {
  const head = 'ALERTS  •  ±3% in 1h'
  const pending = alerts.filter(a => !acknowledged.has(a.key))
  if (err || !data) {
    return `${head}\n\n${err ? 'No live data yet.' : 'Loading alerts…'}\n\n${footer(3, 'tap = retry')}`.trim()
  }
  if (pending.length === 0) {
    const note =
      alerts.length > 0 ? 'All alerts acknowledged.' : 'No coin moved ±3% in 1h.'
    return [head, '', note, '', footer(3, 'tap = refresh'), `Updated ${fmtTime(data.fetchedAt)}`].join('\n')
  }
  const lines = pending.map(a => `! ${a.symbol} ${fmtPct(a.chg1h)} in 1h (${fmtPrice(a.price)})`)
  return [head, '', ...lines, '', footer(3, 'tap = acknowledge'), `Updated ${fmtTime(data.fetchedAt)}`].join('\n')
}

export function renderScreen(
  screen: ScreenIndex,
  data: MarketData | null,
  briefText: string,
  briefLabel: string,
  alerts: Alert[],
  acknowledged: Set<string>,
  err: string | null,
): string {
  switch (screen) {
    case 0:
      return renderHome(data, err)
    case 1:
      return renderMovers(data, err)
    case 2:
      return renderBrief(data, briefText, briefLabel, err)
    case 3:
      return renderAlerts(alerts, acknowledged, data, err)
  }
}
