import { useEffect, useState } from 'react'
import { listResources, deleteResource, type ResourceItem } from '../api/client'
import { copy } from '../i18n'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

const c = copy.templates

type TypeFilter = 'all' | 'pattern' | 'collocation' | 'expression' | 'logic_template' | 'error_correction'
type MasteryFilter = 'all' | 'unstable' | 'learning' | 'familiar' | 'mastered'

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: c.filterAll },
  { key: 'pattern', label: c.filterType.pattern },
  { key: 'collocation', label: c.filterType.collocation },
  { key: 'expression', label: c.filterType.expression },
  { key: 'logic_template', label: c.filterType.logic_template },
  { key: 'error_correction', label: c.filterType.error_correction },
]

const MASTERY_TABS: { key: MasteryFilter; label: string }[] = [
  { key: 'all', label: c.filterMastery.all },
  { key: 'unstable', label: c.filterMastery.unstable },
  { key: 'learning', label: c.filterMastery.learning },
  { key: 'familiar', label: c.filterMastery.familiar },
  { key: 'mastered', label: c.filterMastery.mastered },
]

const MASTERY_VARIANT: Record<string, 'red' | 'yellow' | 'blue' | 'green'> = {
  unstable: 'red',
  learning: 'yellow',
  familiar: 'blue',
  mastered: 'green',
}

const TYPE_VARIANT: Record<string, 'blue' | 'green' | 'yellow' | 'neutral'> = {
  pattern: 'blue',
  collocation: 'green',
  expression: 'yellow',
  logic_template: 'neutral',
  error_correction: 'neutral',
}

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function MasteryBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score < 0.3 ? 'bg-danger' : score < 0.6 ? 'bg-warn' : score < 0.85 ? 'bg-brand' : 'bg-ok'
  return (
    <div className="h-1 bg-muted rounded-full overflow-hidden w-24">
      <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ResourceCard({
  item,
  onDelete,
}: {
  item: ResourceItem
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const errors = parseJson<string[]>(item.common_errors_json, [])
  const logicChain = parseJson<string[]>(item.zh_logic_chain_json, [])
  const masteryLabel = c.mastery[item.mastery as keyof typeof c.mastery] ?? item.mastery
  const typeLabel = c.filterType[item.type as keyof typeof c.filterType] ?? item.type

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteResource(item.resource_id)
      onDelete(item.resource_id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-2.5">
      {/* Header row */}
      <div className="flex items-start gap-2 flex-wrap">
        <Badge variant={TYPE_VARIANT[item.type] ?? 'neutral'} className="text-[10px] shrink-0">
          {typeLabel}
        </Badge>
        <span className="flex-1 min-w-0 text-sm font-medium text-ink leading-snug">{item.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <MasteryBar score={item.mastery_score} />
          <Badge variant={MASTERY_VARIANT[item.mastery] ?? 'neutral'} className="text-[10px]">
            {masteryLabel}
          </Badge>
        </div>
      </div>

      {/* Goal */}
      {item.zh_goal && (
        <p className="text-xs text-dim leading-relaxed">{item.zh_goal}</p>
      )}

      {/* Pattern toggle */}
      {item.pattern && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-brand hover:text-brand-hover font-medium transition-colors"
          >
            {expanded ? c.card.hidePattern : c.card.showPattern}
          </button>
          {expanded && (
            <div className="mt-2 px-3 py-2 bg-muted rounded-md font-mono text-xs text-ink leading-relaxed break-all">
              {item.pattern}
            </div>
          )}
        </div>
      )}

      {/* Logic chain */}
      {expanded && logicChain.length > 0 && (
        <ol className="mt-1 space-y-1 pl-4 list-decimal">
          {logicChain.map((step, i) => (
            <li key={i} className="text-xs text-dim">{step}</li>
          ))}
        </ol>
      )}

      {/* Common errors */}
      {expanded && errors.length > 0 && (
        <div className="mt-1 px-3 py-2 bg-warn-light rounded-md">
          <p className="text-[10px] font-semibold text-warn mb-1">{c.card.errors}</p>
          <ul className="space-y-0.5">
            {errors.map((e, i) => (
              <li key={i} className="text-[11px] text-dim">• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1 border-t border-line/50">
        <span className="text-[10px] text-ghost">
          {item.source_essay_id ? c.card.fromDiag : c.card.seed}
        </span>
        <span className="text-[10px] text-ghost">{item.difficulty}分难度</span>
        <div className="ml-auto">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-dim">确认删除？</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] text-danger hover:text-danger/80 font-medium disabled:opacity-50"
              >
                {deleting ? '删除中…' : '确认'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-ghost hover:text-dim"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[10px] text-ghost hover:text-danger transition-colors"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function TemplatesPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all')
  const [items, setItems] = useState<ResourceItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    listResources({
      type: typeFilter === 'all' ? undefined : typeFilter,
      mastery: masteryFilter === 'all' ? undefined : masteryFilter,
    })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [typeFilter, masteryFilter])

  return (
    <div className="w-full max-w-[1100px] mx-auto px-6 md:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
          {!loading && !error && (
            <span className="text-sm text-ghost">{c.total(total)}</span>
          )}
        </div>
        <p className="text-sm text-dim mt-1">{c.subtitle}</p>
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={[
              'px-3 py-1.5 text-xs font-medium rounded-btn transition-colors',
              typeFilter === tab.key
                ? 'bg-brand text-white'
                : 'bg-muted text-dim hover:bg-brand-light hover:text-brand',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mastery chips */}
      <div className="flex items-center gap-1 flex-wrap mb-6">
        {MASTERY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMasteryFilter(tab.key)}
            className={[
              'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
              masteryFilter === tab.key
                ? 'border-brand bg-brand-light text-brand'
                : 'border-line bg-surface text-ghost hover:border-brand/50 hover:text-dim',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-ghost">正在加载…</div>
      ) : error ? (
        <div className="flex items-center justify-center py-24 text-sm text-danger">{c.loadError}</div>
      ) : items.length === 0 ? (
        <EmptyState icon="📚" message={c.empty} className="py-24" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <ResourceCard
              key={item.resource_id}
              item={item}
              onDelete={(id) => {
                setItems((prev) => prev.filter((r) => r.resource_id !== id))
                setTotal((n) => n - 1)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
