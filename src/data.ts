// LensFi data layer — free public APIs only, no keys, no signing.
// CoinGecko public API v3 (no key, ~5-15 calls/min) + BSC public RPC.

export interface CoinQuote {
  id: string
  symbol: string
  name: string
  price: number
  chg24h: number
  chg1h: number
}

export interface MarketData {
  watchlist: CoinQuote[]
  movers: CoinQuote[] // top 100 by market cap, as returned
  fetchedAt: Date
  bscBalanceBnb: number | null // null = wallet off / not set / fetch failed
}

export const WATCH_IDS = ['bitcoin', 'ethereum', 'binancecoin', 'solana'] as const
export const WATCH_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL'] as const

const CG = 'https://api.coingecko.com/api/v3'
const BSC_RPC = 'https://bsc-dataseed.binance.org/'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function toCoinQuote(raw: unknown): CoinQuote | null {
  if (!isRecord(raw)) return null
  const price = Number(raw.current_price)
  const chg24h = Number(raw.price_change_percentage_24h_in_currency ?? raw.price_change_percentage_24h)
  const chg1h = Number(raw.price_change_percentage_1h_in_currency ?? 0)
  if (!raw.id || !raw.symbol || !Number.isFinite(price) || !Number.isFinite(chg24h)) return null
  return {
    id: String(raw.id),
    symbol: String(raw.symbol).toUpperCase(),
    name: String(raw.name ?? raw.symbol),
    price,
    chg24h,
    chg1h: Number.isFinite(chg1h) ? chg1h : 0,
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return (await res.json()) as unknown
}

export async function fetchWatchlist(): Promise<CoinQuote[]> {
  const ids = WATCH_IDS.join(',')
  const url =
    `${CG}/coins/markets?vs_currency=usd&ids=${ids}` +
    `&price_change_percentage=1h,24h&per_page=4&page=1`
  const raw = await fetchJson(url)
  if (!Array.isArray(raw)) throw new Error('CoinGecko watchlist: unexpected payload')
  const byId = new Map<string, CoinQuote>()
  for (const item of raw) {
    const q = toCoinQuote(item)
    if (q) byId.set(q.id, q)
  }
  // Keep the canonical BTC/ETH/BNB/SOL order, drop any missing coin.
  return WATCH_IDS.map(id => byId.get(id)).filter((q): q is CoinQuote => q !== undefined)
}

export async function fetchTop100(): Promise<CoinQuote[]> {
  const url =
    `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc` +
    `&per_page=100&page=1&price_change_percentage=24h`
  const raw = await fetchJson(url)
  if (!Array.isArray(raw)) throw new Error('CoinGecko markets: unexpected payload')
  const out: CoinQuote[] = []
  for (const item of raw) {
    const q = toCoinQuote(item)
    if (q) out.push(q)
  }
  return out
}

export function isBscAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim())
}

export async function fetchBscBalanceBnb(address: string): Promise<number> {
  const res = await fetchJson(BSC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address.trim(), 'latest'],
      id: 1,
    }),
  })
  if (!isRecord(res) || typeof res.result !== 'string') {
    throw new Error('BSC RPC: unexpected payload')
  }
  const wei = BigInt(res.result)
  // wei -> BNB with 4 decimals, exact integer math (1 BNB = 1e18 wei).
  const scaled = (wei * 10000n) / 1000000000000000000n
  return Number(scaled) / 10000
}

export async function fetchMarketData(bscAddress: string | null): Promise<MarketData> {
  const [watchlist, movers] = await Promise.all([fetchWatchlist(), fetchTop100()])
  let bscBalanceBnb: number | null = null
  if (bscAddress && isBscAddress(bscAddress)) {
    try {
      bscBalanceBnb = await fetchBscBalanceBnb(bscAddress)
    } catch (err) {
      console.warn('BSC balance fetch failed:', err)
      bscBalanceBnb = null
    }
  }
  return { watchlist, movers, fetchedAt: new Date(), bscBalanceBnb }
}

// --- formatting helpers (shared by screens) ---

export function fmtPrice(n: number): string {
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US')
  if (n >= 1) return '$' + n.toFixed(2)
  return '$' + n.toFixed(4)
}

export function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function fmtBnb(n: number): string {
  // Tiny balances (the user's main wallet is ~0.00001 BNB) must not
  // round to 0.0000 — show up to 7 decimals, trimming trailing zeros.
  if (n === 0) return '0 BNB'
  if (n < 0.0001) return `${n.toFixed(7).replace(/0+$/, '').replace(/\.$/, '')} BNB`
  return `${n.toFixed(4)} BNB`
}

export function fmtTime(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
