import { TradeLog, TradeTag } from '@/types'

export function calcMaxLots(
  totalAssets: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
): number {
  const riskAmount = (totalAssets * riskPercent) / 100
  const riskPerShare = Math.abs(entryPrice - stopLossPrice)
  if (riskPerShare <= 0) return 0
  return Math.floor(riskAmount / riskPerShare)
}

export function calcRiskReward(
  entryPrice: number,
  stopLossPrice: number,
  targetPrice: number,
  direction: 'LONG' | 'SHORT',
): number {
  const risk = Math.abs(entryPrice - stopLossPrice)
  const reward =
    direction === 'LONG'
      ? targetPrice - entryPrice
      : entryPrice - targetPrice
  if (risk <= 0) return 0
  return parseFloat((reward / risk).toFixed(2))
}

export function calcPnL(
  entryPrice: number,
  exitPrice: number,
  lots: number,
  direction: 'LONG' | 'SHORT',
): number {
  const diff =
    direction === 'LONG'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice
  return diff * lots
}

export interface TagStats {
  tag: TradeTag
  total: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  violations: number
}

export function calcTagStats(trades: TradeLog[]): TagStats[] {
  const map = new Map<TradeTag, TagStats>()

  for (const t of trades) {
    if (t.result === 'OPEN') continue
    if (!map.has(t.tag)) {
      map.set(t.tag, {
        tag: t.tag,
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPnl: 0,
        violations: 0,
      })
    }
    const s = map.get(t.tag)!
    s.total++
    if (t.result === 'WIN') s.wins++
    if (t.result === 'LOSS') s.losses++
    s.totalPnl += t.pnl ?? 0
    if (t.ruleViolation) s.violations++
    s.winRate = s.total > 0 ? (s.wins / s.total) * 100 : 0
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ja-JP').format(n)
}
