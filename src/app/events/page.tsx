'use client'
import { useEffect, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { storage } from '@/lib/storage'
import { tdnetDateToIso } from '@/lib/tdnet'
import type { Disclosure } from '@/lib/tdnet'
import {
  InvestmentEvent, EventType, Direction, EventStatus,
  EVENT_TYPE_LABELS
} from '@/types'

const EVENT_TYPES: EventType[] = ['TOB', 'MBO', 'INDEX_IN', 'INDEX_OUT', 'IPO_LOCKUP', 'EARNINGS', 'OTHER']

const STATUS_LABELS: Record<EventStatus, string> = {
  WATCHING: '監視中',
  ENTERED: 'エントリー済',
  CLOSED: 'クローズ',
  PASSED: '通過済',
}
const STATUS_COLORS: Record<EventStatus, string> = {
  WATCHING: 'text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/5',
  ENTERED: 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/5',
  CLOSED: 'text-[#374151] border-[#374151]/30 bg-transparent',
  PASSED: 'text-[#374151] border-[#374151]/30 bg-transparent',
}
const EVENT_TYPE_COLORS: Record<EventType, string> = {
  TOB: 'text-[#f59e0b]',
  MBO: 'text-[#f59e0b]',
  INDEX_IN: 'text-[#10b981]',
  INDEX_OUT: 'text-[#ef4444]',
  IPO_LOCKUP: 'text-[#ef4444]',
  EARNINGS: 'text-[#3b82f6]',
  OTHER: 'text-[#6b7280]',
}

const emptyForm = {
  ticker: '',
  companyName: '',
  eventType: 'TOB' as EventType,
  eventDate: '',
  description: '',
  expectedDirection: 'LONG' as Direction,
  status: 'WATCHING' as EventStatus,
  notes: '',
}

type FormState = typeof emptyForm

export default function EventsPage() {
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [filter, setFilter] = useState<EventStatus | 'ALL'>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InvestmentEvent | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })

  // TDnet scan state
  const [scanDate, setScanDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<Disclosure[] | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [addedTickers, setAddedTickers] = useState<Set<string>>(new Set())
  const [showScan, setShowScan] = useState(false)

  useEffect(() => {
    setEvents(storage.getEvents())
  }, [])

  const filtered = events
    .filter(e => filter === 'ALL' || e.status === filter)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  function openEdit(e: InvestmentEvent) {
    setEditing(e)
    setForm({
      ticker: e.ticker,
      companyName: e.companyName,
      eventType: e.eventType,
      eventDate: e.eventDate,
      description: e.description,
      expectedDirection: e.expectedDirection,
      status: e.status,
      notes: e.notes,
    })
    setShowModal(true)
  }

  function saveEvent() {
    if (!form.ticker || !form.eventDate) return
    const now = new Date().toISOString()
    let updated: InvestmentEvent[]
    if (editing) {
      updated = events.map(e =>
        e.id === editing.id ? { ...e, ...form, updatedAt: now } : e
      )
    } else {
      updated = [
        ...events,
        { ...form, id: uuidv4(), createdAt: now, updatedAt: now },
      ]
    }
    storage.saveEvents(updated)
    setEvents(updated)
    setShowModal(false)
  }

  function remove(id: string) {
    if (!confirm('このイベントを削除しますか？')) return
    const updated = events.filter(e => e.id !== id)
    storage.saveEvents(updated)
    setEvents(updated)
  }

  async function runScan() {
    setScanning(true)
    setScanError(null)
    setScanResults(null)
    try {
      const dateParam = scanDate.replace(/-/g, '')
      const res = await fetch(`/api/crawl?date=${dateParam}`)
      const data = await res.json()
      setScanResults(data.items ?? [])
      if (data.error) setScanError(data.error)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'ネットワークエラー')
    } finally {
      setScanning(false)
    }
  }

  function addFromScan(d: Disclosure) {
    const now = new Date().toISOString()
    // Use the scan date as a rough event date (user can edit later)
    const eventDate = tdnetDateToIso(scanDate.replace(/-/g, ''))
    const newEvent: InvestmentEvent = {
      id: uuidv4(),
      ticker: d.ticker,
      companyName: d.companyName,
      eventType: d.suggestedEventType,
      eventDate,
      description: d.title,
      expectedDirection: d.suggestedDirection,
      status: 'WATCHING',
      notes: d.docUrl ? `開示URL: ${d.docUrl}` : '',
      createdAt: now,
      updatedAt: now,
    }
    const updated = [...events, newEvent]
    storage.saveEvents(updated)
    setEvents(updated)
    setAddedTickers(prev => { const s = new Set(Array.from(prev)); s.add(d.ticker); return s })
  }

  const filterCounts = {
    ALL: events.length,
    WATCHING: events.filter(e => e.status === 'WATCHING').length,
    ENTERED: events.filter(e => e.status === 'ENTERED').length,
    CLOSED: events.filter(e => e.status === 'CLOSED').length,
    PASSED: events.filter(e => e.status === 'PASSED').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold text-[#e2e8f0]">イベントカレンダー</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowScan(!showScan); setScanResults(null); setScanError(null) }}
            className={`px-3 py-2 text-xs font-semibold rounded border transition-colors ${
              showScan
                ? 'border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10'
                : 'border-[#1e1e30] text-[#6b7280] hover:border-[#3b82f6] hover:text-[#3b82f6]'
            }`}
          >
            TDnet スキャン
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 transition-colors"
          >
            + 手動追加
          </button>
        </div>
      </div>

      {/* TDnet Scan Panel */}
      {showScan && (
        <div className="border border-[#1e1e30] bg-[#0f0f1a] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#e2e8f0]">TDnet 適時開示スキャン</h2>
              <p className="text-xs text-[#6b7280] mt-0.5">
                TOB / MBO / インデックス採除外 / IPOロックアップ解除を自動検出します
              </p>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <label className="block text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">
                取得日付
              </label>
              <input
                type="date"
                className="input"
                value={scanDate}
                onChange={e => setScanDate(e.target.value)}
                style={{ width: '160px' }}
              />
            </div>
            <button
              onClick={runScan}
              disabled={scanning}
              className="px-5 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin text-base">⟳</span>スキャン中...
                </span>
              ) : 'スキャン実行'}
            </button>
          </div>

          {/* Scan Error */}
          {scanError && (
            <div className="border border-[#ef4444]/30 bg-[#ef4444]/5 rounded-lg px-4 py-3">
              <p className="text-xs text-[#ef4444] font-semibold">接続エラー</p>
              <p className="text-xs text-[#6b7280] mt-1">{scanError}</p>
              <p className="text-[11px] text-[#374151] mt-2">
                TDnetへのアクセスがブロックされているか、該当日の開示がない可能性があります。
                日付を変更するか、手動でイベントを追加してください。
              </p>
            </div>
          )}

          {/* Scan Results */}
          {scanResults !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#6b7280]">
                  {scanResults.length > 0
                    ? `${scanResults.length}件のイベント関連開示を検出`
                    : '該当する開示が見つかりませんでした（土日・祝日 or 該当イベントなし）'}
                </p>
                {scanResults.length > 0 && (
                  <p className="text-[10px] text-[#374151]">
                    ※ キーワードマッチのみ。PDF本文は未解析
                  </p>
                )}
              </div>

              {scanResults.length > 0 && (
                <div className="border border-[#1e1e30] rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1e1e30] bg-[#161624]">
                        {['時刻', 'コード', 'イベント種別', '表題', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scanResults.map((d, i) => {
                        const alreadyAdded = addedTickers.has(d.ticker)
                        return (
                          <tr key={i} className="border-b border-[#1e1e30] hover:bg-[#161624] transition-colors">
                            <td className="px-3 py-2.5 mono text-[11px] text-[#374151] whitespace-nowrap">
                              {d.time}
                            </td>
                            <td className="px-3 py-2.5">
                              <div>
                                <span className="mono font-semibold text-[#e2e8f0]">{d.ticker}</span>
                                <p className="text-[10px] text-[#6b7280]">{d.companyName}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[11px] font-medium ${EVENT_TYPE_COLORS[d.suggestedEventType]}`}>
                                {EVENT_TYPE_LABELS[d.suggestedEventType]}
                              </span>
                              <p className={`text-[10px] mt-0.5 ${d.suggestedDirection === 'LONG' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                {d.suggestedDirection === 'LONG' ? '↑ LONG' : '↓ SHORT'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 max-w-[280px]">
                              <p className="text-[11px] text-[#e2e8f0] line-clamp-2">{d.title}</p>
                              {d.docUrl && (
                                <a
                                  href={d.docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-[#3b82f6] hover:underline mt-0.5 inline-block"
                                >
                                  開示を見る →
                                </a>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {alreadyAdded ? (
                                <span className="text-[11px] text-[#10b981]">✓ 追加済</span>
                              ) : (
                                <button
                                  onClick={() => addFromScan(d)}
                                  className="px-3 py-1 text-[11px] bg-[#1e1e30] text-[#e2e8f0] rounded hover:bg-[#2e2e45] transition-colors whitespace-nowrap"
                                >
                                  カレンダーに追加
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'WATCHING', 'ENTERED', 'CLOSED', 'PASSED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              filter === s
                ? 'border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10'
                : 'border-[#1e1e30] text-[#6b7280] hover:border-[#2e2e45]'
            }`}
          >
            {s === 'ALL' ? 'すべて' : STATUS_LABELS[s]}
            <span className="ml-1.5 mono text-[10px] opacity-60">{filterCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Events Table */}
      {filtered.length === 0 ? (
        <div className="border border-[#1e1e30] rounded-lg p-10 text-center space-y-2">
          <p className="text-[#374151] text-sm">イベントがありません</p>
          <p className="text-xs text-[#374151]">
            「TDnet スキャン」で自動検出するか、「手動追加」で登録してください
          </p>
        </div>
      ) : (
        <div className="border border-[#1e1e30] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e30] bg-[#0f0f1a]">
                {['銘柄', 'イベント種別', '期日', '残日数', '方向性', 'ステータス', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const days = differenceInDays(new Date(e.eventDate), new Date())
                return (
                  <tr key={e.id} className="border-b border-[#1e1e30] hover:bg-[#0f0f1a] transition-colors group">
                    <td className="px-4 py-3">
                      <div>
                        <span className="mono text-sm font-semibold text-[#e2e8f0]">{e.ticker}</span>
                        <p className="text-[11px] text-[#6b7280]">{e.companyName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${EVENT_TYPE_COLORS[e.eventType]}`}>
                        {EVENT_TYPE_LABELS[e.eventType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 mono text-xs text-[#e2e8f0]">
                      {format(new Date(e.eventDate), 'yyyy/M/d')}
                    </td>
                    <td className="px-4 py-3">
                      <DaysChip days={days} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${
                          e.expectedDirection === 'LONG' ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {e.expectedDirection === 'LONG' ? '↑ LONG' : '↓ SHORT'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[e.status]}`}>
                        {STATUS_LABELS[e.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(e)} className="text-[10px] text-[#6b7280] hover:text-[#e2e8f0]">
                          編集
                        </button>
                        <button onClick={() => remove(e.id)} className="text-[10px] text-[#ef4444]/60 hover:text-[#ef4444]">
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)} />
          <div className="relative bg-[#0f0f1a] border border-[#1e1e30] rounded-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {editing ? 'イベント編集' : '新規イベント'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ティッカー *">
                <input className="input" placeholder="7203" value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} />
              </Field>
              <Field label="銘柄名">
                <input className="input" placeholder="トヨタ自動車" value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="イベント種別">
                <select className="input" value={form.eventType}
                  onChange={e => setForm(f => ({ ...f, eventType: e.target.value as EventType }))}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                </select>
              </Field>
              <Field label="期日 *">
                <input type="date" className="input" value={form.eventDate}
                  onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="期待方向">
                <select className="input" value={form.expectedDirection}
                  onChange={e => setForm(f => ({ ...f, expectedDirection: e.target.value as Direction }))}>
                  <option value="LONG">↑ LONG（買い）</option>
                  <option value="SHORT">↓ SHORT（売り）</option>
                </select>
              </Field>
              <Field label="ステータス">
                <select className="input" value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as EventStatus }))}>
                  <option value="WATCHING">監視中</option>
                  <option value="ENTERED">エントリー済</option>
                  <option value="CLOSED">クローズ</option>
                  <option value="PASSED">通過済</option>
                </select>
              </Field>
            </div>
            <Field label="概要・根拠">
              <textarea className="input resize-none h-20"
                placeholder="需給の歪みが発生する理由を記述..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="メモ">
              <input className="input" placeholder="任意メモ" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-[#6b7280] hover:text-[#e2e8f0] transition-colors">
                キャンセル
              </button>
              <button onClick={saveEvent} disabled={!form.ticker || !form.eventDate}
                className="px-4 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {editing ? '更新' : '追加'}
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

function DaysChip({ days }: { days: number }) {
  if (days < 0) return <span className="mono text-[11px] text-[#374151]">終了</span>
  if (days === 0) return <span className="mono text-[11px] font-bold text-[#ef4444]">TODAY</span>
  if (days <= 3) return <span className="mono text-[11px] font-bold text-[#f59e0b]">{days}日</span>
  if (days <= 7) return <span className="mono text-[11px] text-[#3b82f6]">{days}日</span>
  return <span className="mono text-[11px] text-[#6b7280]">{days}日</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}
