import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, type ProfileData } from '../api/client'
import { copy } from '../i18n'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

const c = copy.home

export default function HomePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {})
  }, [])

  const taskLabel = (() => {
    if (!profile) return null
    if (profile.main_task === 'task1') return c.profile.task1
    if (profile.main_task === 'task2') return c.profile.task2
    return c.profile.both
  })()

  return (
    <div className="w-full max-w-[1180px] mx-auto px-6 md:px-8 py-8">
      {/* Header */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start sm:items-end gap-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
          <p className="text-sm text-dim mt-1 max-w-xl">{c.subtitle}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/workspace')} className="shrink-0 justify-self-start sm:justify-self-end">
          {c.startWriting} →
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)] gap-5 mb-5 items-stretch">
        {/* Today's suggestion */}
        <Card className="min-h-[210px] flex flex-col justify-between" padding="lg">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="blue">{c.todaySuggestion}</Badge>
            </div>
            <h2 className="text-lg font-semibold text-ink mb-2 leading-snug max-w-2xl">
              {c.noSuggestionTitle}
            </h2>
            <p className="text-sm text-dim leading-relaxed max-w-2xl">{c.noSuggestionDesc}</p>
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
              {profile.main_problem && (
                <div className="pt-3 border-t border-line">
                  <span className="text-ghost text-xs">{c.profile.mainProblem}</span>
                  <p className="mt-1 text-xs text-dim leading-relaxed break-words">{profile.main_problem}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        {/* New templates */}
        <Card className="min-h-[220px] flex flex-col" padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-4">{c.templates.title}</h2>
          <EmptyState
            icon="📋"
            message={c.templates.empty}
            action={{ label: c.templates.viewAll, onClick: () => navigate('/templates') }}
            className="flex-1"
          />
        </Card>

        {/* Recent issues */}
        <Card className="min-h-[220px] flex flex-col" padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-4">{c.issues.title}</h2>
          <EmptyState
            icon="📊"
            message={c.issues.empty}
            action={{ label: c.issues.viewAll, onClick: () => navigate('/history') }}
            className="flex-1"
          />
        </Card>
      </div>
    </div>
  )
}
