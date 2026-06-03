import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getPracticeSession,
  completePracticeSession,
  generatePractice,
  type PracticeItem,
  type PracticeSession,
} from '../api/client'
import { copy } from '../i18n'

const c = copy.practice

// ── Answer checking (mirrors backend logic) ───────────────────────────────────
function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[^\w\s'-]/g, '').trim()
}

function levenshtein(a: string, b: string): number {
  if (a.length < b.length) [a, b] = [b, a]
  if (!b.length) return a.length
  let row = [...Array(b.length + 1).keys()]
  for (const ac of a) {
    const nr = [row[0] + 1]
    for (let j = 0; j < b.length; j++)
      nr.push(Math.min(nr[j] + 1, row[j + 1] + 1, row[j] + (ac !== b[j] ? 1 : 0)))
    row = nr
  }
  return row[row.length - 1]
}

function checkAnswer(user: string, correct: string): boolean {
  const u = normalize(user)
  const c = normalize(correct)
  if (u === c) return true
  if (!c.includes(' ') && !u.includes(' ') && c.length > 3) return levenshtein(u, c) <= 1
  return false
}

// ── Sentence display with inline blank ───────────────────────────────────────
function SentenceWithBlank({
  display,
  submitted,
  userAnswer,
  correct,
}: {
  display: string
  submitted: boolean
  userAnswer: string
  correct: boolean
}) {
  const parts = display.split('___')
  if (parts.length < 2) return <span className="text-sm text-ink leading-relaxed">{display}</span>

  return (
    <span className="text-sm text-ink leading-relaxed">
      {parts[0]}
      <span
        className={[
          'inline-block min-w-[72px] px-2 py-0.5 mx-0.5 rounded text-center font-mono text-sm',
          submitted
            ? correct
              ? 'bg-ok-light text-ok border border-ok/30'
              : 'bg-danger-light text-danger border border-danger/30'
            : 'border-b-2 border-brand',
        ].join(' ')}
      >
        {submitted ? (userAnswer || '？') : '      '}
      </span>
      {parts[1]}
    </span>
  )
}

// ── Dictation diff display ────────────────────────────────────────────────────
function DictationDiff({ user, correct }: { user: string; correct: string }) {
  const uWords = user.trim().split(/\s+/)
  const cWords = correct.trim().split(/\s+/)
  const maxLen = Math.max(uWords.length, cWords.length)

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-ghost font-semibold uppercase tracking-wide">逐词对比</p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: maxLen }).map((_, i) => {
          const u = uWords[i] ?? ''
          const cv = cWords[i] ?? ''
          const ok = normalize(u) === normalize(cv)
          return (
            <span
              key={i}
              className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                ok ? 'bg-ok-light text-ok' : u ? 'bg-danger-light text-danger' : 'bg-warn-light text-warn'
              }`}
              title={ok ? '' : `应为: ${cv}`}
            >
              {u || `[${cv}]`}
            </span>
          )
        })}
      </div>
      <p className="text-[11px] text-ghost leading-relaxed">
        正确：<span className="text-ok font-mono">{correct}</span>
      </p>
    </div>
  )
}

// ── Category badge ────────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const color =
    category === 'grammar'    ? 'bg-brand-muted text-brand' :
    category === 'vocabulary' ? 'bg-warn-light text-warn'   :
                                'bg-ok-light text-ok'
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${color}`}>
      {c.category[category as keyof typeof c.category] ?? category}
    </span>
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────
type ItemResult = 'pending' | 'correct' | 'wrong'

