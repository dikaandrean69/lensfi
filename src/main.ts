// LensFi — glanceable DeFi companion for Even G2 (Even Hub plugin).
// 4 screens on the 576x288 canvas: Home watchlist, Movers, AI Brief, Alerts.
// Data: CoinGecko free public API v3 (no key), refresh every 60 s.
// Optional BSC wallet balance via public RPC (off by default, address in settings).
// Read-only. No trading, no signing, no wallet connection, no paid APIs.
//
// SDK facts (from installed @evenrealities/even_hub_sdk 0.0.10 + template):
// - createStartUpPageContainer MUST be called first; rebuildPageContainer
//   swaps pages afterwards; textContainerUpgrade refreshes text in place.
// - Taps/double-taps/lifecycle arrive via event.sysEvent; scroll gestures
//   via event.textEvent. CLICK_EVENT is 0 and protobuf omits zero fields,
//   so a tap arrives as an envelope with eventType === undefined.
// - Double press must call bridge.shutDownPageContainer(1) (exit dialog).

import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { fetchMarketData, isBscAddress } from './data'
import type { MarketData } from './data'
import { buildRulesBrief, fetchGeminiBrief, GEMINI_LABEL, RULES_LABEL } from './brief'
import { computeAlerts, renderScreen } from './screens'
import type { Alert, ScreenIndex } from './screens'

const REFRESH_MS = 60_000
const BRIDGE_TIMEOUT_MS = 6_000
const MAX_SCREEN_CHARS = 500
const LS_GEMINI_KEY = 'lensfi.geminiKey'
const LS_BSC_ADDRESS = 'lensfi.bscAddress'

// --- state ---
let bridge: EvenAppBridge | null = null
let screen: ScreenIndex = 0
let data: MarketData | null = null
let loadError: string | null = null
let alerts: Alert[] = []
let acknowledged = new Set<string>()
let briefText = ''
let briefLabel = RULES_LABEL
let geminiKey = ''
let bscAddress = ''
let refreshTimer: ReturnType<typeof setInterval> | undefined

// --- bridge with timeout: in a plain browser / dev server there is no
// bridge, so fall back to a phone-side preview instead of hanging. ---
async function getBridge(): Promise<EvenAppBridge | null> {
  try {
    const timeout = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), BRIDGE_TIMEOUT_MS),
    )
    return await Promise.race([waitForEvenAppBridge(), timeout])
  } catch (err) {
    console.warn('Even bridge unavailable, running in preview mode:', err)
    return null
  }
}

async function storageGet(key: string): Promise<string> {
  if (bridge) {
    try {
      return (await bridge.getLocalStorage(key)) ?? ''
    } catch {
      return ''
    }
  }
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  if (bridge) {
    try {
      await bridge.setLocalStorage(key, value)
      return
    } catch {
      // fall through to window storage
    }
  }
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // storage unavailable; settings live in memory only
  }
}

// --- glasses rendering ---

function currentText(): string {
  return renderScreen(screen, data, briefText, briefLabel, alerts, acknowledged, loadError)
}

function mirrorToPhone(text: string): void {
  const mirror = document.getElementById('mirror')
  if (mirror) mirror.textContent = text
  const label = document.getElementById('screenLabel')
  if (label) label.textContent = `Screen ${screen + 1}/4 · ${['Home', 'Movers', 'AI Brief', 'Alerts'][screen]}`
}

function mainContainer(content: string): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: 1,
    containerName: 'main',
    content,
    isEventCapture: 1,
  })
}

// The page container never changes geometry (one full-canvas text
// container), so every update — screen switch or data refresh — goes
// through textContainerUpgrade. That avoids the rebuild gap during which
// the simulator drops inputs, and keeps the startup create call the only
// container creation.
async function pushToGlasses(): Promise<void> {
  const text = currentText()
  if (text.length > MAX_SCREEN_CHARS) {
    console.warn(`LensFi: screen ${screen} is ${text.length} chars (budget ${MAX_SCREEN_CHARS})`)
  }
  mirrorToPhone(text)
  if (!bridge) return
  try {
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: 1, containerName: 'main', content: text }),
    )
  } catch (err) {
    console.warn('LensFi: glasses push failed:', err)
  }
}

// --- data ---

