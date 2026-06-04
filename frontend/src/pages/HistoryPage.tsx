import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteEssay,
  getDiagnosis,
  getEssayContent,
  listDiagnosesForEssay,
  listEssays,
  type DiagnosisSummaryItem,
  type EssayListItem,
} from '../api/client'
import { copy } from '../i18n'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

const c = copy.history

interface ParsedProblem {
  category: string
  severity: string
}

function parseProblems(json: string | null): ParsedProblem[] {
  if (!json) return []
  try { return JSON.parse(json) as ParsedProblem[] } catch { return [] }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = formatDate(iso)
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildMarkdown(essay: EssayListItem, content: string): string {
  const taskLabel = essay.task_type === 'task1' ? c.task1 : c.task2
  const dateStr = formatDate(essay.updated_at)
  const problems = parseProblems(essay.main_problems_json)

  const lines: string[] = []
  lines.push(`# ${taskLabel} - ${dateStr}`)
  lines.push('')
  if (essay.question_type) lines.push(`**题型**: ${essay.question_type}`)
  if (essay.prompt) {
    lines.push('')
    lines.push('## 题目')
    lines.push('')
    lines.push(essay.prompt)
  }

  lines.push('')
  lines.push('## 作文')
  lines.push('')
  lines.push(content || '（内容为空）')
  lines.push('')
  lines.push(`> 字数：${essay.word_count} 词`)

  if (essay.estimated_band) {
    lines.push('')
    lines.push('## 诊断摘要')
    lines.push('')
    lines.push(`**预估分数**: ${essay.estimated_band}`)
    if (problems.length > 0) {
      lines.push('')
      lines.push('**主要失分点**:')
      problems.forEach((p) => {
        lines.push(`- ${p.category}: ${p.severity === 'high' ? '高优先级' : '中优先级'}`)
      })
    }
    if (essay.next_training_task) {
      lines.push('')
      lines.push(`**训练建议**: ${essay.next_training_task}`)
    }
  }

  lines.push('')
  lines.push('---')
  lines.push('*由 IELTS Writing Coach 导出*')
  return lines.join('\n')
}

function EssayCard({
  item,
  onDelete,
}: {
  item: EssayListItem
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [diagnoses, setDiagnoses] = useState<DiagnosisSummaryItem[] | null>(null)
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState('')
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false)
  const [openingDiagnosis, setOpeningDiagnosis] = useState(false)
  const problems = parseProblems(item.main_problems_json)
  const taskLabel = item.task_type === 'task1' ? c.task1 : c.task2

  const handleExport = async () => {
    setExporting(true)
    try {
      const essay = await getEssayContent(item.essay_id)
      const md = buildMarkdown(item, essay.content)
      const dateStr = formatDate(item.updated_at)
      triggerDownload(`ielts-${item.task_type}-${dateStr}.md`, md)
    } finally {
      setExporting(false)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const essay = await getEssayContent(item.essay_id)
      const taskType = item.task_type as 'task1' | 'task2'
      sessionStorage.setItem('workspace_active_task', taskType)
      sessionStorage.setItem(
        `workspace_draft_${taskType}`,
        JSON.stringify({
          questionType: item.question_type ?? '',
          prompt: item.prompt ?? '',
          content: essay.content,
          essayId: item.essay_id,
          elapsed: 0,
        }),
      )
      navigate('/workspace')
    } finally {
      setRestoring(false)
    }
  }

  const openDiagnosis = async (diagnosisId: string) => {
    setOpeningDiagnosis(true)
    try {
      const [essay, diagnosis] = await Promise.all([
        getEssayContent(item.essay_id),
        getDiagnosis(diagnosisId),
      ])
      const payload = {
        essayId: item.essay_id,
        taskType: item.task_type,
        questionType: item.question_type ?? '',
        prompt: item.prompt ?? '',
        content: essay.content,
        diagnosisResult: diagnosis,
      }
      sessionStorage.setItem('diagnosis_review_payload', JSON.stringify(payload))
      navigate('/diagnosis/review', { state: payload })
    } finally {
      setOpeningDiagnosis(false)
    }
  }

  const handleViewDiagnosis = async () => {
    if (diagnoses && diagnoses.length > 1) {
      await openDiagnosis(selectedDiagnosisId || diagnoses[0].diagnosis_id)
      return
    }

    setLoadingDiagnoses(true)
    try {
      const data = await listDiagnosesForEssay(item.essay_id)
      setDiagnoses(data.items)
      if (data.items.length === 1) {
        await openDiagnosis(data.items[0].diagnosis_id)
      } else if (data.items.length > 1) {
        setSelectedDiagnosisId(data.items[0].diagnosis_id)
      }
    } finally {
      setLoadingDiagnoses(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEssay(item.essay_id)
      onDelete(item.essay_id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-start gap-2 flex-wrap">
        <Badge variant="blue" className="text-[10px] shrink-0">{taskLabel}</Badge>
        {item.question_type && (
          <span className="text-[10px] text-ghost px-1.5 py-0.5 bg-muted rounded shrink-0">
            {item.question_type}
          </span>
        )}
        <span className="ml-auto text-[11px] text-ghost shrink-0">{formatDate(item.updated_at)}</span>
      </div>

      {item.prompt && (
        <p className="text-xs text-dim leading-relaxed line-clamp-2">{item.prompt}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-ghost">{c.words(item.word_count)}</span>
        {item.estimated_band ? (
          <Badge variant="green" className="text-[10px]">{c.band(item.estimated_band)}</Badge>
        ) : (
          <span className="text-[11px] text-ghost italic">{c.noDiag}</span>
        )}
        {problems.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {problems.map((p, i) => (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  p.severity === 'high'
                    ? 'bg-danger-light text-danger'
                    : 'bg-warn-light text-warn'
                }`}
              >
                {p.category}
              </span>
            ))}
          </div>
        )}
      </div>

      {item.estimated_band && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-brand hover:text-brand-hover font-medium transition-colors"
          >
            {expanded ? '收起' : `${c.diagSummary} ▾`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {item.next_training_task && (
                <div className="px-3 py-2 bg-brand-light rounded-md">
                  <p className="text-[10px] font-semibold text-brand mb-0.5">{c.nextTask}</p>
                  <p className="text-xs text-dim">{item.next_training_task}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {diagnoses && diagnoses.length > 1 && (
        <div className="flex items-center gap-2 rounded-card bg-muted px-2 py-2">
          <select
            value={selectedDiagnosisId}
            onChange={(e) => setSelectedDiagnosisId(e.target.value)}
            className="min-w-0 flex-1 bg-surface border border-line rounded px-2 py-1 text-xs text-dim"
          >
            {diagnoses.map((diag) => (
              <option key={diag.diagnosis_id} value={diag.diagnosis_id}>
                {formatDateTime(diag.created_at)} · {diag.estimated_band || 'N/A'}
              </option>
            ))}
          </select>
          <button
            onClick={() => openDiagnosis(selectedDiagnosisId)}
            disabled={openingDiagnosis || !selectedDiagnosisId}
            className="text-xs text-brand hover:text-brand-hover font-medium disabled:opacity-50"
          >
            查看
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-line/50 flex-wrap">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs text-ghost hover:text-dim font-medium transition-colors disabled:opacity-50"
        >
          {exporting ? '导出中...' : c.exportMd}
        </button>
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="text-xs text-brand hover:text-brand-hover font-medium transition-colors disabled:opacity-50"
        >
          {restoring ? '恢复中...' : c.restore}
        </button>
        {item.estimated_band && (
          <>
            <button
              onClick={handleViewDiagnosis}
              disabled={loadingDiagnoses || openingDiagnosis}
              className="text-xs text-brand hover:text-brand-hover font-medium transition-colors disabled:opacity-50"
            >
              {loadingDiagnoses || openingDiagnosis ? '加载中...' : '查看诊断'}
            </button>
            <button
              onClick={() => navigate(`/practice/new?essay=${item.essay_id}&mode=cloze`)}
              className="text-xs text-ok hover:text-ok/80 font-medium transition-colors"
            >
              {copy.practice.practiceBtn}
            </button>
          </>
        )}
        <div className="ml-auto">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-dim">确认删除？</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[11px] text-danger hover:text-danger/80 font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-ghost hover:text-dim transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[11px] text-ghost hover:text-danger transition-colors"
            >
              {c.delete}
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function HistoryPage() {
  const [items, setItems] = useState<EssayListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    listEssays({ limit: 50 })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((e) => e.essay_id !== id))
    setTotal((n) => n - 1)
  }

  return (
    <div className="w-full max-w-[900px] mx-auto px-6 md:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
          {!loading && !error && total > 0 && (
            <span className="text-sm text-ghost">{c.total(total)}</span>
          )}
        </div>
        <p className="text-sm text-dim mt-1">{c.subtitle}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-ghost">正在加载...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-24 text-sm text-danger">{c.loadError}</div>
      ) : items.length === 0 ? (
        <EmptyState icon="🗂️" message={c.empty} className="py-24" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <EssayCard key={item.essay_id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
