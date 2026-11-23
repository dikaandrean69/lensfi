// LensFi AI Brief — deterministic template from live data by default.
// Optional Gemini summary ONLY when the user pastes their own free Gemini
// API key in settings. No key = template brief, honestly labelled
// "auto brief (rules)". A failed Gemini call falls back to the template
// and says so; the brief never pretends to be AI when it is not.

import { fmtPct } from './data'
import type { MarketData } from './data'

export const RULES_LABEL = 'auto brief (rules)'
export const GEMINI_LABEL = 'AI brief (Gemini)'
export const GEMINI_MODEL = 'gemini-3.6-flash'

export function buildRulesBrief(data: MarketData): string {
  const btc = data.watchlist.find(q => q.symbol === 'BTC')
  const sorted = [...data.movers].sort((a, b) => b.chg24h - a.chg24h)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const up = data.watchlist.filter(q => q.chg24h >= 0).length
  const mood =
    btc === undefined
      ? 'Market mixed.'
      : btc.chg24h >= 1
        ? 'BTC leading up.'
        : btc.chg24h <= -1
          ? 'BTC dragging down.'
          : 'BTC flat.'
  const lines = [
    mood,
    btc ? `BTC ${fmtPct(btc.chg24h)} in 24h.` : '',
    top ? `Top mover: ${top.symbol} ${fmtPct(top.chg24h)}.` : '',
    bottom ? `Biggest drop: ${bottom.symbol} ${fmtPct(bottom.chg24h)}.` : '',
    `Watchlist: ${up}/${data.watchlist.length} coins up 24h.`,
    'Read-only glance. No trading.',
  ]
  return lines.filter(Boolean).join('\n')
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

/** One-shot Gemini summary of the same live data. Returns null on any failure. */
export async function fetchGeminiBrief(apiKey: string, data: MarketData): Promise<string | null> {
  const facts = data.watchlist
    .map(q => `${q.symbol} $${q.price} (${fmtPct(q.chg24h)} 24h, ${fmtPct(q.chg1h)} 1h)`)
    .join('; ')
  const sorted = [...data.movers].sort((a, b) => b.chg24h - a.chg24h)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const prompt =
    `Summarize this crypto market snapshot in at most 5 short lines, plain text, ` +
    `no markdown, no prices beyond what is given, no advice: ${facts}. ` +
    `Top 24h gainer: ${top ? `${top.symbol} ${fmtPct(top.chg24h)}` : 'n/a'}. ` +
    `Biggest 24h drop: ${bottom ? `${bottom.symbol} ${fmtPct(bottom.chg24h)}` : 'n/a'}.`
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 180, temperature: 0.3 },
        }),
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as GeminiResponse
    const text = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim()
    if (!text) return null
    // Keep it glasses-sized: max 5 lines, ~300 chars.
    return text.split('\n').filter(Boolean).slice(0, 5).join('\n').slice(0, 300)
  } catch {
    return null
  }
}
