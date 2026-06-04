import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getPracticeSession,
  completePracticeSession,
  generatePractice,
  deletePracticeSession,
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

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function acceptableAnswers(item: PracticeItem): string[] {
  const parsed = parseJson<string[]>(item.acceptable_answers_json || '[]', [])
  const answers = [item.answer, ...parsed].map((a) => a.trim()).filter(Boolean)
  return [...new Set(answers.map((a) => a.toLowerCase()))]
    .map((lower) => answers.find((a) => a.toLowerCase() === lower) ?? lower)
}

type ItemResult = 'pending' | 'correct' | 'replace' | 'wrong'

function evaluateAnswer(user: string, item: PracticeItem): ItemResult {
  if (item.weak_answer && checkAnswer(user, item.weak_answer)) return 'replace'
  return acceptableAnswers(item).some((answer) => checkAnswer(user, answer))
    ? 'correct'
    : 'wrong'
}

// ── Sentence display with inline blank ───────────────────────────────────────
function SentenceWithBlank({
  display,
  submitted,
  userAnswer,
  result,
}: {
  display: string
  submitted: boolean
  userAnswer: string
  result: ItemResult
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
            ? result === 'correct'
              ? 'bg-ok-light text-ok border border-ok/30'
              : result === 'replace'
                ? 'bg-warn-light text-warn border border-warn/30'
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

interface PracticeAttempt {
  item: PracticeItem
  userAnswer: string
  result?: ItemResult
}

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
            r === 'replace' ? 'w-2 h-2 bg-warn' :
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
  deleting,
  onDelete,
}: {
  score: number
  total: number
  wrongItems: PracticeAttempt[]
  essayId: string
  mode: string
  deleting: boolean
  onDelete: () => void
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
        {wrongItems.length > 0 && (
          <p className="text-xs text-ghost mt-2">{c.recordSaved}</p>
        )}
      </div>

      {/* Wrong items review */}
      {wrongItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-ghost uppercase tracking-wide">{c.reviewTitle}</h3>
          {wrongItems.map(({ item, userAnswer, result }, i) => (
            <div
              key={i}
              className={`rounded-card border p-4 space-y-2.5 ${
                result === 'replace'
                  ? 'border-warn/30 bg-warn-light/50'
                  : 'border-danger/30 bg-danger-light/50'
              }`}
            >
              {/* sentence */}
              <p className="text-xs text-dim leading-relaxed italic">
                {item.category === 'dictation' ? item.sentence_original : item.sentence_display}
              </p>
              {/* diff */}
              {item.weak_answer && checkAnswer(userAnswer, item.weak_answer) ? (
                <p className="text-xs text-dim">
                  {c.replaceHint(item.weak_answer, item.answer)}
                </p>
              ) : item.category === 'dictation' ? (
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
              {acceptableAnswers(item).length > 1 && (
                <p className="text-[11px] text-ghost">
                  {c.acceptableAnswers}：{acceptableAnswers(item).join(' / ')}
                </p>
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
          onClick={onDelete}
          disabled={deleting}
          className="px-5 py-2 text-sm text-danger hover:text-danger border border-danger/30 rounded-btn disabled:opacity-50 transition-colors"
        >
          {deleting ? c.deleting : c.delete}
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

function RecordScreen({
  session,
  deleting,
  onDelete,
  onRetryWrong,
}: {
  session: PracticeSession
  deleting: boolean
  onDelete: () => void
  onRetryWrong: (items: PracticeItem[]) => void
}) {
  const navigate = useNavigate()
  const pct = session.total > 0 ? Math.round((session.score / session.total) * 100) : 0
  const wrongItems = session.items.filter((item) => item.is_correct === 0)
  const hasItemRecord = session.items.some((item) => item.is_correct !== null)

  return (
    <div className="w-full max-w-[760px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-ghost hover:text-dim transition-colors text-lg leading-none"
          title={c.back}
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-ink">{c.recordTitle}</h1>
          <p className="text-xs text-ghost mt-0.5">{c.progress(session.total, session.total)}</p>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-ghost hover:text-danger disabled:opacity-50 transition-colors"
        >
          {deleting ? c.deleting : c.delete}
        </button>
      </div>

      <div className="bg-surface rounded-panel shadow-panel border border-line p-8 text-center">
        <div
          className={`text-5xl font-bold mb-2 ${
            pct >= 70 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-danger'
          }`}
        >
          {pct}%
        </div>
        <p className="text-base text-dim">{c.score(session.score, session.total)}</p>
        {!hasItemRecord && (
          <p className="text-xs text-ghost mt-2">{c.noAnswerRecord}</p>
        )}
      </div>

      {hasItemRecord && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold text-ghost uppercase tracking-wide">{c.reviewTitle}</h2>
            <button
              onClick={() => onRetryWrong(wrongItems)}
              disabled={wrongItems.length === 0}
              className="text-xs font-medium text-brand hover:text-brand-hover disabled:text-ghost disabled:cursor-not-allowed transition-colors"
            >
              {wrongItems.length > 0 ? c.retryWrong : c.noWrongItems}
            </button>
          </div>

          {session.items.map((item) => {
            const recordResult: ItemResult = item.is_correct === 1
              ? 'correct'
              : item.user_answer && evaluateAnswer(item.user_answer, item) === 'replace'
                ? 'replace'
                : 'wrong'
            const correct = recordResult === 'correct'
            const userAnswer = item.user_answer || ''
            return (
              <div
                key={item.item_id}
                className={`rounded-card border p-4 space-y-2.5 ${
                  correct
                    ? 'border-ok/20 bg-ok-light/40'
                    : recordResult === 'replace'
                      ? 'border-warn/30 bg-warn-light/50'
                      : 'border-danger/30 bg-danger-light/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CategoryBadge category={item.category} />
                  <span className={`text-xs font-semibold ${
                    correct ? 'text-ok' : recordResult === 'replace' ? 'text-warn' : 'text-danger'
                  }`}>
                    {correct ? c.correct : recordResult === 'replace' ? c.replaceNeeded : c.wrong}
                  </span>
                </div>
                <p className="text-xs text-dim leading-relaxed italic">
                  {item.category === 'dictation' ? item.sentence_original : item.sentence_display}
                </p>
                {recordResult === 'replace' ? (
                  <p className="text-xs text-dim">
                    {c.replaceHint(item.weak_answer, item.answer)}
                  </p>
                ) : item.category === 'dictation' && !correct ? (
                  <DictationDiff user={userAnswer} correct={item.answer} />
                ) : (
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span>
                      <span className="text-ghost">{c.yourAnswer}：</span>
                      <span className={correct ? 'text-ok font-mono' : 'text-danger line-through font-mono'}>
                        {userAnswer || '（空）'}
                      </span>
                    </span>
                    {!correct && (
                      <span>
                        <span className="text-ghost">{c.correctAnswer}：</span>
                        <span className="text-ok font-medium font-mono ml-1">{item.answer}</span>
                      </span>
                    )}
                  </div>
                )}
                {acceptableAnswers(item).length > 1 && (
                  <p className="text-[11px] text-ghost">
                    {c.acceptableAnswers}：{acceptableAnswers(item).join(' / ')}
                  </p>
                )}
                {item.explanation_zh && (
                  <p className="text-xs text-dim border-t border-line/70 pt-2 leading-relaxed">
                    {item.explanation_zh}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PracticePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isNew = sessionId === 'new'
  const genEssayId = searchParams.get('essay') ?? ''
  const genMode = searchParams.get('mode') ?? 'cloze'

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(isNew)
  const [genError, setGenError] = useState('')
  const [error, setError] = useState('')
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [currentResult, setCurrentResult] = useState<ItemResult>('pending')
  const [results, setResults] = useState<ItemResult[]>([])
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [wrongItems, setWrongItems] = useState<PracticeAttempt[]>([])
  const [showResults, setShowResults] = useState(false)
  const [retryItems, setRetryItems] = useState<PracticeItem[] | null>(null)

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Generate a fresh session (used when navigated to /practice/new?essay=...)
  const doGenerate = () => {
    if (!genEssayId) {
      setGenError(c.genError)
      setGenerating(false)
      return
    }
    setGenerating(true)
    setGenError('')
    generatePractice({ essay_id: genEssayId, mode: genMode })
      .then((res) => {
        // Replace the URL with the real session id; the effect below loads it.
        navigate(`/practice/${res.session_id}`, { replace: true })
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : ''
        // Surface the backend's Chinese message when present (422 ... detail)
        const detail = msg.replace(/^\d+\s*/, '').trim()
        setGenError(detail && detail.length < 80 ? detail : c.genError)
        setGenerating(false)
      })
  }

  useEffect(() => {
    if (isNew) {
      doGenerate()
      return
    }
    if (!sessionId) return
    getPracticeSession(sessionId)
      .then((data) => {
        setSession(data)
        setResults(data.items.map((item) => (
          item.is_correct === null ? 'pending' : item.is_correct ? 'correct' : 'wrong'
        )))
        setUserAnswers(data.items.map((item) => item.user_answer || ''))
        setLoading(false)
      })
      .catch(() => {
        setError(c.loadError)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const items = retryItems ?? session.items
    const item = items[currentIdx]
    const result = evaluateAnswer(inputValue, item)
    setCurrentResult(result)
    setSubmitted(true)

    const newResults = [...results]
    newResults[currentIdx] = result
    setResults(newResults)

    const newAnswers = [...userAnswers]
    newAnswers[currentIdx] = inputValue
    setUserAnswers(newAnswers)

    if (result !== 'correct') {
      setWrongItems((prev) => [...prev, { item, userAnswer: inputValue, result }])
    }
  }

  const handleNext = async () => {
    if (!session) return
    const items = retryItems ?? session.items
    const nextIdx = currentIdx + 1

    if (nextIdx >= items.length) {
      const finalScore = results.filter((r) => r === 'correct').length
      if (!retryItems) {
        const itemResults = session.items.map((item, idx) => ({
          item_id: item.item_id,
          user_answer: userAnswers[idx] ?? '',
          is_correct: results[idx] === 'correct',
        }))
        try {
          await completePracticeSession(session.session_id, finalScore, itemResults)
          setSession({
            ...session,
            status: 'completed',
            score: finalScore,
            items: session.items.map((item, idx) => ({
              ...item,
              user_answer: userAnswers[idx] ?? '',
              is_correct: results[idx] === 'correct' ? 1 : 0,
            })),
          })
        } catch {
          // non-fatal
        }
      }
      setShowResults(true)
    } else {
      setCurrentIdx(nextIdx)
    setInputValue('')
    setShowHint(false)
    setSubmitted(false)
    setCurrentResult('pending')
  }
  }

  const startWrongRetry = (items: PracticeItem[]) => {
    if (items.length === 0) return
    setRetryItems(items)
    setCurrentIdx(0)
    setInputValue('')
    setShowHint(false)
    setSubmitted(false)
    setCurrentResult('pending')
    setResults(new Array(items.length).fill('pending'))
    setUserAnswers(new Array(items.length).fill(''))
    setWrongItems([])
    setShowResults(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!submitted && inputValue.trim()) handleSubmit()
      else if (submitted) handleNext()
    }
  }

  const handleDelete = async () => {
    if (!session || deleting) return
    if (!window.confirm(c.deleteConfirm)) return
    setDeleting(true)
    try {
      await deletePracticeSession(session.session_id)
      navigate('/', { replace: true })
    } catch {
      window.alert(c.deleteError)
      setDeleting(false)
    }
  }

  // ── Generating a new session ─────────────────────────────────────────────
  if (isNew && generating) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-ink">{c.generating}</p>
        <p className="text-xs text-ghost">通常需要 10-20 秒</p>
      </div>
    )
  }

  if (isNew && genError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-danger max-w-sm leading-relaxed">{genError}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-ghost hover:text-dim border border-line rounded-btn transition-colors"
          >
            {c.back}
          </button>
          <button
            onClick={doGenerate}
            className="px-4 py-2 text-sm font-medium rounded-btn bg-brand text-white hover:bg-brand-hover transition-colors"
          >
            {c.retry}
          </button>
        </div>
      </div>
    )
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

  if (session.status === 'completed' && !retryItems && !showResults) {
    return (
      <RecordScreen
        session={session}
        deleting={deleting}
        onDelete={handleDelete}
        onRetryWrong={startWrongRetry}
      />
    )
  }

  const activeItems = retryItems ?? session.items

  // ── Results ────────────────────────────────────────────────────────────────
  if (showResults) {
    return (
      <ResultsScreen
        score={results.filter((r) => r === 'correct').length}
        total={activeItems.length}
        wrongItems={wrongItems}
        essayId={session.essay_id}
        mode={session.mode}
        deleting={deleting}
        onDelete={handleDelete}
      />
    )
  }

  // ── Practice ───────────────────────────────────────────────────────────────
  const item = activeItems[currentIdx]
  const progressPct = (currentIdx / activeItems.length) * 100

  const title = retryItems ? c.retryWrongTitle : isDictation ? c.dictationTitle : c.title

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
          <p className="text-xs text-ghost mt-0.5">{c.progress(currentIdx + 1, activeItems.length)}</p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto text-xs text-ghost hover:text-danger disabled:opacity-50 transition-colors"
        >
          {deleting ? c.deleting : c.delete}
        </button>
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
              result={currentResult}
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
                currentResult === 'correct'
                  ? 'bg-ok-light border border-ok/20'
                  : currentResult === 'replace'
                    ? 'bg-warn-light border border-warn/20'
                    : 'bg-danger-light border border-danger/20'
              }`}
            >
              <span className="text-xl shrink-0">
                {currentResult === 'correct' ? '✓' : currentResult === 'replace' ? '↔' : '✗'}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${
                  currentResult === 'correct'
                    ? 'text-ok'
                    : currentResult === 'replace'
                      ? 'text-warn'
                      : 'text-danger'
                }`}>
                  {currentResult === 'correct' ? c.correct : currentResult === 'replace' ? c.replaceNeeded : c.wrong}
                </p>
                {currentResult !== 'correct' && (
                  <div className="mt-1 space-y-1">
                    {currentResult === 'replace' ? (
                      <p className="text-xs text-dim">
                        {c.replaceHint(item.weak_answer, item.answer)}
                      </p>
                    ) : isDictation ? (
                      <DictationDiff user={inputValue} correct={item.answer} />
                    ) : (
                      <p className="text-xs text-dim">
                        {c.correctAnswer}：
                        <span className="font-mono font-medium text-ok ml-1">{item.answer}</span>
                      </p>
                    )}
                    {acceptableAnswers(item).length > 1 && (
                      <p className="text-[11px] text-ghost">
                        {c.acceptableAnswers}：{acceptableAnswers(item).join(' / ')}
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
              {currentIdx + 1 < activeItems.length ? c.next : c.viewResult}
            </button>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <ProgressDots results={results} current={currentIdx} />
    </div>
  )
}
