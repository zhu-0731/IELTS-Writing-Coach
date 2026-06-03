import { useEffect, useState, useCallback } from 'react'
import { getHints, matchHints, recordHintAction, type HintCard } from '../../api/client'
import { copy } from '../../i18n'

const c = copy.workspace.sidebar.hintTab

type Action = 'used' | 'next' | 'too_hard' | 'irrelevant'
type Mode = 'regular' | 'matching' | 'matched' | 'match_error'
type RevealState = 0 | 1 | 2   // 0=hidden 1=hint(Chinese) 2=English revealed

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
  onAction,
}: {
  card: HintCard
  onAction: (a: Action) => void
}) {
  const [reveal, setReveal] = useState<RevealState>(0)
  const items     = parseJson<string[]>(card.items_json, [])
  const typeColor = TYPE_COLOR[card.type] ?? 'bg-muted text-dim'
  const typeName  = c.typeLabel[card.type as keyof typeof c.typeLabel] ?? card.type

  const patternLabel =
    card.type === 'pattern'     ? '句型骨架' :
    card.type === 'collocation' ? '搭配词块' : '练习表达'

  return (
    <div className="rounded-card border border-line bg-surface p-3 flex flex-col gap-2.5">
      {/* Header: type badge + name + mastery bar */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
          {typeName}
        </span>
        <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{card.name}</span>
        <div className="shrink-0 w-10 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-1 bg-brand rounded-full" style={{ width: `${card.mastery_score * 100}%` }} />
        </div>
      </div>

      {/* Reveal area — 3 states */}
      {reveal === 0 && (
        // State 0: only name visible, prompt to reveal hint
        <button
          onClick={() => setReveal(1)}
          className="text-left text-[11px] text-brand hover:text-brand-hover transition-colors"
        >
          查看提示 →
        </button>
      )}

      {reveal === 1 && (
        // State 1: Chinese usage hint, click to reveal English
        <button
          onClick={() => setReveal(2)}
          className="text-left w-full bg-brand-light border border-brand-muted rounded-card px-3 py-2 flex flex-col gap-1"
        >
          <p className="text-xs text-dim leading-relaxed">{card.zh_goal}</p>
          <p className="text-[10px] text-brand font-medium">点击查看英文表达 →</p>
        </button>
      )}

      {reveal === 2 && (
        // State 2: English pattern revealed
        <div className="bg-brand-light border border-brand-muted rounded-card px-3 py-2.5 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-brand">{patternLabel}</p>
          <p className="text-sm font-mono text-ink leading-relaxed break-words">{card.pattern}</p>
          {items.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {items.slice(0, 2).map((item, i) => (
                <p key={i} className="text-xs text-dim leading-relaxed pl-2 border-l-2 border-brand/30">
                  {item}
                </p>
              ))}
            </div>
          )}
          <button
            onClick={() => setReveal(0)}
            className="self-start text-[10px] text-ghost hover:text-dim transition-colors mt-0.5"
          >
            收起
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onAction('used')}
          className="px-2.5 py-1 text-[11px] font-medium rounded-btn bg-ok-light text-ok hover:bg-ok/20 transition-colors"
        >
          {c.markUsed}
        </button>
        <button
          onClick={() => onAction('too_hard')}
          className="px-2.5 py-1 text-[11px] font-medium rounded-btn bg-danger-light text-danger hover:bg-danger/20 transition-colors"
        >
          {c.tooHard}
        </button>
        <button
          onClick={() => onAction('irrelevant')}
          className="px-2 py-1 text-[11px] text-ghost hover:text-dim transition-colors"
        >
          {c.irrelevant}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HintTab({ taskType, essayId, prompt, questionType: _questionType }: Props) {
  const [hints, setHints]             = useState<HintCard[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [mode, setMode]               = useState<Mode>('regular')
  const [matchContext, setMatchContext] = useState('')

  const loadRegular = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getHints(taskType, 8)
      setHints(data)
      setMode('regular')
      setMatchContext('')
    } catch {
      setError(c.error)
    } finally {
      setLoading(false)
    }
  }, [taskType])

  useEffect(() => { loadRegular() }, [loadRegular])

  const handleMatch = async () => {
    setMode('matching')
    try {
      const result = await matchHints({ prompt, task_type: taskType, essay_id: essayId, limit: 6 })
      if (result.hints.length === 0) {
        loadRegular()
        return
      }
      setHints(result.hints)
      setMatchContext(result.context)
      setMode('matched')
    } catch {
      setMode('match_error')
    } finally {
      setLoading(false)
    }
  }

  const fireAction = (card: HintCard, action: Action) => {
    recordHintAction(card.resource_id, { essay_id: essayId, action }).catch(() => {})
  }

  // ── Loading / error states ────────────────────────────────────────────────
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
        <button onClick={loadRegular} className="text-xs text-brand hover:underline">{c.showAll}</button>
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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 flex flex-col gap-3">

        {/* Matched context box */}
        {mode === 'matched' && matchContext && (
          <div className="bg-brand-light border border-brand-muted rounded-card px-3 py-2.5">
            <p className="text-[11px] font-semibold text-brand mb-1">🎯 题目相关推荐</p>
            <p className="text-xs text-dim leading-relaxed">{matchContext}</p>
          </div>
        )}

        {/* Card list */}
        {hints.map((card) => (
          <HintCardView
            key={card.resource_id}
            card={card}
            onAction={(action) => fireAction(card, action)}
          />
        ))}

        {/* Bottom action row */}
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
                onClick={loadRegular}
                className="text-[11px] text-ghost hover:text-dim transition-colors"
              >
                {c.showAll}
              </button>
            </>
          ) : prompt.trim() ? (
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
          )}
        </div>

      </div>
    </div>
  )
}
