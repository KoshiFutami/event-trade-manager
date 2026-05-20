export type EventType = 'TOB' | 'MBO' | 'INDEX_IN' | 'INDEX_OUT' | 'IPO_LOCKUP' | 'EARNINGS' | 'OTHER'
export type Direction = 'LONG' | 'SHORT'
export type EventStatus = 'WATCHING' | 'ENTERED' | 'CLOSED' | 'PASSED'
export type TradeTag = 'TOB_ARBITRAGE' | 'INDEX_EVENT' | 'IPO_LOCKUP' | 'EARNINGS' | 'REBOUND' | 'OTHER'
export type TradeResult = 'WIN' | 'LOSS' | 'BREAK_EVEN' | 'OPEN'

export interface InvestmentEvent {
  id: string
  ticker: string
  companyName: string
  eventType: EventType
  eventDate: string
  description: string
  expectedDirection: Direction
  status: EventStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface TradeLog {
  id: string
  ticker: string
  companyName: string
  tag: TradeTag
  direction: Direction
  eventId?: string
  hypothesis: string
  entryDate: string
  exitDate?: string
  entryPrice: number
  exitPrice?: number
  lots: number
  plannedStopLoss: number
  plannedTarget: number
  result: TradeResult
  pnl?: number
  pnlPercent?: number
  ruleViolation: boolean
  violationNote?: string
  createdAt: string
}

export interface PortfolioSettings {
  totalAssets: number
  maxRiskPerTrade: number
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  TOB: 'TOB（公開買付）',
  MBO: 'MBO（経営陣買収）',
  INDEX_IN: 'インデックス採用',
  INDEX_OUT: 'インデックス除外',
  IPO_LOCKUP: 'IPOロックアップ解除',
  EARNINGS: '決算',
  OTHER: 'その他',
}

export const TRADE_TAG_LABELS: Record<TradeTag, string> = {
  TOB_ARBITRAGE: 'TOBサヤ取り',
  INDEX_EVENT: 'インデックスイベント',
  IPO_LOCKUP: 'IPOロックアップ',
  EARNINGS: '決算',
  REBOUND: 'リバウンド',
  OTHER: 'その他',
}
