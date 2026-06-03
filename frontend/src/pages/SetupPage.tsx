import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfile, type ProfileData } from '../api/client'
import { copy } from '../i18n'

const c = copy.setup
const opt = copy.setup.options
const q = copy.setup.questions

const STEPS = [
  {
    key: 'target_band',
    question: q.target_band.q,
    multi: false,
    options: ['5.5', '6.0', '6.5', '7.0+'],
  },
  {
    key: 'main_task',
    question: q.main_task.q,
    multi: false,
    options: [
      { label: opt.task1,   value: 'task1' },
      { label: opt.task2,   value: 'task2' },
      { label: opt.taskBoth, value: 'both' },
    ],
  },
  {
    key: 'main_problem',
    question: q.main_problem.q,
    hint: q.main_problem.hint,
    multi: true,
    options: [opt.problem1, opt.problem2, opt.problem3, opt.problem4, opt.problem5],
  },
  {
    key: 'template_style',
    question: q.template_style.q,
    multi: false,
    options: [opt.styleSafe, opt.styleMid, opt.styleAdv],
  },
  {
    key: 'allow_profile_update',
    question: q.allow_profile_update.q,
    hint: q.allow_profile_update.hint,
    multi: false,
    options: [
      { label: opt.profileYes, value: 'true' },
      { label: opt.profileNo,  value: 'false' },
    ],
  },
]

type Answers = Record<string, string>
type MultiAnswers = Record<string, string[]>

interface Props {
  onComplete: () => void
}

export default function SetupPage({ onComplete }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [multiAnswers, setMultiAnswers] = useState<MultiAnswers>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function getOptionValue(opt: string | { label: string; value: string }) {
    return typeof opt === 'string' ? opt : opt.value
  }

  function getOptionLabel(opt: string | { label: string; value: string }) {
    return typeof opt === 'string' ? opt : opt.label
  }

  function isSelected(val: string): boolean {
    return current.multi
      ? (multiAnswers[current.key] ?? []).includes(val)
      : answers[current.key] === val
  }

  function hasSelection(): boolean {
    return current.multi
      ? (multiAnswers[current.key] ?? []).length > 0
      : !!answers[current.key]
  }

  function select(val: string) {
    if (current.multi) {
      setMultiAnswers((prev) => {
        const cur = prev[current.key] ?? []
        const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val]
        return { ...prev, [current.key]: next }
      })
    } else {
      setAnswers((prev) => ({ ...prev, [current.key]: val }))
    }
  }

  async function next() {
    if (!hasSelection()) return
    if (!isLast) { setStep((s) => s + 1); return }
    setSaving(true)
    setError('')
    try {
      const profile: ProfileData = {
        target_band: answers['target_band'],
        main_task: answers['main_task'],
        main_problem: (multiAnswers['main_problem'] ?? []).join(','),
        template_style: answers['template_style'],
        allow_profile_update: answers['allow_profile_update'] === 'true',
      }
      await saveProfile(profile)
      onComplete()
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : c.saveError)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-0.5 bg-line">
        <div
          className="h-0.5 bg-brand transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {/* Step dots */}
          <div className="flex items-center gap-2 mb-10">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={[
                  'h-1 rounded-full flex-1 transition-all duration-300',
                  i < step ? 'bg-brand-muted' : i === step ? 'bg-brand' : 'bg-line',
                ].join(' ')}
              />
            ))}
          </div>

          {/* Card */}
          <div className="bg-surface rounded-panel shadow-panel border border-line px-10 py-12">
            <p className="text-[11px] font-semibold text-brand tracking-widest uppercase mb-5">
              {c.stepLabel(step + 1, STEPS.length)}
            </p>
            <h2 className="text-2xl font-bold text-ink mb-2 leading-snug">
              {current.question}
            </h2>
            {'hint' in current && current.hint && (
              <p className="text-sm text-ghost mb-8">{current.hint}</p>
            )}

            <div className="space-y-2.5 mt-8">
              {current.options.map((opt) => {
                const val = getOptionValue(opt)
                const label = getOptionLabel(opt)
                const sel = isSelected(val)
                return (
                  <button
                    key={val}
                    onClick={() => select(val)}
                    className={[
                      'w-full text-left px-5 py-3.5 rounded-card border-2 text-sm font-medium transition-all',
                      sel
                        ? 'border-brand bg-brand-light text-brand'
                        : 'border-line bg-canvas text-dim hover:border-line/80 hover:bg-muted',
                    ].join(' ')}
                  >
                    <span className={[
                      'inline-flex items-center justify-center w-4 h-4 mr-3 align-middle border-2 transition-all shrink-0',
                      current.multi
                        ? `rounded ${sel ? 'border-brand bg-brand' : 'border-line'}`
                        : `rounded-full ${sel ? 'border-brand bg-brand' : 'border-line'}`,
                    ].join(' ')}>
                      {sel && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          {current.multi
                            ? <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            : <circle cx="5" cy="5" r="2.5" fill="currentColor" />
                          }
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>

            {error && <p className="mt-5 text-sm text-danger">{error}</p>}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 px-1">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="text-sm text-ghost hover:text-dim transition-colors"
              >
                {c.prev}
              </button>
            ) : <div />}
            <button
              onClick={next}
              disabled={!hasSelection() || saving}
              className={[
                'px-7 py-3 text-sm font-semibold rounded-panel transition-all',
                'bg-brand text-white hover:bg-brand-hover',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'shadow-sm',
              ].join(' ')}
            >
              {saving ? c.saving : isLast ? `${c.finish} ✓` : `${c.next} →`}
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-ghost/60">{c.footer}</p>
        </div>
      </div>
    </div>
  )
}