function ProgressDots({
  results,
  current,
}: {
  results: ItemResult[]
  current: number
}) {
  return (
    <div className="flex justify-center gap-1.5 mt-6 flex-wrap">
      {results.map((r, i) => (
        <div
          key={i}
          className={[
            'rounded-full transition-all',
            i === current ? 'w-4 h-2 bg-brand' :
            r === 'correct' ? 'w-2 h-2 bg-ok' :
            r === 'wrong'   ? 'w-2 h-2 bg-danger' :
                              'w-2 h-2 bg-muted',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

// ── Results screen ────────────────────────────────────────────────────────────
function ResultsScreen({
  score,
  total,
  wrongItems,
  essayId,
  mode,
  onRetry,
}: {
  score: number
  total: number
  wrongItems: { item: PracticeItem; userAnswer: string }[]
  essayId: string
  mode: string
  onRetry: () => void
}) {
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)
  const pct = total > 0 ? Math.round((score / total) * 100) : 0

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await generatePractice({ essay_id: essayId, mode })
      navigate(`/practice/${res.session_id}`, { replace: true })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="w-full max-w-[680px] mx-auto px-6 py-8 space-y-8">
      {/* Score card */}
      <div className="text-center bg-surface rounded-panel shadow-panel border border-line p-8">
        <div
          className={`text-6xl font-bold mb-2 ${
            pct >= 70 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-danger'
          }`}
        >
          {pct}%
        </div>
        <p className="text-base text-dim">{c.score(score, total)}</p>
        <p className={`text-sm font-medium mt-2 ${pct >= 70 ? 'text-ok' : 'text-warn'}`}>
          {pct >= 70 ? c.pctGood : c.pctBad}
        </p>
      </div>

      {/* Wrong items review */}
      {wrongItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-ghost uppercase tracking-wide">{c.reviewTitle}</h3>
          {wrongItems.map(({ item, userAnswer }, i) => (
            <div key={i} className="rounded-card border border-danger/30 bg-danger-light/50 p-4 space-y-2.5">
              {/* sentence */}
              <p className="text-xs text-dim leading-relaxed italic">
                {item.category === 'dictation' ? item.sentence_original : item.sentence_display}
              </p>
              {/* diff */}
              {item.category === 'dictation' ? (
                <DictationDiff user={userAnswer} correct={item.answer} />
              ) : (
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>
                    <span className="text-ghost">{c.yourAnswer}：</span>
                    <span className="text-danger line-through font-mono">{userAnswer || '（空）'}</span>
                  </span>
                  <span>
                    <span className="text-ghost">{c.correctAnswer}：</span>
                    <span className="text-ok font-medium font-mono">{item.answer}</span>
                  </span>
                </div>
              )}
              {item.explanation_zh && (
                <p className="text-xs text-dim border-t border-danger/20 pt-2 leading-relaxed">
                  {item.explanation_zh}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2 text-sm text-ghost hover:text-dim border border-line rounded-btn transition-colors"
        >
          {c.back}
        </button>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-5 py-2 text-sm font-medium rounded-btn bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {retrying ? c.generating : c.retry}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PracticePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<PracticeSession | null>(null)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [currentCorrect, setCurrentCorrect] = useState(false)
  const [results, setResults] = useState<ItemResult[]>([])
  const [wrongItems, setWrongItems] = useState<{ item: PracticeItem; userAnswer: string }[]>([])
  const [showResults, setShowResults] = useState(false)

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!sessionId) return
    getPracticeSession(sessionId)
      .then((data) => {
        setSession(data)
        setResults(new Array(data.items.length).fill('pending'))
        setLoading(false)
      })
      .catch(() => {
        setError(c.loadError)
        setLoading(false)
      })
  }, [sessionId])

  // Focus input when item changes
  useEffect(() => {
    if (!loading && !showResults && !submitted) {
      inputRef.current?.focus()
    }
  }, [currentIdx, loading, showResults, submitted])

  const isDictation = session?.mode === 'dictation'

  const handleSubmit = () => {
    if (!session) return
    const item = session.items[currentIdx]
    const correct = checkAnswer(inputValue, item.answer)
    setCurrentCorrect(correct)
    setSubmitted(true)

    const newResults = [...results]
    newResults[currentIdx] = correct ? 'correct' : 'wrong'
    setResults(newResults)

    if (!correct) {
      setWrongItems((prev) => [...prev, { item, userAnswer: inputValue }])
    }
  }

  const handleNext = async () => {
    if (!session) return
    const nextIdx = currentIdx + 1

    if (nextIdx >= session.items.length) {
      const finalScore = results.filter((r) => r === 'correct').length
      try {
        await completePracticeSession(session.session_id, finalScore)
      } catch {
        // non-fatal
      }
      setShowResults(true)
    } else {
      setCurrentIdx(nextIdx)
      setInputValue('')
      setShowHint(false)
      setSubmitted(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!submitted && inputValue.trim()) handleSubmit()
      else if (submitted) handleNext()
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-danger">{error || c.loadError}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-brand hover:underline">{c.back}</button>
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (showResults) {
    return (
      <ResultsScreen
        score={results.filter((r) => r === 'correct').length}
        total={session.total}
        wrongItems={wrongItems}
        essayId={session.essay_id}
        mode={session.mode}
        onRetry={() => {}}
      />
    )
  }

  // ── Practice ───────────────────────────────────────────────────────────────
  const item = session.items[currentIdx]
  const progressPct = (currentIdx / session.total) * 100

  const title = isDictation ? c.dictationTitle : c.title

  return (
    <div className="w-full max-w-[680px] mx-auto px-6 py-8">
      {/* Page title */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-ghost hover:text-dim transition-colors text-lg leading-none"
          title={c.back}
        >
          ←
        </button>
        <div>
          <h1 className="text-base font-semibold text-ink">{title}</h1>
          <p className="text-xs text-ghost mt-0.5">{c.progress(currentIdx + 1, session.total)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-1.5 bg-brand rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-[11px] text-ghost tabular-nums shrink-0">
          {results.filter((r) => r === 'correct').length} ✓
        </span>
      </div>

      {/* Card */}
      <div className="bg-surface rounded-panel shadow-panel border border-line p-6 md:p-8 space-y-5">

        {/* Category + mode label */}
        <div className="flex items-center gap-2">
          <CategoryBadge category={item.category} />
        </div>

        {/* Sentence display */}
        <div className="bg-muted rounded-card px-4 py-3.5 leading-loose">
          {isDictation ? (
            <div>
              <p className="text-[10px] text-ghost font-semibold uppercase tracking-wide mb-1.5">中文提示</p>
              <p className="text-sm text-ink font-medium">{item.hint_zh}</p>
            </div>
          ) : (
            <SentenceWithBlank
              display={item.sentence_display}
              submitted={submitted}
              userAnswer={inputValue}
              correct={currentCorrect}
            />
          )}
        </div>

        {/* Input area */}
        {!submitted ? (
          <div className="space-y-3">
            {isDictation ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={c.dictationPlaceholder}
                rows={3}
                className="w-full px-4 py-3 bg-muted rounded-card text-sm text-ink placeholder-ghost border border-line focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none leading-relaxed"
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={c.inputPlaceholder}
                className="w-full px-4 py-3 bg-muted rounded-card text-sm text-ink placeholder-ghost border border-line focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
              />
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowHint((v) => !v)}
                className="text-xs text-ghost hover:text-dim transition-colors"
              >
                {showHint ? c.hideHint : c.hint}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim()}
                className="px-5 py-2 text-sm font-medium rounded-btn bg-brand text-white hover:bg-brand-hover disabled:opacity-40 transition-colors"
              >
                {c.submit}
              </button>
            </div>

            {showHint && !isDictation && (
              <div className="bg-brand-light border border-brand-muted rounded-card px-3 py-2">
                <p className="text-xs text-brand font-medium">{item.hint_zh}</p>
              </div>
            )}
          </div>
        ) : (
          /* Result feedback */
          <div className="space-y-4">
            {/* Correct/Wrong banner */}
            <div
              className={`flex items-start gap-3 p-4 rounded-card ${
                currentCorrect ? 'bg-ok-light border border-ok/20' : 'bg-danger-light border border-danger/20'
              }`}
            >
              <span className="text-xl shrink-0">{currentCorrect ? '✓' : '✗'}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${currentCorrect ? 'text-ok' : 'text-danger'}`}>
                  {currentCorrect ? c.correct : c.wrong}
                </p>
                {!currentCorrect && (
                  <div className="mt-1 space-y-1">
                    {isDictation ? (
                      <DictationDiff user={inputValue} correct={item.answer} />
                    ) : (
                      <p className="text-xs text-dim">
                        {c.correctAnswer}：
                        <span className="font-mono font-medium text-ok ml-1">{item.answer}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Explanation */}
            {item.explanation_zh && (
              <div className="bg-muted rounded-card px-3 py-2.5">
                <p className="text-[10px] text-ghost font-semibold uppercase tracking-wide mb-1">{c.explanation}</p>
                <p className="text-xs text-dim leading-relaxed">{item.explanation_zh}</p>
              </div>
            )}

            {/* Next button */}
            <button
              onClick={handleNext}
              className="w-full py-2.5 text-sm font-medium rounded-btn bg-brand text-white hover:bg-brand-hover transition-colors"
            >
              {currentIdx + 1 < session.total ? c.next : c.viewResult}
            </button>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <ProgressDots results={results} current={currentIdx} />
    </div>
  )
}
