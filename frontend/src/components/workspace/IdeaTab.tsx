import { useState } from 'react'
import { generateIdea, type IdeaResult, type IdeaStance } from '../../api/client'
import { copy } from '../../i18n'
import Button from '../ui/Button'

const c = copy.workspace.sidebar.ideaTab

interface Props {
  taskType: string
  questionType: string
  prompt: string
  essayId: string | null
}

type Phase = 'idle' | 'loading' | 'result' | 'error'

export default function IdeaTab({ taskType, questionType, prompt, essayId }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<IdeaResult | null>(null)
  const [error, setError] = useState('')
  const [selectedStance, setSelectedStance] = useState<IdeaStance | null>(null)

  const hasPrompt = prompt.trim().length > 0

  const generate = async () => {
    setPhase('loading')
    setResult(null)
    setSelectedStance(null)
    setError('')
    try {
      const data = await generateIdea({ task_type: taskType, question_type: questionType, prompt, essay_id: essayId })
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
    setSelectedStance(null)
    setError('')
  }

  // ── Idle ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    if (!hasPrompt) {
      return (
        <div className="flex items-center justify-center h-full min-h-[240px] px-4">
          <p className="text-sm text-ghost text-center leading-relaxed">{c.noPrompt}</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-4 px-4">
        <p className="text-xs text-ghost text-center leading-relaxed max-w-[200px]">
          基于当前题目，生成审题分析和立场选项
        </p>
        <Button variant="primary" onClick={generate}>{c.generate}</Button>
      </div>
    )
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
        <Button variant="secondary" size="sm" onClick={reset}>{c.regenerate}</Button>
      </div>
    )
  }

  // ── Result: stance selected ───────────────────────────────────────────
  if (result && selectedStance) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
        <button
          onClick={() => setSelectedStance(null)}
          className="text-xs text-brand hover:underline self-start"
        >
          {c.back}
        </button>

        <div className="bg-brand-light rounded-card p-3 border border-brand-muted">
          <p className="text-xs font-semibold text-brand mb-0.5">{c.chooseStance}</p>
          <p className="text-sm font-bold text-ink">{selectedStance.label}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-ghost uppercase tracking-wide mb-2">
            {c.logicChain}
          </p>
          <ol className="space-y-2">
            {selectedStance.logic_chain.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-muted text-brand text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-xs text-dim leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {result.usage_note && (
          <div className="bg-muted rounded-card p-3">
            <p className="text-[10px] font-semibold text-ghost mb-1">{c.usageNote}</p>
            <p className="text-xs text-dim leading-relaxed">{result.usage_note}</p>
          </div>
        )}

        <button
          onClick={generate}
          className="text-xs text-ghost hover:text-dim text-center transition-colors"
        >
          {c.regenerate}
        </button>
      </div>
    )
  }

  // ── Result: choose stance ─────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
        <div>
          <p className="text-[11px] font-semibold text-ghost uppercase tracking-wide mb-1.5">
            {c.taskBreakdown}
          </p>
          <p className="text-xs text-dim leading-relaxed">{result.task_breakdown}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-ghost uppercase tracking-wide mb-2">
            {c.chooseStance}
          </p>
          <div className="space-y-2">
            {result.stances.map((stance, i) => (
              <button
                key={i}
                onClick={() => setSelectedStance(stance)}
                className="w-full text-left px-3 py-2.5 rounded-card border border-line bg-surface hover:border-brand hover:bg-brand-light transition-all"
              >
                <p className="text-xs font-semibold text-ink">{stance.label}</p>
                <p className="text-[11px] text-ghost mt-0.5">
                  {stance.logic_chain.length} 个段落 · 点击查看展开思路
                </p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generate}
          className="text-xs text-ghost hover:text-dim text-center transition-colors"
        >
          {c.regenerate}
        </button>
      </div>
    )
  }

  return null
}
