import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runDiagnosis, type DiagnosisResult } from '../../api/client'
import { copy } from '../../i18n'
import Button from '../ui/Button'

const c = copy.workspace.diagModal

interface Props {
  essayId: string | null
  taskType: string
  questionType: string
  prompt: string
  promptImage?: string | null
  content: string
  wordCount: number
  onClose: () => void
}

type Phase = 'loading' | 'result' | 'error'

const SEVERITY_COLOR: Record<string, string> = {
  high: 'bg-danger-light text-danger',
  medium: 'bg-warn-light text-warn',
}

export default function DiagnosisModal({
  essayId,
  taskType,
  questionType,
  prompt,
  promptImage,
  content,
  wordCount,
  onClose,
}: Props) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [error, setError] = useState('')

  const diagnose = async () => {
    setPhase('loading')
    setError('')
    try {
      const data = await runDiagnosis({
        essay_id: essayId,
        task_type: taskType,
        question_type: questionType,
        prompt,
        content,
        image_base64: promptImage ?? undefined,
      })
      setResult(data)
      setPhase('result')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : c.errorDefault
      setError(
        msg.includes('API Key') || msg.includes('400')
          ? c.errorNoKey
          : c.errorDefault,
      )
      setPhase('error')
    }
  }

  useEffect(() => { diagnose() }, [])

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-surface rounded-panel shadow-panel w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 className="text-base font-semibold text-ink">{c.title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-btn text-ghost hover:bg-muted hover:text-dim transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Loading ─────────────────────────────────── */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-ink">{c.loading}</p>
              <p className="text-xs text-ghost text-center max-w-xs">{c.loadingHint}</p>
            </div>
          )}

          {/* ── Error ───────────────────────────────────── */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm text-danger text-center leading-relaxed max-w-sm">{error}</p>
              <Button variant="secondary" onClick={diagnose}>{c.retry}</Button>
            </div>
          )}

          {/* ── Result ──────────────────────────────────── */}
          {phase === 'result' && result && (
            <>
              {/* Band + word count */}
              <div className="flex items-center gap-4 bg-muted rounded-card p-4">
                <div className="text-center">
                  <p className="text-[10px] text-ghost uppercase tracking-wide">{c.estimatedBand}</p>
                  <p className="text-3xl font-bold text-ink mt-0.5">{result.estimated_band}</p>
                </div>
                <div className="w-px h-10 bg-line" />
                <div className="text-sm text-dim">
                  <p>{c.wordCount(wordCount)}</p>
                  <p className="text-xs text-ghost mt-0.5">{c.bandNote}</p>
                </div>
              </div>

              {/* Dimension scores */}
              {(result.dimension_scores?.length ?? 0) > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-ghost uppercase tracking-wide mb-3">
                    {c.dimensionScores}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.dimension_scores?.map((item) => (
                      <div key={item.key} className="rounded-card border border-line bg-canvas/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">{item.label_zh}</p>
                            <p className="text-[10px] text-ghost mt-0.5">{item.official_name}</p>
                          </div>
                          <p className="shrink-0 text-lg font-semibold text-brand">
                            {item.band || (item.score == null ? 'N/A' : item.score.toFixed(1))}
                          </p>
                        </div>
                        {item.reason_zh && (
                          <div className="mt-2 pt-2 border-t border-line/70">
                            <p className="text-[10px] text-ghost font-medium">{c.scoreReason}</p>
                            <p className="text-xs text-dim mt-0.5 leading-relaxed">{item.reason_zh}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.diagnosis_scope_note && (
                <section className="bg-muted rounded-card p-3 border border-line">
                  <p className="text-xs text-dim leading-relaxed">{result.diagnosis_scope_note}</p>
                </section>
              )}

              {/* Main problems */}
              {result.main_problems.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-ghost uppercase tracking-wide mb-3">
                    {c.mainProblems}
                  </h3>
                  <div className="space-y-2">
                    {result.main_problems.map((p, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEVERITY_COLOR[p.severity] ?? 'bg-muted text-dim'}`}>
                          {p.severity === 'high' ? c.severityHigh : c.severityMedium}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-ink">{p.category}</p>
                          <p className="text-xs text-dim mt-0.5 leading-relaxed">{p.issue}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Top 3 sentence fixes */}
              {result.top_sentence_fixes.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-ghost uppercase tracking-wide mb-3">
                    {c.topFixes}
                  </h3>
                  <div className="space-y-4">
                    {result.top_sentence_fixes.map((fix, i) => (
                      <div key={i} className="rounded-card border border-line p-4 space-y-2.5">
                        <div>
                          <p className="text-[10px] text-ghost font-medium">{c.original}</p>
                          <p className="text-xs text-dim mt-0.5 leading-relaxed italic">
                            &ldquo;{fix.original}&rdquo;
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ghost font-medium">{c.problemLabel}</p>
                          <p className="text-xs text-danger mt-0.5 leading-relaxed">{fix.problem}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ghost font-medium">{c.suggestion}</p>
                          <p className="text-xs text-ok font-medium mt-0.5 leading-relaxed">
                            {fix.suggestion}
                          </p>
                        </div>
                        <p className="text-[10px] text-brand">{c.resourceSaved}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Template misuse */}
              {result.template_misuse && (
                <section className="bg-warn-light rounded-card p-4 border border-warn/20">
                  <p className="text-xs font-semibold text-warn mb-1">{c.templateMisuse}</p>
                  <p className="text-xs text-dim leading-relaxed">{result.template_misuse}</p>
                </section>
              )}

              {/* Next training task */}
              {result.next_training_task && (
                <section className="bg-brand-light rounded-card p-4 border border-brand-muted">
                  <p className="text-xs font-semibold text-brand mb-1">{c.nextTask}</p>
                  <p className="text-xs text-dim leading-relaxed">{result.next_training_task}</p>
                </section>
              )}

              {/* Saved resources notice */}
              <p className="text-xs text-center text-ghost">
                {result.saved_resource_count > 0
                  ? c.savedResources(result.saved_resource_count)
                  : c.noNewResources}
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {phase !== 'loading' && (
          <div className="shrink-0 px-6 py-4 border-t border-line flex items-center justify-between gap-3">
            {phase === 'result' && essayId ? (
              <button
                onClick={() => {
                  onClose()
                  navigate(`/practice/new?essay=${essayId}&mode=cloze`)
                }}
                className="px-4 py-2 text-sm font-medium rounded-btn bg-ok-light text-ok hover:bg-ok/20 transition-colors"
              >
                ✏️ {copy.practice.diagStartBtn}
              </button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={onClose}>{c.close}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
