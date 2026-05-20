'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { storage } from '@/lib/storage'
import { calcTagStats, formatCurrency } from '@/lib/calculations'
import { TradeLog, TradeResult, TRADE_TAG_LABELS } from '@/types'

const RESULT_LABELS: Record<TradeResult, string> = {
  WIN: '勝',
  LOSS: '敗',
  BREAK_EVEN: '±0',
  OPEN: 'オープン',
}

const RESULT_COLORS: Record<TradeResult, string> = {
  WIN: 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/5',
  LOSS: 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/5',
  BREAK_EVEN: 'text-[#6b7280] border-[#6b7280]/30 bg-transparent',
  OPEN: 'text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/5',
}

export default function LogPage() {
  const [trades, setTrades] = useState<TradeLog[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [closeForm, setCloseForm] = useState({ exitPrice: '', result: 'WIN' as TradeResult, ruleViolation: false, violationNote: '' })

  useEffect(() => {
    setTrades(storage.getTrades())
  }, [])

  const sorted = [...trades].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
  const closed = trades.filter(t => t.result !== 'OPEN')
  const open = trades.filter(t => t.result === 'OPEN')
  const wins = closed.filter(t => t.result === 'WIN').length
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0
  const violations = closed.filter(t => t.ruleViolation).length
  const tagStats = calcTagStats(trades)

  function startClose(t: TradeLog) {
    setEditingId(t.id)
    setCloseForm({ exitPrice: '', result: 'WIN', ruleViolation: false, violationNote: '' })
  }

  function submitClose() {
    if (!editingId) return
    const exitPrice = parseFloat(closeForm.exitPrice)
    if (isNaN(exitPrice)) return

    const updated = trades.map(t => {
      if (t.id !== editingId) return t
      const diff = t.direction === 'LONG' ? exitPrice - t.entryPrice : t.entryPrice - exitPrice
      const pnl = diff * t.lots
      const pnlPercent = (diff / t.entryPrice) * 100
      return {
        ...t,
        exitPrice,
        exitDate: new Date().toISOString().split('T')[0],
        result: closeForm.result,
        pnl,
        pnlPercent,
        ruleViolation: closeForm.ruleViolation,
        violationNote: closeForm.violationNote,
      }
    })
    storage.saveTrades(updated)
    setTrades(updated)
    setEditingId(null)
  }

  function removeTrade(id: string) {
    if (!confirm('このトレードを削除しますか？')) return
    const updated = trades.filter(t => t.id !== id)
    storage.saveTrades(updated)
    setTrades(updated)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-[#e2e8f0]">トレードログ</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="通算損益" value={formatCurrency(totalPnl)} color={totalPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="勝率" value={closed.length > 0 ? `${winRate.toFixed(1)}%` : '—'} sub={`${wins}勝 ${closed.length - wins}敗`} />
        <StatCard label="オープン" value={String(open.length)} sub="件" />
        <StatCard label="ルール違反" value={String(violations)} sub={`/ ${closed.length}件`} color={violations > 0 ? 'red' : 'green'} />
      </div>

      {/* Tag Stats */}
      {tagStats.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">手法別パフォーマンス</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tagStats.map(s => (
              <div key={s.tag} className="border border-[#1e1e30] bg-[#0f0f1a] rounded-lg px-4 py-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[#e2e8f0]">{TRADE_TAG_LABELS[s.tag]}</span>
                  <div className="flex gap-3">
                    <span className={`mono text-xs font-semibold ${s.winRate >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      勝率 {s.winRate.toFixed(0)}%
                    </span>
                    <span className={`mono text-xs ${s.totalPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {formatCurrency(s.totalPnl)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[#1e1e30] rounded-full h-1">
                  <div
                    className={`h-1 rounded-full ${s.winRate >= 50 ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}
                    style={{ width: `${s.winRate}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-1.5">
                  <span className="text-[10px] text-[#374151]">{s.wins}勝 {s.losses}敗 {s.total}件</span>
                  {s.violations > 0 && (
                    <span className="text-[10px] text-[#ef4444]">⚠ ルール違反 {s.violations}件</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Table */}
      <div>
        <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">トレード履歴</h2>
        {sorted.length === 0 ? (
          <div className="border border-[#1e1e30] rounded-lg p-10 text-center">
            <p className="text-[#374151] text-sm">トレードがありません</p>
            <p className="text-xs text-[#374151] mt-1">ゲートキーパーからエントリーを記録してください</p>
          </div>
        ) : (
          <div className="border border-[#1e1e30] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e1e30] bg-[#0f0f1a]">
                  {['銘柄', '手法', 'エントリー', '損切/利確', '株数', '結果', 'P&L', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] text-[#6b7280] uppercase tracking-wider font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.id} className="border-b border-[#1e1e30] hover:bg-[#0f0f1a] group transition-colors">
                    <td className="px-3 py-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="mono font-semibold text-[#e2e8f0]">{t.ticker}</span>
                          <span className={`text-[10px] ${t.direction === 'LONG' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                            {t.direction === 'LONG' ? '↑' : '↓'}
                          </span>
                          {t.ruleViolation && (
                            <span className="text-[10px] text-[#ef4444]" title="ルール違反">⚠</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#374151]">{format(new Date(t.entryDate), 'M/d')}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-[#6b7280]">{TRADE_TAG_LABELS[t.tag]}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="mono text-[#e2e8f0]">{t.entryPrice.toLocaleString()}</span>
                      {t.exitPrice && (
                        <p className="mono text-[10px] text-[#6b7280]">→ {t.exitPrice.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="mono text-[#ef4444] text-[11px]">{t.plannedStopLoss.toLocaleString()}</span>
                      <span className="text-[#374151] text-[11px]"> / </span>
                      <span className="mono text-[#10b981] text-[11px]">{t.plannedTarget.toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-2.5 mono text-[#e2e8f0]">
                      {t.lots.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${RESULT_COLORS[t.result]}`}>
                        {RESULT_LABELS[t.result]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {t.pnl != null ? (
                        <span className={`mono text-xs font-semibold ${t.pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          {t.pnl >= 0 ? '+' : ''}{formatCurrency(t.pnl)}
                        </span>
                      ) : (
                        <span className="text-[#374151]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.result === 'OPEN' && (
                          <button
                            onClick={() => startClose(t)}
                            className="text-[10px] text-[#3b82f6] hover:text-blue-400"
                          >
                            決済
                          </button>
                        )}
                        <button
                          onClick={() => removeTrade(t.id)}
                          className="text-[10px] text-[#ef4444]/60 hover:text-[#ef4444]"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Close Trade Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditingId(null)} />
          <div className="relative bg-[#0f0f1a] border border-[#1e1e30] rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#e2e8f0]">決済入力</h2>

            <div className="space-y-3">
              <Field label="決済価格 *">
                <input
                  type="number"
                  className="input"
                  placeholder="決済した価格"
                  value={closeForm.exitPrice}
                  onChange={e => setCloseForm(f => ({ ...f, exitPrice: e.target.value }))}
                />
              </Field>
              <Field label="結果">
                <select
                  className="input"
                  value={closeForm.result}
                  onChange={e => setCloseForm(f => ({ ...f, result: e.target.value as TradeResult }))}
                >
                  <option value="WIN">勝（利確）</option>
                  <option value="LOSS">敗（損切り）</option>
                  <option value="BREAK_EVEN">±0（トントン）</option>
                </select>
              </Field>

              <div className="border border-[#1e1e30] rounded-lg p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closeForm.ruleViolation}
                    onChange={e => setCloseForm(f => ({ ...f, ruleViolation: e.target.checked }))}
                    className="accent-[#ef4444]"
                  />
                  <span className="text-xs text-[#e2e8f0]">ルール違反があった（予定外エントリー、損切り遅延など）</span>
                </label>
                {closeForm.ruleViolation && (
                  <input
                    className="input"
                    placeholder="違反内容を記録（例: 損切りラインを下抜けても持ち続けた）"
                    value={closeForm.violationNote}
                    onChange={e => setCloseForm(f => ({ ...f, violationNote: e.target.value }))}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-xs text-[#6b7280] hover:text-[#e2e8f0] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={submitClose}
                disabled={!closeForm.exitPrice}
                className="px-4 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                決済確定
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          background: #161624;
          border: 1px solid #1e1e30;
          border-radius: 6px;
          padding: 8px 10px;
          color: #e2e8f0;
          font-size: 13px;
          transition: box-shadow 0.15s;
        }
        .input::placeholder { color: #374151; }
        .input option { background: #161624; }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: 'green' | 'red' }) {
  const c = color === 'green' ? 'text-[#10b981]' : color === 'red' ? 'text-[#ef4444]' : 'text-[#e2e8f0]'
  return (
    <div className="border border-[#1e1e30] bg-[#0f0f1a] rounded-lg px-4 py-3">
      <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`mono text-lg font-semibold ${c}`}>{value}</p>
      {sub && <p className="mono text-[10px] text-[#374151] mt-0.5">{sub}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}