async function refreshData(): Promise<void> {
  try {
    const fresh = await fetchMarketData(bscAddress || null)
    const prevAlertKeys = new Set(alerts.map(a => a.key))
    data = fresh
    loadError = null
    const nextAlerts = computeAlerts(fresh.watchlist)
    // A brand-new alert clears its old acknowledgement.
    for (const a of nextAlerts) {
      if (!prevAlertKeys.has(a.key)) acknowledged.delete(a.key)
    }
    alerts = nextAlerts
    briefText = buildRulesBrief(fresh)
    briefLabel = RULES_LABEL
    if (geminiKey) {
      const ai = await fetchGeminiBrief(geminiKey, fresh)
      if (ai) {
        briefText = ai
        briefLabel = GEMINI_LABEL
      }
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Fetch failed'
    console.warn('LensFi: data refresh failed:', err)
  }
  await pushToGlasses()
}

function setScreen(next: ScreenIndex): void {
  if (next === screen) return
  screen = next
  void pushToGlasses()
}

// --- events (same envelope rules as the official minimal template) ---

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

function onEvent(event: EvenHubEvent): void {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)

  // Double press: exit dialog — must work from every screen.
  if (
    sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
    textType === OsEventTypeList.DOUBLE_CLICK_EVENT
  ) {
    if (bridge) void bridge.shutDownPageContainer(1)
    return
  }

  // Swipe up = next screen, swipe down = previous screen (wrap around).
  if (sysType === OsEventTypeList.SCROLL_TOP_EVENT || textType === OsEventTypeList.SCROLL_TOP_EVENT) {
    setScreen(((screen + 1) % 4) as ScreenIndex)
    return
  }
  if (
    sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
    textType === OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    setScreen((((screen + 3) % 4) as ScreenIndex))
    return
  }

  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    if (screen === 3) {
      // Alerts screen: press acknowledges all pending alerts.
      for (const a of alerts) acknowledged.add(a.key)
      void pushToGlasses()
    } else {
      void refreshData()
    }
    return
  }

  if (
    sysType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
    sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
  ) {
    if (refreshTimer) clearInterval(refreshTimer)
  }
}

// --- phone-side settings UI (companion WebView) ---

function wireSettingsUi(): void {
  const keyInput = document.getElementById('geminiKey') as HTMLInputElement | null
  const addrInput = document.getElementById('bscAddress') as HTMLInputElement | null
  const saveBtn = document.getElementById('saveSettings')
  const status = document.getElementById('settingsStatus')
  if (keyInput) keyInput.value = geminiKey
  if (addrInput) addrInput.value = bscAddress
  if (!saveBtn) return
  saveBtn.addEventListener('click', () => {
    const key = keyInput?.value.trim() ?? ''
    const addr = addrInput?.value.trim() ?? ''
    if (addr && !isBscAddress(addr)) {
      if (status) status.textContent = 'BSC address looks invalid (0x + 40 hex chars). Not saved.'
      return
    }
    geminiKey = key
    bscAddress = addr
    void storageSet(LS_GEMINI_KEY, key)
    void storageSet(LS_BSC_ADDRESS, addr)
    if (status) {
      status.textContent =
        `Saved. ${key ? 'Gemini brief ON (your key, stored on device).' : 'Gemini brief OFF — rules brief.'}` +
        `${addr ? ' BSC balance ON.' : ' BSC balance OFF.'}`
    }
    void refreshData()
  })
}

// --- startup ---

async function main(): Promise<void> {
  bridge = await getBridge()
  geminiKey = (await storageGet(LS_GEMINI_KEY)).trim()
  bscAddress = (await storageGet(LS_BSC_ADDRESS)).trim()
  wireSettingsUi()

  // Show a loading screen immediately so the glasses are never blank.
  briefText = 'Loading prices…'
  if (bridge) {
    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [mainContainer(currentText())],
      }),
    )
    console.log('LensFi page created:', result === 0 ? 'success' : `failed (${result})`)
    bridge.onEvenHubEvent(event => onEvent(event))
  } else {
    mirrorToPhone(currentText())
    console.log('LensFi running in preview mode (no Even bridge).')
  }

  await refreshData()
  refreshTimer = setInterval(() => void refreshData(), REFRESH_MS)
}

void main()
