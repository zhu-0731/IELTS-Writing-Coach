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
    <div className="max-w-4xl mx-auto py-8 px-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
          <p className="text-sm text-dim mt-1">{c.subtitle}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/workspace')}>
          {c.startWriting} →
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Today's suggestion */}
        <Card className="md:col-span-2" padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="blue">{c.todaySuggestion}</Badge>
          </div>
          <h2 className="text-base font-semibold text-ink mb-1.5 leading-snug">
            {c.noSuggestionTitle}
          </h2>
          <p className="text-sm text-dim leading-relaxed">{c.noSuggestionDesc}</p>
          <button
            onClick={() => navigate('/workspace')}
            className="mt-4 text-sm text-brand hover:text-brand-hover font-medium transition-colors"
          >
            {c.goWrite}
          </button>
        </Card>

        {/* Profile summary */}
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-3">{c.profile.title}</h2>
          {profile ? (
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-ghost text-xs">{c.profile.targetBand}</span>
                <span className="font-semibold text-ink">{profile.target_band}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ghost text-xs">{c.profile.mainTask}</span>
                <Badge variant="blue">{taskLabel}</Badge>
              </div>
              {profile.main_problem && (
                <div className="pt-2.5 border-t border-line">
                  <span className="text-ghost text-xs">{c.profile.mainProblem}</span>
                  <p className="mt-1 text-xs text-dim leading-relaxed">{profile.main_problem}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ghost">{c.profile.loading}</p>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="mt-4 text-xs text-ghost hover:text-dim transition-colors"
          >
            {c.profile.edit}
          </button>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* New templates */}
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-1">{c.templates.title}</h2>
          <EmptyState
            icon="📋"
            message={c.templates.empty}
            action={{ label: c.templates.viewAll, onClick: () => navigate('/templates') }}
          />
        </Card>

        {/* Recent issues */}
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-ink mb-1">{c.issues.title}</h2>
          <EmptyState
            icon="📊"
            message={c.issues.empty}
            action={{ label: c.issues.viewAll, onClick: () => navigate('/history') }}
          />
        </Card>
      </div>
    </div>
  )
}
