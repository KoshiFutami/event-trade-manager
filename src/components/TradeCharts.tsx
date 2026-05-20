'use client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, PieChart, Pie, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { TradeLog } from '@/types'
import { calcTagStats, formatCurrency } from '@/lib/calculations'
import { TRADE_TAG_LABELS } from '@/types'

const THEME = {
  green: '#10b981',
  red: '#ef4444',
  blue: '#3b82f6',
  amber: '#f59e0b',
  muted: '#374151',
  border: '#1e1e30',
  surface: '#0f0f1a',
  elevated: '#161624',
  textPrimary: '#e2e8f0',
  textSecondary: '#6b7280',
}

const tooltipStyle = {
  backgroundColor: '#161624',
  border: '1px solid #1e1e30',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '11px',
  fontFamily: 'JetBrains Mono, monospace',
}

interface Props {
  trades: TradeLog[]
}

// ① 累積損益チャート
function CumulativePnlChart({ trades }: Props) {
  const sorted = [...trades]
    .filter(t => t.pnl != null && t.exitDate)
    .sort((a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime())

  let cumulative = 0
  const data = sorted.map(t => {
    cumulative += t.pnl ?? 0
    return {
      date: format(parseISO(t.exitDate!), 'M/d', { locale: ja }),
      ticker: t.ticker,
      pnl: t.pnl ?? 0,
      cumulative,
      violation: t.ruleViolation,
    }
  })

  if (data.length === 0) return <EmptyChart label="累積損益" />

  return (
    <ChartCard title="累積損益推移" subtitle="全決済トレードの累計P&L">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
          <XAxis dataKey="date" tick={{ fill: THEME.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: THEME.textSecondary, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(val: any, _: any, entry: any) => [
              `${formatCurrency(Number(val))} (${entry?.payload?.ticker ?? ''})`,
              entry?.payload?.violation ? '⚠ルール違反' : '',
            ]}
            labelStyle={{ color: THEME.textSecondary }}
          />
          <ReferenceLine y={0} stroke={THEME.muted} strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke={THEME.blue}
            strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => (
              <circle
                key={`dot-${props.cx}-${props.cy}`}
                cx={props.cx ?? 0}
                cy={props.cy ?? 0}
                r={props.payload?.violation ? 5 : 3}
                fill={props.payload?.violation ? THEME.amber : ((props.payload?.cumulative ?? 0) >= 0 ? THEME.green : THEME.red)}
                stroke="none"
              />
            )}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-[#374151] mt-2">● 黄点 = ルール違反トレード</p>
    </ChartCard>
  )
}

// ② 手法別勝率バー
function TagWinRateChart({ trades }: Props) {
  const stats = calcTagStats(trades)
  if (stats.length === 0) return <EmptyChart label="手法別勝率" />

  const data = stats.map(s => ({
    tag: TRADE_TAG_LABELS[s.tag].replace('イベント', 'EV').replace('サヤ取り', 'サヤ').replace('ロックアップ', 'LU'),
    winRate: parseFloat(s.winRate.toFixed(1)),
    total: s.total,
  }))

  return (
    <ChartCard title="手法別 勝率" subtitle="タグ別の勝利率（%）">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
          <XAxis dataKey="tag" tick={{ fill: THEME.textSecondary, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: THEME.textSecondary, fontSize: 10 }}
            axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={36} />
          <Tooltip
            contentStyle={tooltipStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, _: any, entry: any) => [`${v}% (${entry?.payload?.total ?? 0}件)`, '勝率']}
          />
          <ReferenceLine y={50} stroke={THEME.muted} strokeDasharray="4 4" />
          <Bar dataKey="winRate" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.winRate >= 50 ? THEME.green : THEME.red} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ③ 手法別 累積P&L
function TagPnlChart({ trades }: Props) {
  const stats = calcTagStats(trades)
  if (stats.length === 0) return <EmptyChart label="手法別P&L" />

  const data = stats
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .map(s => ({
      tag: TRADE_TAG_LABELS[s.tag].replace('イベント', 'EV').replace('サヤ取り', 'サヤ').replace('ロックアップ', 'LU'),
      pnl: Math.round(s.totalPnl),
    }))

  return (
    <ChartCard title="手法別 累積損益" subtitle="タグ別の合計P&L（円）">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
          <XAxis dataKey="tag" tick={{ fill: THEME.textSecondary, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: THEME.textSecondary, fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [formatCurrency(Number(v)), 'P&L']}
          />
          <ReferenceLine y={0} stroke={THEME.muted} />
          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? THEME.green : THEME.red} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ④ ルール違反コストの可視化
function ViolationCostChart({ trades }: Props) {
  const compliant = trades.filter(t => !t.ruleViolation)
  const violation = trades.filter(t => t.ruleViolation)

  const compWins = compliant.filter(t => t.result === 'WIN').length
  const compLosses = compliant.filter(t => t.result === 'LOSS').length
  const compPnl = compliant.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const vioWins = violation.filter(t => t.result === 'WIN').length
  const vioLosses = violation.filter(t => t.result === 'LOSS').length
  const vioPnl = violation.reduce((s, t) => s + (t.pnl ?? 0), 0)

  const compWinRate = compliant.length > 0 ? (compWins / compliant.length) * 100 : 0
  const vioWinRate = violation.length > 0 ? (vioWins / violation.length) * 100 : 0

  if (trades.length === 0) return <EmptyChart label="ルール遵守 vs 違反" />

  const barData = [
    { name: '遵守', winRate: parseFloat(compWinRate.toFixed(1)), pnl: compPnl, count: compliant.length },
    { name: '違反', winRate: parseFloat(vioWinRate.toFixed(1)), pnl: vioPnl, count: violation.length },
  ]

  const pieData = [
    { name: '遵守', value: compliant.length, color: THEME.blue },
    { name: '違反', value: violation.length, color: THEME.amber },
  ]

  return (
    <ChartCard title="ルール遵守 vs 違反" subtitle="感情トレードが損益に与えるコスト">
      <div className="grid grid-cols-2 gap-4 mt-1">
        {/* Win Rate Comparison */}
        <div>
          <p className="text-[10px] text-[#6b7280] mb-2">勝率比較</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={barData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: THEME.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: THEME.textSecondary, fontSize: 10 }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={32} />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, _: any, entry: any) => [
                  `${v}% (${entry?.payload?.count ?? 0}件)`, '勝率',
                ]}
              />
              <Bar dataKey="winRate" radius={[3, 3, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.name === '遵守' ? THEME.blue : THEME.amber} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie + Stats */}
        <div className="space-y-2">
          <p className="text-[10px] text-[#6b7280] mb-2">件数構成比</p>
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={20} outerRadius={36}
                paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}件`]} />
              <Legend
                iconSize={8}
                formatter={(value: string) => <span style={{ color: THEME.textSecondary, fontSize: '10px' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#6b7280]">遵守P&L</span>
              <span className={`mono font-semibold ${compPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {formatCurrency(compPnl)}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#6b7280]">違反P&L</span>
              <span className={`mono font-semibold ${vioPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {formatCurrency(vioPnl)}
              </span>
            </div>
            <div className="border-t border-[#1e1e30] pt-1 flex justify-between text-[11px]">
              <span className="text-[#6b7280]">違反コスト</span>
              <span className="mono font-bold text-[#f59e0b]">
                {formatCurrency(compPnl - (compPnl - vioPnl < 0 ? vioPnl : vioPnl))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-[#161624] rounded-lg p-2 text-center">
          <p className="text-[10px] text-[#6b7280]">遵守トレード</p>
          <p className="mono text-sm font-bold text-[#3b82f6]">{compWins}勝 {compLosses}敗</p>
        </div>
        <div className="bg-[#161624] rounded-lg p-2 text-center">
          <p className="text-[10px] text-[#6b7280]">違反トレード</p>
          <p className="mono text-sm font-bold text-[#f59e0b]">{vioWins}勝 {vioLosses}敗</p>
        </div>
      </div>
    </ChartCard>
  )
}

// ⑤ 月別損益バー
function MonthlyPnlChart({ trades }: Props) {
  const monthly = new Map<string, number>()
  for (const t of trades) {
    if (!t.exitDate || t.pnl == null) continue
    const key = format(parseISO(t.exitDate), 'yyyy/MM', { locale: ja })
    monthly.set(key, (monthly.get(key) ?? 0) + t.pnl)
  }

  const data = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: Math.round(pnl) }))

  if (data.length === 0) return <EmptyChart label="月別損益" />

  return (
    <ChartCard title="月別 損益" subtitle="月ごとの合計P&L（円）">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: THEME.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: THEME.textSecondary, fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} width={48} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [formatCurrency(Number(v)), 'P&L']} />
          <ReferenceLine y={0} stroke={THEME.muted} />
          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? THEME.green : THEME.red} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---- Layout ----
export default function TradeCharts({ trades }: Props) {
  return (
    <div className="space-y-4">
      {/* Full-width cumulative P&L */}
      <CumulativePnlChart trades={trades} />

      {/* 2-column grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <TagWinRateChart trades={trades} />
        <TagPnlChart trades={trades} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <MonthlyPnlChart trades={trades} />
        <ViolationCostChart trades={trades} />
      </div>
    </div>
  )
}

// ---- Helpers ----
function ChartCard({ title, subtitle, children }: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-[#1e1e30] bg-[#0f0f1a] rounded-xl p-4">
      <p className="text-xs font-semibold text-[#e2e8f0]">{title}</p>
      <p className="text-[10px] text-[#6b7280] mb-3">{subtitle}</p>
      {children}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="border border-[#1e1e30] bg-[#0f0f1a] rounded-xl p-4 h-52 flex items-center justify-center">
      <p className="text-[#374151] text-xs">{label} — データ不足</p>
    </div>
  )
}
