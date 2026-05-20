'use client'
import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { storage } from '@/lib/storage'
import { calcMaxLots, calcRiskReward, formatCurrency } from '@/lib/calculations'
import { TradeLog, TradeTag, Direction, TRADE_TAG_LABELS } from '@/types'

const TRADE_TAGS: TradeTag[] = ['TOB_ARBITRAGE', 'INDEX_EVENT', 'IPO_LOCKUP', 'EARNINGS', 'REBOUND', 'OTHER']

type Step = 1 | 2 | 3 | 4

interface GateForm {
  ticker: string
  companyName: string
  tag: TradeTag
  direction: Direction
  hypothesis: string
  entryPrice: string
  stopLossPrice: string
  targetPrice: string
  entryDate: string
}

const emptyForm: GateForm = {
  ticker: '',
  companyName: '',
  tag: 'TOB_ARBITRAGE',
  direction: 'LONG',
  hypothesis: '',
  entryPrice: '',
  stopLossPrice: '',
  targetPrice: '',
  entryDate: new Date().toISOString().split('T')[0],
}

export default function CalculatorPage() {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<GateForm>({ ...emptyForm })
  const [totalAssets, setTotalAssets] = useState(1000000)
  const [riskPercent, setRiskPercent] = useState(1)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const settings = storage.getSettings()
    setTotalAssets(settings.totalAssets)
    setRiskPercent(settings.maxRiskPerTrade)
  }, [])

  const entry = parseFloat(form.entryPrice)
  const stop = parseFloat(form.stopLossPrice)
  const target = parseFloat(form.targetPrice)

  const maxLots = calcMaxLots(totalAssets, riskPercent, entry, stop)
  const rr = calcRiskReward(entry, stop, target, form.direction)
  const maxRiskAmount = (totalAssets * riskPercent) / 100
  const expectedPnl = (form.direction === 'LONG' ? target - entry : entry - target) * maxLots

  const step1Valid = form.ticker.length > 0 && form.hypothesis.length >= 20
  const step2Valid =
    entry > 0 &&
    stop > 0 &&
    target > 0 &&
    (form.direction === 'LONG' ? stop < entry && target > entry : stop > entry && target < entry)
  const step3Valid = totalAssets > 0 && riskPercent > 0 && riskPercent <= 5

  function saveToLog() {
    if (!step1Valid || !step2Valid || !step3Valid) return
    const trade: TradeLog = {
      id: uuidv4(),
      ticker: form.ticker,
      companyName: form.companyName,
      tag: form.tag,
      direction: form.direction,
      hypothesis: form.hypothesis,
      entryDate: form.entryDate,
      entryPrice: entry,
      lots: maxLots,
      plannedStopLoss: stop,
      plannedTarget: target,
      result: 'OPEN',
      ruleViolation: false,
      createdAt: new Date().toISOString(),
    }
    const trades = storage.getTrades()
    storage.saveTrades([...trades, trade])
    storage.saveSettings({ totalAssets, maxRiskPerTrade: riskPercent })
    setSaved(true)
    setTimeout(() => {
      setForm({ ...emptyForm })
      setStep(1)
      setSaved(false)
    }, 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">ゲートキーパー</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">全条件を満たさない限り、エントリーは承認されない</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3, 4] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step > s
                  ? 'bg-[#10b981] text-white'
                  : step === s
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#1e1e30] text-[#374151]'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            {i < 3 && (
              <div
                className={`h-px flex-1 w-12 ${step > s ? 'bg-[#10b981]' : 'bg-[#1e1e30]'}`}
              />
            )}
          </div>
        ))}
        <div className="ml-2 text-xs text-[#6b7280]">
          {step === 1 && '根拠の入力'}
          {step === 2 && '価格の設定'}
          {step === 3 && '資金管理'}
          {step === 4 && 'エントリー審査結果'}
        </div>
      </div>

      {/* Step 1: Hypothesis (Gatekeeper) */}
      {step === 1 && (
        <StepCard title="STEP 1 — エントリー根拠の明示" locked={false}>
          <p className="text-xs text-[#f59e0b] mb-4 border border-[#f59e0b]/20 bg-[#f59e0b]/5 rounded px-3 py-2">
            ⚠ 「なんとなく」「SNSで話題だから」「急騰しているから」は根拠になりません。<br />
            需給の歪みが発生するイベント的根拠を、20文字以上で記述してください。
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ティッカー *">
              <input
                className="input"
                placeholder="7203"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
              />
            </Field>
            <Field label="銘柄名">
              <input
                className="input"
                placeholder="トヨタ自動車"
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="手法タグ">
              <select
                className="input"
                value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value as TradeTag }))}
              >
                {TRADE_TAGS.map(t => (
                  <option key={t} value={t}>{TRADE_TAG_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="方向性">
              <select
                className="input"
                value={form.direction}
                onChange={e => setForm(f => ({ ...f, direction: e.target.value as Direction }))}
              >
                <option value="LONG">↑ LONG（買い）</option>
                <option value="SHORT">↓ SHORT（売り）</option>
              </select>
            </Field>
          </div>

          <div className="mt-3">
            <Field label={`期待値の根拠 * (${form.hypothesis.length}文字 / 最低20文字)`}>
              <textarea
                className="input resize-none h-28"
                placeholder="例: TOB買付価格3,000円に対し市場価格が2,940円でディスカウント中。TOB成立確率が高く、確実な3,000円への収束が見込まれる。無リスクで2%のサヤが取れる状況。"
                value={form.hypothesis}
                onChange={e => setForm(f => ({ ...f, hypothesis: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-1">
            {form.hypothesis.length > 0 && form.hypothesis.length < 20 && (
              <p className="text-xs text-[#ef4444] mt-1">
                根拠が不十分です。あと{20 - form.hypothesis.length}文字以上記述してください。
              </p>
            )}
          </div>

          <GateStatus
            checks={[
              { label: 'ティッカー入力済', ok: form.ticker.length > 0 },
              { label: '根拠が20文字以上', ok: form.hypothesis.length >= 20 },
            ]}
          />

          <div className="flex justify-end mt-4">
            <button
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="px-5 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              STEP 2 へ →
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 2: Prices */}
      {step === 2 && (
        <StepCard title="STEP 2 — 価格の設定（逃げ道を先に決める）" locked={false}>
          <p className="text-xs text-[#6b7280] mb-4">
            損切りラインを先に決めてください。利確は後。逃げ場のないエントリーは禁止です。
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Field label={`エントリー価格 *`}>
              <input
                type="number"
                className="input"
                placeholder="2940"
                value={form.entryPrice}
                onChange={e => setForm(f => ({ ...f, entryPrice: e.target.value }))}
              />
            </Field>
            <Field label="損切りライン *">
              <input
                type="number"
                className="input"
                placeholder={form.direction === 'LONG' ? '2850' : '3050'}
                value={form.stopLossPrice}
                onChange={e => setForm(f => ({ ...f, stopLossPrice: e.target.value }))}
              />
            </Field>
            <Field label="利確ライン *">
              <input
                type="number"
                className="input"
                placeholder={form.direction === 'LONG' ? '3000' : '2800'}
                value={form.targetPrice}
                onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="エントリー予定日" className="mt-3">
            <input
              type="date"
              className="input"
              value={form.entryDate}
              onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
            />
          </Field>

          {entry > 0 && stop > 0 && target > 0 && (
            <div className="mt-4 p-3 bg-[#161624] border border-[#1e1e30] rounded-lg space-y-2">
              <PriceCheck form={form} />
            </div>
          )}

          <GateStatus
            checks={[
              { label: 'エントリー価格入力済', ok: entry > 0 },
              { label: '損切りライン入力済', ok: stop > 0 },
              { label: '利確ライン入力済', ok: target > 0 },
              {
                label: form.direction === 'LONG'
                  ? '価格関係: 損切 < エントリー < 利確'
                  : '価格関係: 利確 < エントリー < 損切',
                ok: step2Valid && entry > 0 && stop > 0 && target > 0,
              },
            ]}
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs text-[#6b7280] hover:text-[#e2e8f0] transition-colors"
            >
              ← 戻る
            </button>
            <button
              disabled={!step2Valid}
              onClick={() => setStep(3)}
              className="px-5 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              STEP 3 へ →
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 3: Risk Management */}
      {step === 3 && (
        <StepCard title="STEP 3 — 資金管理（買っていい株数の計算）" locked={false}>
          <p className="text-xs text-[#6b7280] mb-4">
            1回のトレードで許容する最大損失額から、最大購入株数を算出します。
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="現在の総資産（円）*">
              <input
                type="number"
                className="input"
                value={totalAssets}
                onChange={e => {
                  setTotalAssets(Number(e.target.value))
                  storage.saveSettings({ totalAssets: Number(e.target.value), maxRiskPerTrade: riskPercent })
                }}
              />
            </Field>
            <Field label="1トレード最大リスク率（%）*">
              <input
                type="number"
                className="input"
                min="0.1"
                max="5"
                step="0.1"
                value={riskPercent}
                onChange={e => {
                  setRiskPercent(Number(e.target.value))
                  storage.saveSettings({ totalAssets, maxRiskPerTrade: Number(e.target.value) })
                }}
              />
            </Field>
          </div>

          {/* Formula Display */}
          <div className="mt-4 bg-[#161624] border border-[#1e1e30] rounded-lg p-4 space-y-3">
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">計算式</p>
            <div className="mono text-xs text-[#6b7280] space-y-1">
              <p>許容損失額 = {formatCurrency(totalAssets)} × {riskPercent}% = <span className="text-[#f59e0b] font-semibold">{formatCurrency(maxRiskAmount)}</span></p>
              <p>1株あたりリスク = |{entry.toLocaleString()} - {stop.toLocaleString()}| = <span className="text-[#f59e0b] font-semibold">{Math.abs(entry - stop).toLocaleString()}円</span></p>
              <p className="border-t border-[#1e1e30] pt-2 mt-2">
                最大購入株数 = {formatCurrency(maxRiskAmount)} ÷ {Math.abs(entry - stop).toLocaleString()}円 = <span className="text-[#e2e8f0] font-bold text-base">{maxLots.toLocaleString()}株</span>
              </p>
            </div>
          </div>

          <GateStatus
            checks={[
              { label: '総資産入力済', ok: totalAssets > 0 },
              { label: 'リスク率が0.1〜5%の範囲内', ok: riskPercent >= 0.1 && riskPercent <= 5 },
            ]}
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs text-[#6b7280] hover:text-[#e2e8f0] transition-colors"
            >
              ← 戻る
            </button>
            <button
              disabled={!step3Valid}
              onClick={() => setStep(4)}
              className="px-5 py-2 bg-[#3b82f6] text-white text-xs font-semibold rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              審査結果を見る →
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 4: Result */}
      {step === 4 && (
        <StepCard title="STEP 4 — エントリー審査結果" locked={false}>
          {saved ? (
            <div className="text-center py-8">
              <p className="text-[#10b981] font-semibold text-lg">✓ トレードログに記録しました</p>
              <p className="text-xs text-[#6b7280] mt-2">リセット中...</p>
            </div>
          ) : (
            <>
              <div className="border border-[#10b981]/30 bg-[#10b981]/5 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#10b981] font-bold text-sm">✓ ENTRY APPROVED</span>
                  <span className="mono text-xs text-[#6b7280]">全条件クリア</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mono text-xs">
                  <ResultRow label="銘柄" value={`${form.ticker} ${form.companyName}`} />
                  <ResultRow
                    label="方向性"
                    value={form.direction === 'LONG' ? '↑ LONG（買い）' : '↓ SHORT（売り）'}
                    color={form.direction === 'LONG' ? 'green' : 'red'}
                  />
                  <ResultRow label="エントリー" value={`${entry.toLocaleString()}円`} />
                  <ResultRow label="損切りライン" value={`${stop.toLocaleString()}円`} color="red" />
                  <ResultRow label="利確ライン" value={`${target.toLocaleString()}円`} color="green" />
                  <ResultRow
                    label="リスクリワード比"
                    value={`1 : ${rr}`}
                    color={rr >= 2 ? 'green' : rr >= 1 ? 'amber' : 'red'}
                  />
                </div>
              </div>

              <div className="bg-[#161624] border border-[#1e1e30] rounded-lg p-4">
                <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-3">資金管理サマリー</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="mono text-3xl font-bold text-[#e2e8f0]">{maxLots.toLocaleString()}</p>
                    <p className="text-xs text-[#6b7280] mt-1">最大購入株数</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-[#6b7280]">最大損失額</span>
                      <span className="mono text-xs text-[#ef4444]">{formatCurrency(maxRiskAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#6b7280]">期待利益（最大）</span>
                      <span className="mono text-xs text-[#10b981]">{formatCurrency(expectedPnl)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#6b7280]">必要資金（概算）</span>
                      <span className="mono text-xs text-[#e2e8f0]">{formatCurrency(entry * maxLots)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 bg-[#161624] border border-[#1e1e30] rounded-lg p-3">
                <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">記録した根拠</p>
                <p className="text-xs text-[#e2e8f0] leading-relaxed">{form.hypothesis}</p>
              </div>

              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs text-[#6b7280] hover:text-[#e2e8f0] transition-colors"
                >
                  ← 戻る
                </button>
                <button
                  onClick={saveToLog}
                  className="px-5 py-2 bg-[#10b981] text-white text-xs font-semibold rounded hover:bg-emerald-400 transition-colors"
                >
                  トレードログに記録 →
                </button>
              </div>
            </>
          )}
        </StepCard>
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

function StepCard({ title, children, locked }: { title: string; children: React.ReactNode; locked: boolean }) {
  return (
    <div className={`border rounded-xl p-6 space-y-4 ${locked ? 'border-[#1e1e30] opacity-50' : 'border-[#1e1e30] bg-[#0f0f1a]'}`}>
      <h2 className="text-xs font-semibold text-[#e2e8f0] tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function GateStatus({ checks }: { checks: { label: string; ok: boolean }[] }) {
  const allOk = checks.every(c => c.ok)
  return (
    <div className={`mt-4 border rounded-lg p-3 ${allOk ? 'border-[#10b981]/30 bg-[#10b981]/5' : 'border-[#ef4444]/30 bg-[#ef4444]/5'}`}>
      <p className={`text-xs font-semibold mb-2 ${allOk ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
        {allOk ? '✓ CLEARED' : '✗ BLOCKED'}
      </p>
      <div className="space-y-1">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2">
            <span className={`text-[11px] ${c.ok ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
              {c.ok ? '✓' : '✗'}
            </span>
            <span className="text-[11px] text-[#6b7280]">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PriceCheck({ form }: { form: GateForm }) {
  const entry = parseFloat(form.entryPrice)
  const stop = parseFloat(form.stopLossPrice)
  const target = parseFloat(form.targetPrice)
  const rr = calcRiskReward(entry, stop, target, form.direction)
  const isValid = form.direction === 'LONG'
    ? stop < entry && target > entry
    : stop > entry && target < entry

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#6b7280]">リスクリワード比</span>
        <span className={`mono text-xs font-semibold ${rr >= 2 ? 'text-[#10b981]' : rr >= 1 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
          1 : {rr} {rr < 1 ? '⚠ 推奨1以上' : rr >= 2 ? '◎ 優良' : '△'}
        </span>
      </div>
      {!isValid && (
        <p className="text-[11px] text-[#ef4444]">
          {form.direction === 'LONG'
            ? '損切 < エントリー < 利確 の順になるよう設定してください'
            : '利確 < エントリー < 損切 の順になるよう設定してください'}
        </p>
      )}
    </div>
  )
}

function ResultRow({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' | 'amber' }) {
  const c = color === 'green' ? 'text-[#10b981]' : color === 'red' ? 'text-[#ef4444]' : color === 'amber' ? 'text-[#f59e0b]' : 'text-[#e2e8f0]'
  return (
    <div className="flex justify-between">
      <span className="text-[#6b7280]">{label}</span>
      <span className={c}>{value}</span>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}
