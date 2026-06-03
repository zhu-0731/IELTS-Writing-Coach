import { useEffect, useState, useCallback } from 'react'
import { getHints, recordHintAction, type HintCard } from '../../api/client'
import { copy } from '../../i18n'

const c = copy.workspace.sidebar.hintTab

type Action = 'used' | 'see_ref' | 'next' | 'too_hard' | 'irrelevant'

interface Props {
  taskType: string
  essayId: string | null
}

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T } catch { return fallback }
}

const TYPE_COLOR: Record<string, string> = {
  pattern: 'bg-brand-muted text-brand',
  collocation: 'bg-ok-light text-ok',
  expression: 'bg-warn-light text-warn',
  logic_template: 'bg-[#F3E8FF] text-[#7C3AED]',
  error_correction: 'bg-danger-light text-danger',
}

export default function HintTab({ taskType, essayId }: Props) {
  const [hints, setHints] = useState<HintCard[]>([])
  const [idx, setIdx] = useState(0)
  const [showRef, setShowRef] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getHints(taskType)
      setHints(data)
      setIdx(0)
      setShowRef(false)
    } catch {
      setError(c.error)
    } finally {
      setLoading(false)
    }
  }, [taskType])

  useEffect(() => { load() }, [load])

  const fireAction = (card: HintCard, action: Action) => {
    recordHintAction(card.resource_id, { essay_id: essayId, action }).catch(() => {})
  }

  const next = () => {
    setIdx((i) => (i + 1) % hints.length)
    setShowRef(false)
  }

  const handleAction = (action: Action) => {
    const card = hints[idx]
    if (!card) return
    fireAction(card, action)
    if (action !== 'see_ref') {
      next()
    } else {
      setShowRef((v) => !v)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <span className="text-sm text-ghost animate-pulse">{c.loading}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-3 px-4">
        <span className="text-sm text-danger text-center">{error}</span>
        <button
          onClick={load}
          className="text-xs text-brand hover:underline"
        >
          重试
        </button>
      </div>
    )
  }

  if (hints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] px-4">
        <span className="text-sm text-ghost text-center">{c.noHints}</span>
      </div>
    )
  }

  const card = hints[idx]
  const items = parseJson<string[]>(card.items_json, [])
  const logicChain = parseJson<string[]>(card.zh_logic_chain_json, [])
  const errors = parseJson<string[]>(card.common_errors_json, [])
  const typeColor = TYPE_COLOR[card.type] ?? 'bg-muted text-dim'
  const typeName = c.typeLabel[card.type as keyof typeof c.typeLabel] ?? card.type

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
            {typeName}
          </span>
          <span className="text-[11px] text-ghost tabular-nums">
            {c.cardOf(idx + 1, hints.length)}
          </span>
        </div>

        {/* Name + goal */}
        <div>
          <p className="text-sm font-semibold text-ink leading-snug">{card.name}</p>
          <p className="text-xs text-dim mt-1 leading-relaxed">{card.zh_goal}</p>
        </div>

        {/* Logic chain (for logic_template type) */}
        {logicChain.length > 0 && (
          <div className="bg-muted rounded-card p-3">
            <p className="text-[10px] font-semibold text-ghost uppercase tracking-wide mb-2">
              逻辑链
            </p>
            <ol className="space-y-1">
              {logicChain.map((step, i) => (
                <li key={i} className="text-xs text-dim leading-relaxed">{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Reference (toggle) */}
        {(card.pattern || items.length > 0) && (
          <div>
            <button
              onClick={() => handleAction('see_ref')}
              className="text-xs font-medium text-brand hover:text-brand-hover flex items-center gap-1 transition-colors"
            >
              {showRef ? c.hideRef : c.showRef}
              <span className="text-[10px]">{showRef ? '▲' : '▼'}</span>
            </button>

            {showRef && (
              <div className="mt-2 bg-brand-light rounded-card p-3 space-y-2 border border-brand-muted">
                {card.pattern && (
                  <p className="text-xs font-mono text-brand leading-relaxed break-words">
                    {card.pattern}
                  </p>
                )}
                {items.length > 0 && (
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-xs text-dim leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Common errors */}
        {errors.length > 0 && (
          <div className="bg-warn-light rounded-card p-3 border border-warn/20">
            <p className="text-[10px] font-semibold text-warn mb-1.5">{c.commonErrors}</p>
            <ul className="space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-dim leading-relaxed">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Mastery */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-1 bg-brand rounded-full transition-all"
              style={{ width: `${card.mastery_score * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-ghost whitespace-nowrap">
            {c.masteryLabel[card.mastery as keyof typeof c.masteryLabel] ?? card.mastery}
          </span>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            onClick={() => handleAction('used')}
            className="col-span-1 py-1.5 text-[11px] font-medium rounded-btn bg-ok-light text-ok hover:bg-ok/20 transition-colors"
          >
            {c.markUsed}
          </button>
          <button
            onClick={() => handleAction('next')}
            className="col-span-1 py-1.5 text-[11px] font-medium rounded-btn bg-muted text-dim hover:bg-line transition-colors"
          >
            {c.next}
          </button>
          <button
            onClick={() => handleAction('too_hard')}
            className="col-span-1 py-1.5 text-[11px] font-medium rounded-btn bg-danger-light text-danger hover:bg-danger/20 transition-colors"
          >
            {c.tooHard}
          </button>
        </div>
        <button
          onClick={() => handleAction('irrelevant')}
          className="w-full py-1 text-[11px] text-ghost hover:text-dim transition-colors text-center"
        >
          {c.irrelevant}
        </button>
      </div>
    </div>
  )
}
