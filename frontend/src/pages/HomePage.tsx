import { useEffect, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deletePracticeSession,
  getHomeSummary,
  listPracticeSessions,
  type HomeSummary,
  type PracticeSessionSummary,
} from '../api/client'
import { copy } from '../i18n'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

const c = copy.home

const MASTERY_VARIANT: Record<string, 'neutral' | 'blue' | 'yellow' | 'green' | 'red'> = {
  unstable: 'red',
  learning: 'yellow',
  familiar: 'blue',
  mastered: 'green',
}

const cp = copy.practice

export default function HomePage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [sessions, setSessions] = useState<PracticeSessionSummary[]>([])
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

  useEffect(() => {
    getHomeSummary().then(setSummary).catch(() => {})
    listPracticeSessions(5).then(setSessions).catch(() => {})
  }, [])

  const profile = summary?.profile ?? null
  const diag = summary?.recent_diagnosis ?? null
  const resources = summary?.recent_resources ?? []
  const stats = summary?.problem_stats ?? []

  const taskLabel = (() => {
    if (!profile) return null
    if (profile.main_task === 'task1') return c.profile.task1
    if (profile.main_task === 'task2') return c.profile.task2
    return c.profile.both
  })()

  const handleDeleteSession = async (sessionId: string, e: MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(cp.deleteConfirm)) return
    setDeletingSessionId(sessionId)
    try {
      await deletePracticeSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
    } catch {
      window.alert(cp.deleteError)
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <div className="w-full max-w-[1180px] mx-auto px-6 md:px-8 py-8">
      {/* Header */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start sm:items-end gap-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
          <p className="text-sm text-dim mt-1 max-w-xl">{c.subtitle}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/workspace')}
          className="shrink-0 justify-self-start sm:justify-self-end"
        >
          {c.startWriting} →
        </Button>
      </div>

      {/* Row 1: Suggestion + Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)] gap-5 mb-5 items-stretch">

        {/* Today's suggestion */}
        <Card className="min-h-[210px] flex flex-col justify-between" padding="lg">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="blue">{c.todaySuggestion}</Badge>
              {diag && (
                <span className="text-xs text-ghost">
                  {c.suggestionBand(diag.estimated_band)}
                </span>
              )}
            </div>

            {diag ? (
              <>
                <p className="text-xs font-semibold text-ghost uppercase tracking-wide mb-1">
                  {c.suggestionNext}
                </p>
                <p className="text-sm text-ink leading-relaxed max-w-2xl">
                  {diag.next_training_task}
                </p>
                {diag.main_problems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {diag.main_problems.map((p, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-dim"
                      >
                        {p.category}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-ink mb-2 leading-snug max-w-2xl">
                  {c.noSuggestionTitle}
                </h2>
                <p className="text-sm text-dim leading-relaxed max-w-2xl">
                  {c.noSuggestionDesc}
                </p>
              </>
            )}
          </div>
          <button
            onClick={() => navigate('/workspace')}
            className="mt-6 self-start text-sm text-brand hover:text-brand-hover font-medium transition-colors"
          >
            {c.goWrite}
          </button>
        </Card>

        {/* Profile summary */}
        <Card className="min-h-[210px] flex flex-col" padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-4">{c.profile.title}</h2>
          {profile ? (
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between items-center gap-3">
                <span className="text-ghost text-xs">{c.profile.targetBand}</span>
                <span className="font-semibold text-ink">{profile.target_band}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-ghost text-xs">{c.profile.mainTask}</span>
                <Badge variant="blue">{taskLabel}</Badge>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-ghost text-xs">{c.profile.apiStatus}</span>
                <span
                  className={`text-xs font-medium cursor-pointer ${summary?.api_configured ? 'text-ok' : 'text-danger hover:underline'}`}
                  onClick={summary?.api_configured ? undefined : () => navigate('/settings')}
                >
                  {summary?.api_configured ? c.profile.apiOk : c.profile.apiMissing}
                </span>
              </div>
              {(summary?.essay_count ?? 0) > 0 && (
                <div className="flex justify-between items-center gap-3 pt-2 border-t border-line">
                  <span className="text-ghost text-xs">{c.profile.essayCount(summary?.essay_count ?? 0)}</span>
                  <span className="text-ghost text-xs">{c.profile.diagCount(summary?.diagnosis_count ?? 0)}</span>
                </div>
              )}
              {profile.main_problem && (
                <div className="pt-2 border-t border-line">
                  <span className="text-ghost text-xs">{c.profile.mainProblem}</span>
                  <p className="mt-1 text-xs text-dim leading-relaxed break-words">
                    {profile.main_problem}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ghost flex-1">{c.profile.loading}</p>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="mt-4 self-start text-xs text-ghost hover:text-dim transition-colors"
          >
            {c.profile.edit}
          </button>
        </Card>
      </div>

      {/* Row 2: Resources + Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">

        {/* New language resources */}
        <Card className="min-h-[220px] flex flex-col" padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-4">{c.templates.title}</h2>
          {resources.length > 0 ? (
            <>
              <ul className="space-y-2.5 flex-1">
                {resources.map((r) => (
                  <li key={r.resource_id} className="flex items-start gap-2.5">
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-dim mt-0.5">
                      {c.templates.typeLabel[r.type as keyof typeof c.templates.typeLabel] ?? r.type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{r.name}</p>
                      <p className="text-[11px] text-ghost truncate">{r.zh_goal}</p>
                    </div>
                    <Badge
                      variant={MASTERY_VARIANT[r.mastery] ?? 'neutral'}
                      className="shrink-0 text-[10px]"
                    >
                      {c.templates.masteryLabel[r.mastery as keyof typeof c.templates.masteryLabel] ?? r.mastery}
                    </Badge>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/templates')}
                className="mt-4 self-start text-xs text-brand hover:text-brand-hover font-medium transition-colors"
              >
                {c.templates.viewAll}
              </button>
            </>
          ) : (
            <EmptyState
              icon="📋"
              message={c.templates.empty}
              action={{ label: c.templates.viewAll, onClick: () => navigate('/templates') }}
              className="flex-1"
            />
          )}
        </Card>

        {/* High-frequency issues */}
        <Card className="min-h-[220px] flex flex-col" padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-4">{c.issues.title}</h2>
          {stats.length > 0 ? (
            <>
              <ul className="space-y-3 flex-1">
                {stats.map((s, i) => (
                  <li key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink">{s.category}</span>
                      <span className="text-[11px] text-ghost shrink-0">
                        {c.issues.timesLabel(s.count)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-1.5 bg-brand rounded-full"
                        style={{ width: `${Math.min(100, (s.count / (stats[0]?.count ?? 1)) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/history')}
                className="mt-4 self-start text-xs text-brand hover:text-brand-hover font-medium transition-colors"
              >
                {c.issues.viewAll}
              </button>
            </>
          ) : (
            <EmptyState
              icon="📊"
              message={c.issues.empty}
              action={{ label: c.issues.viewAll, onClick: () => navigate('/history') }}
              className="flex-1"
            />
          )}
        </Card>
      </div>

      {/* Row 3: Recent practice sessions */}
      {sessions.length > 0 && (
        <div className="mt-5">
          <Card padding="lg">
            <h2 className="text-sm font-semibold text-ink mb-4">{cp.recentTitle}</h2>
            <div className="space-y-2.5">
              {sessions.map((s) => {
                const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : null
                const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2'
                const promptExcerpt = s.prompt ? s.prompt.slice(0, 60) + (s.prompt.length > 60 ? '…' : '') : '（无题目）'
                const modeLabel = cp.modeLabel[s.mode as keyof typeof cp.modeLabel] ?? s.mode
                return (
                  <div
                    key={s.session_id}
                    className="flex items-center gap-3 p-3 rounded-card bg-muted hover:bg-line/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/practice/${s.session_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-[10px] text-ghost bg-surface px-1.5 py-0.5 rounded font-medium">{taskLabel}</span>
                        <span className="text-[10px] text-ghost">{modeLabel}</span>
                        <span className={`text-[10px] font-medium ${s.status === 'completed' ? 'text-ok' : 'text-warn'}`}>
                          {s.status === 'completed' ? cp.completed : cp.inProgress}
                        </span>
                      </div>
                      <p className="text-xs text-dim truncate">{promptExcerpt}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.session_id, e)}
                      disabled={deletingSessionId === s.session_id}
                      className="shrink-0 text-[11px] text-ghost hover:text-danger disabled:opacity-50 transition-colors"
                    >
                      {deletingSessionId === s.session_id ? cp.deleting : cp.delete}
                    </button>
                    {s.status === 'completed' && pct !== null ? (
                      <div className="shrink-0 text-right">
                        <span className={`text-sm font-bold tabular-nums ${pct >= 70 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-danger'}`}>
                          {pct}%
                        </span>
                        <p className="text-[10px] text-ghost">{s.score}/{s.total}</p>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs text-brand font-medium">{cp.continueBtn} →</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
