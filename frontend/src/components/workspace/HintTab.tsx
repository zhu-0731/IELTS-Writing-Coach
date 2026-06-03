import { useEffect, useState, useCallback } from 'react'
import { getHints, matchHints, recordHintAction, type HintCard } from '../../api/client'
import { copy } from '../../i18n'

const c = copy.workspace.sidebar.hintTab

type Action = 'used' | 'see_ref' | 'next' | 'too_hard' | 'irrelevant'
type Mode = 'regular' | 'matching' | 'matched' | 'match_error'

interface Props {
  taskType: string
  essayId: string | null
  prompt: string
  questionType: string
}

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T } catch { return fallback }
}

const TYPE_COLOR: Record<string, string> = {
  pattern:          'bg-brand-muted text-brand',
  collocation:      'bg-ok-light text-ok',
  expression:       'bg-warn-light text-warn',
  logic_template:   'bg-[#F3E8FF] text-[#7C3AED]',
  error_correction: 'bg-danger-light text-danger',
}

// ── Single card ───────────────────────────────────────────────────────────────
function HintCardView({
  card,
  idx,
  total,
  onAction,
}: {
  card: HintCard
  idx: number
  total: number
  onAction: (a: Action) => void
}) {
  const items      = parseJson<string[]>(card.items_json, [])
  const logicChain = parseJson<string[]>(card.zh_logic_chain_json, [])
  const errors     = parseJson<string[]>(card.common_errors_json, [])
  const typeColor  = TYPE_COLOR[card.type] ?? 'bg-muted text-dim'
  const typeName   = c.typeLabel[card.type as keyof typeof c.typeLabel] ?? card.type

  const handleAction = (action: Action) => {
    // 'see_ref' is no longer used — pattern is always visible
    onAction(action)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header: type + mastery + card index */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
          {typeName}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-1 bg-brand rounded-full"
              style={{ width: `${card.mastery_score * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-ghost tabular-nums">{c.cardOf(idx + 1, total)}</span>
        </div>
      </div>

      {/* ── Core content: pattern shown directly ── */}
      {card.pattern && (
        <div className="bg-brand-light border border-brand-muted rounded-card px-3 py-2.5">
          <p className="text-[10px] font-semibold text-brand mb-1.5">
            {card.type === 'pattern' ? '句型骨架' : card.type === 'collocation' ? '搭配词块' : '练习表达'}
          </p>
          <p className="text-sm font-mono text-ink leading-relaxed break-words">{card.pattern}</p>
        </div>
      )}

      {/* Example sentences (when seed resource has items) */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-ghost uppercase tracking-wide">例句</p>
          {items.slice(0, 2).map((item, i) => (
            <p key={i} className="text-xs text-dim leading-relaxed pl-2 border-l-2 border-line">
              {item}
            </p>
          ))}
        </div>
      )}

      {/* Name + goal — secondary context, shown below the actionable content */}
      <div>
        <p className="text-xs font-semibold text-ink leading-snug">{card.name}</p>
        {card.zh_goal && (
          <p className="text-[11px] text-ghost mt-0.5 leading-relaxed">{card.zh_goal}</p>
        )}
      </div>

      {/* Logic chain (for logic_template type) */}
      {logicChain.length > 0 && (
        <div className="bg-muted rounded-card p-3">
          <p className="text-[10px] font-semibold text-ghost uppercase tracking-wide mb-2">逻辑链</p>
          <ol className="space-y-1">
            {logicChain.map((step, i) => (
              <li key={i} className="text-xs text-dim leading-relaxed">{step}</li>
            ))}
          </ol>
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

      {/* Actions */}
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
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HintTab({ taskType, essayId, prompt, questionType: _questionType }: Props) {
  const [hints, setHints]       = useState<HintCard[]>([])
  const [idx, setIdx]           = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState<Mode>('regular')
  const [matchContext, setMatchContext] = useState('')

  // Load regular (low-mastery) hints
  const loadRegular = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getHints(taskType)
      setHints(data)
      setIdx(0)
    } catch {
      setError(c.error)
    } finally {
      setLoading(false)
    }
  }, [taskType])

  useEffect(() => {
    setMode('regular')
    setMatchContext('')
    loadRegular()
  }, [loadRegular])

  // Topic-aware matching
  const handleMatch = async () => {
    setMode('matching')
    try {
      const result = await matchHints({ prompt, task_type: taskType, essay_id: essayId })
      if (result.hints.length === 0) {
        // Fall back to regular if nothing matched
        setMode('regular')
        return
      }
      setHints(result.hints)
      setMatchContext(result.context)
      setIdx(0)
      setMode('matched')
    } catch {
      setMode('match_error')
    }
  }

  const returnToRegular = () => {
    setMatchContext('')
    setMode('regular')
    loadRegular()
  }

  const fireAction = (card: HintCard, action: Action) => {
    recordHintAction(card.resource_id, { essay_id: essayId, action }).catch(() => {})
  }

  const handleAction = (action: Action) => {
    const card = hints[idx]
    if (!card) return
    fireAction(card, action)
    if (action !== 'see_ref') {
      setIdx((i) => (i + 1) % hints.length)
    }
  }

  // ── Loading states ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <span className="text-sm text-ghost animate-pulse">{c.loading}</span>
      </div>
    )
  }

  if (mode === 'matching') {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <span className="text-sm text-ghost animate-pulse">{c.matching}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-3 px-4">
        <span className="text-sm text-danger text-center">{error}</span>
        <button onClick={loadRegular} className="text-xs text-brand hover:underline">重试</button>
      </div>
    )
  }

  if (mode === 'match_error') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-3 px-4">
        <span className="text-sm text-danger text-center">{c.matchError}</span>
        <button onClick={returnToRegular} className="text-xs text-brand hover:underline">
          {c.showAll}
        </button>
      </div>
    )
  }

  if (hints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] px-4 gap-4">
        <span className="text-sm text-ghost text-center">{c.noHints}</span>
      </div>
    )
  }

  const card = hints[idx]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 flex flex-col gap-3">

        {/* ── Matched context box ── */}
        {mode === 'matched' && matchContext && (
          <div className="bg-brand-light border border-brand-muted rounded-card px-3 py-2.5">
            <p className="text-[11px] font-semibold text-brand mb-1">🎯 题目相关推荐</p>
            <p className="text-xs text-dim leading-relaxed">{matchContext}</p>
          </div>
        )}

        {/* ── Card ── */}
        <HintCardView
          card={card}
          idx={idx}
          total={hints.length}
          onAction={handleAction}
        />

        {/* ── Bottom action row ── */}
        <div className="pt-1 border-t border-line/50 flex items-center justify-between gap-2">
          {mode === 'matched' ? (
            <>
              <button
                onClick={handleMatch}
                className="text-[11px] text-brand hover:text-brand-hover font-medium transition-colors"
              >
                {c.rematch}
              </button>
              <button
                onClick={returnToRegular}
                className="text-[11px] text-ghost hover:text-dim transition-colors"
              >
                {c.showAll}
              </button>
            </>
          ) : (
            prompt.trim() ? (
              <button
                onClick={handleMatch}
                className="w-full py-2 text-xs font-semibold rounded-btn bg-brand text-white hover:bg-brand-hover transition-colors"
              >
                🎯 {c.matchBtn}
              </button>
            ) : (
              <p className="text-[11px] text-ghost/70 text-center w-full leading-relaxed">
                填写题目后，可根据题目内容智能推荐相关表达
              </p>
            )
          )}
        </div>

      </div>
    </div>
  )
}
