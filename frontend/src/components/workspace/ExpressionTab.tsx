import { useState } from 'react'
import { generateExpression, type ExpressionResult, type ExpressionLevel } from '../../api/client'
import { copy } from '../../i18n'
import Button from '../ui/Button'

const c = copy.workspace.sidebar.expressionTab

interface Props {
  taskType: string
  onInsertText: (text: string) => void
}

type Phase = 'idle' | 'loading' | 'result' | 'error'

const LEVEL_CONFIG = [
  { key: 'low_risk' as const,   label: c.lowRisk,    color: 'bg-ok-light border-ok/20 text-ok' },
  { key: 'recommended' as const, label: c.recommended, color: 'bg-brand-light border-brand-muted text-brand' },
  { key: 'advanced' as const,   label: c.advanced,   color: 'bg-warn-light border-warn/20 text-warn' },
]

function LevelCard({
  label,
  color,
  level,
  onInsert,
}: {
  label: string
  color: string
  level: ExpressionLevel
  onInsert: (text: string) => void
}) {
  return (
    <div className="rounded-card border border-line p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
          {label}
        </span>
        <button
          onClick={() => onInsert(level.en)}
          className="text-[11px] text-brand hover:text-brand-hover transition-colors font-medium"
        >
          {c.insert}
        </button>
      </div>
      <p className="text-xs text-ink leading-relaxed">{level.en}</p>
      <p className="text-[11px] text-ghost leading-relaxed">
        <span className="font-medium text-dim">{c.whenToUse}：</span>
        {level.tip}
      </p>
    </div>
  )
}

export default function ExpressionTab({ taskType, onInsertText }: Props) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ExpressionResult | null>(null)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!input.trim()) return
    setPhase('loading')
    setError('')
    try {
      const data = await generateExpression({ chinese_text: input.trim(), task_type: taskType })
      setResult(data)
      setPhase('result')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : c.error
      setError(msg.includes('API Key') || msg.includes('400')
        ? '请先前往「设置」页配置 API Key 和 Model Name。'
        : c.error)
      setPhase('error')
    }
  }

  const reset = () => {
    setPhase('idle')
    setResult(null)
    setInput('')
    setError('')
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <span className="text-sm text-ghost animate-pulse">{c.generating}</span>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-3 px-4">
        <p className="text-sm text-danger text-center leading-relaxed">{error}</p>
        <Button variant="secondary" size="sm" onClick={reset}>{c.reset}</Button>
      </div>
    )
  }

  // ── Result ────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-3">
        <div className="bg-muted rounded-card px-3 py-2 text-xs text-dim italic leading-relaxed">
          「{input}」
        </div>

        {LEVEL_CONFIG.map(({ key, label, color }) => (
          <LevelCard
            key={key}
            label={label}
            color={color}
            level={result[key]}
            onInsert={onInsertText}
          />
        ))}

        {result.usage_guide && (
          <div className="bg-muted rounded-card p-3">
            <p className="text-[10px] font-semibold text-ghost mb-1">{c.usageGuide}</p>
            <p className="text-xs text-dim leading-relaxed">{result.usage_guide}</p>
          </div>
        )}

        <button
          onClick={reset}
          className="text-xs text-ghost hover:text-dim text-center transition-colors"
        >
          {c.reset}
        </button>
      </div>
    )
  }

  // ── Idle / Input ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <p className="text-xs text-ghost leading-relaxed">
        输入你想用英文表达的中文内容，获取低风险、推荐和高分三档表达。
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={c.placeholder}
        rows={4}
        className="w-full rounded-input border border-line bg-canvas px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ghost/60"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      />
      <Button
        variant="primary"
        onClick={submit}
        disabled={!input.trim()}
        className="w-full"
      >
        {c.generate}
      </Button>
      <p className="text-[11px] text-ghost/70 text-center">Ctrl+Enter 快速提交</p>
    </div>
  )
}
