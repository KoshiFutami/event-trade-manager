import { InvestmentEvent, TradeLog, PortfolioSettings } from '@/types'

const KEYS = {
  events: 'etm_events',
  trades: 'etm_trades',
  settings: 'etm_settings',
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

export const storage = {
  getEvents: (): InvestmentEvent[] => load(KEYS.events, []),
  saveEvents: (events: InvestmentEvent[]) => save(KEYS.events, events),

  getTrades: (): TradeLog[] => load(KEYS.trades, []),
  saveTrades: (trades: TradeLog[]) => save(KEYS.trades, trades),

  getSettings: (): PortfolioSettings =>
    load(KEYS.settings, { totalAssets: 1000000, maxRiskPerTrade: 1 }),
  saveSettings: (settings: PortfolioSettings) => save(KEYS.settings, settings),
}
