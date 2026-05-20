'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { differenceInDays, format, isPast } from 'date-fns'
import { ja } from 'date-fns/locale'
import { storage } from '@/lib/storage'
import { calcTagStats, formatCurrency } from '@/lib/calculations'
import { InvestmentEvent, TradeLog, EVENT_TYPE_LABELS } from '@/types'

function daysUntil(dateStr: string): number {
  return differenceInDays(new Date(dateStr), new Date())
}

function EventStatusBadge({ days }: { days: number }) {
  if (days < 0) return <span className="mono text-xs text-[#374151]">終了</span>
  if (days === 0) return <span className="mono text-xs font-bold text-[#ef4444] animate-pulse">TODAY</span>
  if (days <= 3) return <span className="mono text-xs font-bold text-[#f59e0b]">{days}日後</span>
  if (days <= 7) return <span className="mono text-xs text-[#3b82f6]">{days}日後</span>
  return <span className="mono text-xs text-[#6b7280]">{days}日後</span>
}

export default function Dashboard() {
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [trades, setTrades] = useState<TradeLog[]>([])

  useEffect(() => {
    setEvents(storage.getEvents())
    setTrades(storage.getTrades())
  }, [])

  const upcomingEvents = events
    .filter(e => e.status === 'WATCHING' || e.status === 'ENTERED')
    .filter(e => daysUntil(e.eventDate) >= -1)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .slice(0, 8)

  const closedTrades = trades.filter(t => t.result !== 'OPEN')
  const openTrades = trades.filter(t => t.result === 'OPEN')
  const wins = closedTrades.filter(t => t.result === 'WIN').length
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const tagStats = calcTagStats(trades).slice(0, 4)
  const violations = closedTrades.filter(t => t.ruleViolation).length

  const settings = typeof window !== 'undefined' ? storage.getSettings() : { totalAssets: 0, maxRiskPerTrade: 1 }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="mono text-xs text-[#6b7280] mb-0.5">
            {format(new Date(), 'yyyy年M月d日（EEE）', { locale: ja })}
          </p>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">ダッシュボード</h1>
        </div>
        <Link
          href="/calculator"
          className="px-4 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 transition-colors"
        >
          + 新規エントリー審査
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="総資産" value={formatCurrency(settings.totalAssets)} />
        <StatCard
          label="通算損益"
          value={formatCurrency(totalPnl)}
          color={totalPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="勝率"
          value={closedTrades.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
          sub={`${wins}勝 ${closedTrades.length - wins}敗`}
        />
        <StatCard
          label="ルール違反"
          value={String(violations)}
          sub={`/ ${closedTrades.length}件`}
          color={violations > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">
              直近のイベント
            </h2>
            <Link href="/events" className="text-xs text-[#3b82f6] hover:underline">
              すべて表示 →
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="border border-[#1e1e30] rounded-lg p-6 text-center">
              <p className="text-[#374151] text-sm">イベントがありません</p>
              <Link href="/events" className="text-xs text-[#3b82f6] mt-2 inline-block hover:underline">
                イベントを追加する →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(e => {
                const days = daysUntil(e.eventDate)
                return (
                  <div
                    key={e.id}
                    className="border border-[#1e1e30] bg-[#0f0f1a] rounded-lg px-4 py-3 flex items-center justify-between group hover:border-[#2e2e45] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="mono text-sm font-semibold text-[#e2e8f0]">{e.ticker}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded border ${
                              e.expectedDirection === 'LONG'
                                ? 'border-[#10b981]/30 text-[#10b981] bg-[#10b981]/5'
                                : 'border-[#ef4444]/30 text-[#ef4444] bg-[#ef4444]/5'
                            }`}
                          >
                            {e.expectedDirection === 'LONG' ? '↑ LONG' : '↓ SHORT'}
                          </span>
                        </div>
                        <p className="text-xs text-[#6b7280] mt-0.5">
                          {e.companyName} · {EVENT_TYPE_LABELS[e.eventType]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <EventStatusBadge days={days} />
                      <p className="mono text-xs text-[#374151] mt-0.5">
                        {format(new Date(e.eventDate), 'M/d')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Open Positions */}
          <div>
            <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">
              オープンポジション
            </h2>
            {openTrades.length === 0 ? (
              <div className="border border-[#1e1e30] rounded-lg p-4 text-center">
                <p className="text-[#374151] text-xs">なし</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openTrades.slice(0, 4).map(t => (
                  <div key={t.id} className="border border-[#1e1e30] bg-[#0f0f1a] rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center">
                      <span className="mono text-sm font-semibold">{t.ticker}</span>
                      <span
                        className={`text-xs ${
                          t.direction === 'LONG' ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {t.direction === 'LONG' ? '↑' : '↓'} {t.lots.toLocaleString()}株
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="mono text-xs text-[#6b7280]">
                        @{t.entryPrice.toLocaleString()}円
                      </span>
                      <span className="mono text-xs text-[#374151]">
                        損切 {t.plannedStopLoss.toLocaleString()}円
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tag Stats */}
          {tagStats.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">
                手法別勝率
              </h2>
              <div className="space-y-2">
                {tagStats.map(s => (
                  <div key={s.tag} className="border border-[#1e1e30] bg-[#0f0f1a] rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#e2e8f0]">{s.tag}</span>
                      <span
                        className={`mono text-xs font-semibold ${
                          s.winRate >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {s.winRate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#1e1e30] rounded-full h-1 mt-1.5">
                      <div
                        className={`h-1 rounded-full ${s.winRate >= 50 ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}
                        style={{ width: `${s.winRate}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#374151] mt-1">
                      {s.wins}勝 {s.losses}敗 ({s.total}件)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: 'green' | 'red'
}) {
  const valueColor =
    color === 'green'
      ? 'text-[#10b981]'
      : color === 'red'
      ? 'text-[#ef4444]'
      : 'text-[#e2e8f0]'

  return (
    <div className="border border-[#1e1e30] bg-[#0f0f1a] rounded-lg px-4 py-3">
      <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`mono text-lg font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="mono text-[10px] text-[#374151] mt-0.5">{sub}</p>}
    </div>
  )
}
