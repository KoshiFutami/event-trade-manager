'use client'
import { useEffect, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { storage } from '@/lib/storage'
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

const empty: Omit<InvestmentEvent, 'id' | 'createdAt' | 'updatedAt'> = {
  ticker: '',
  companyName: '',
  eventType: 'TOB',
  eventDate: '',
  description: '',
  expectedDirection: 'LONG',
  status: 'WATCHING',
  notes: '',
}

export default function EventsPage() {
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [filter, setFilter] = useState<EventStatus | 'ALL'>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InvestmentEvent | null>(null)
  const [form, setForm] = useState({ ...empty })

  useEffect(() => {
    setEvents(storage.getEvents())
  }, [])

  const filtered = events
    .filter(e => filter === 'ALL' || e.status === filter)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())

  function openNew() {
    setEditing(null)
    setForm({ ...empty })
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

  function save() {
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

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="text-lg font-semibold text-[#e2e8f0]">イベントカレンダー</h1>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 transition-colors"
        >
          + イベント追加
        </button>
      </div>

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
            <span className="ml-1.5 mono text-[10px] opacity-60">
              {s === 'ALL' ? events.length : events.filter(e => e.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="border border-[#1e1e30] rounded-lg p-10 text-center">
          <p className="text-[#374151] text-sm">イベントがありません</p>
        </div>
      ) : (
        <div className="border border-[#1e1e30] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e30] bg-[#0f0f1a]">
                {['ティッカー', 'イベント種別', '期日', '残日数', '方向性', 'ステータス', ''].map(h => (
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
                      <span className="text-xs text-[#6b7280]">{EVENT_TYPE_LABELS[e.eventType]}</span>
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
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[e.status]}`}
                      >
                        {STATUS_LABELS[e.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(e)}
                          className="text-[10px] text-[#6b7280] hover:text-[#e2e8f0]"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => remove(e.id)}
                          className="text-[10px] text-[#ef4444]/60 hover:text-[#ef4444]"
                        >
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)} />
          <div className="relative bg-[#0f0f1a] border border-[#1e1e30] rounded-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {editing ? 'イベント編集' : '新規イベント'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ティッカー *">
                <input
                  className="input"
                  placeholder="7203"
                  value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                />
              </Field>
              <Field label="銘柄名 *">
                <input
                  className="input"
                  placeholder="トヨタ自動車"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="イベント種別">
                <select
                  className="input"
                  value={form.eventType}
                  onChange={e => setForm(f => ({ ...f, eventType: e.target.value as EventType }))}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="期日 *">
                <input
                  type="date"
                  className="input"
                  value={form.eventDate}
                  onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="期待方向">
                <select
                  className="input"
                  value={form.expectedDirection}
                  onChange={e => setForm(f => ({ ...f, expectedDirection: e.target.value as Direction }))}
                >
                  <option value="LONG">↑ LONG（買い）</option>
                  <option value="SHORT">↓ SHORT（売り）</option>
                </select>
              </Field>
              <Field label="ステータス">
                <select
                  className="input"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as EventStatus }))}
                >
                  <option value="WATCHING">監視中</option>
                  <option value="ENTERED">エントリー済</option>
                  <option value="CLOSED">クローズ</option>
                  <option value="PASSED">通過済</option>
                </select>
              </Field>
            </div>

            <Field label="概要・根拠">
              <textarea
                className="input resize-none h-20"
                placeholder="需給の歪みが発生する理由を記述..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <Field label="メモ">
              <input
                className="input"
                placeholder="任意メモ"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-[#6b7280] hover:text-[#e2e8f0] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={!form.ticker || !form.eventDate}
                className="px-4 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
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
