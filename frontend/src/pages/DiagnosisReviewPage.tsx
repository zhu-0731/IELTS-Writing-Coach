import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createResource,
  runDiagnosis,
  type DiagnosisFix,
  type DiagnosisResult,
} from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

type DiagnosisPayload = {
  essayId: string | null
  taskType: string
  questionType: string
  prompt: string
  promptImage?: string | null
  content: string
}

type FixCategory = 'all' | 'spelling' | 'grammar' | 'expression' | 'logic'

type TextSegment = {
  paragraphIndex: number
  sentenceIndex: number
  text: string
}

type ResourceDraft = {
  localId: string
  type: string
  name: string
  zhGoal: string
  pattern: string
  itemsText: string
  selected: boolean
  editing: boolean
  saving: boolean
  savedId?: string
}

const PAYLOAD_KEY = 'diagnosis_review_payload'

const CATEGORY_LABEL: Record<FixCategory, string> = {
  all: '全部',
  spelling: '拼写',
  grammar: '语法',
  expression: '表达',
  logic: '逻辑',
}

const CATEGORY_BADGE: Record<string, 'red' | 'yellow' | 'blue' | 'green' | 'neutral'> = {
  spelling: 'red',
  grammar: 'yellow',
  expression: 'blue',
  logic: 'green',
}

function getPayload(locationState: unknown): DiagnosisPayload | null {
  if (locationState && typeof locationState === 'object') {
    return locationState as DiagnosisPayload
  }
  try {
    const raw = sessionStorage.getItem(PAYLOAD_KEY)
    return raw ? (JSON.parse(raw) as DiagnosisPayload) : null
  } catch {
    return null
  }
}

function splitEssay(content: string): TextSegment[][] {
  return content
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph, paragraphIndex) => {
      const sentences = paragraph
        .replace(/\s+/g, ' ')
        .match(/[^.!?。！？]+[.!?。！？]?/g)
        ?.map((s) => s.trim())
        .filter(Boolean) ?? [paragraph]
      return sentences.map((text, sentenceIndex) => ({
        paragraphIndex,
        sentenceIndex,
        text,
      }))
    })
}

function inferCategory(fix: DiagnosisFix): Exclude<FixCategory, 'all'> {
  if (fix.category) return fix.category
  const text = `${fix.problem} ${fix.resource_type} ${fix.resource_name}`.toLowerCase()
  if (/拼写|spelling|typo|单词写错/.test(text)) return 'spelling'
  if (/语法|grammar|tense|时态|主谓|冠词|介词|句法/.test(text)) return 'grammar'
  if (/逻辑|logic|coherence|跳脱|支撑|展开|衔接|论证|例子/.test(text)) return 'logic'
  return 'expression'
}

function matchFixToSegment(fix: DiagnosisFix, segment: TextSegment): boolean {
  if (
    fix.paragraph_index === segment.paragraphIndex &&
    (fix.sentence_index === segment.sentenceIndex || fix.sentence_index === -1)
  ) {
    return true
  }
  const original = fix.original?.trim()
  return Boolean(original && (segment.text.includes(original) || original.includes(segment.text)))
}

function makeResourceDrafts(result: DiagnosisResult): ResourceDraft[] {
  const fromFixes = result.top_sentence_fixes
    .filter((fix) => (fix.resource_pattern || fix.suggestion || '').trim())
    .map((fix, index) => ({
      localId: `fix-${index}`,
      type: fix.resource_type || 'expression',
      name: fix.resource_name || '诊断推荐表达',
      zhGoal: fix.resource_goal || fix.problem || '',
      pattern: fix.resource_pattern || fix.suggestion || '',
      itemsText: (fix.resource_items || []).join('\n'),
      selected: false,
      editing: false,
      saving: false,
    }))

  const fromPhrases = (result.phrase_resources || [])
    .filter((item) => item.pattern?.trim())
    .map((item, index) => ({
      localId: `phrase-${index}`,
      type: item.type || 'collocation',
      name: item.name || '短语积累',
      zhGoal: item.goal || '',
      pattern: item.pattern,
      itemsText: '',
      selected: false,
      editing: false,
      saving: false,
    }))

  const seen = new Set<string>()
  return [...fromFixes, ...fromPhrases].filter((item) => {
    const key = item.pattern.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function DiagnosisReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const payload = useMemo(() => getPayload(location.state), [location.state])
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<FixCategory>('all')
  const [selectedFixIndex, setSelectedFixIndex] = useState(0)
  const [resources, setResources] = useState<ResourceDraft[]>([])

  useEffect(() => {
    if (!payload?.content?.trim()) return
    setLoading(true)
    setError('')
    runDiagnosis({
      essay_id: payload.essayId,
      task_type: payload.taskType,
      question_type: payload.questionType,
      prompt: payload.prompt,
      content: payload.content,
      image_base64: payload.promptImage || undefined,
    })
      .then((data) => {
        setResult(data)
        setResources(makeResourceDrafts(data))
      })
      .catch((err) => setError(err instanceof Error ? err.message : '诊断失败'))
      .finally(() => setLoading(false))
  }, [payload])

  const paragraphs = useMemo(() => splitEssay(payload?.content || ''), [payload?.content])
  const fixes = result?.top_sentence_fixes || []
  const visibleFixes = fixes
    .map((fix, index) => ({ fix, index, category: inferCategory(fix) }))
    .filter((item) => activeCategory === 'all' || item.category === activeCategory)
  const selectedFix = fixes[selectedFixIndex]

  const updateResource = (localId: string, patch: Partial<ResourceDraft>) => {
    setResources((prev) => prev.map((item) => (
      item.localId === localId ? { ...item, ...patch } : item
    )))
  }

  const saveResource = async (item: ResourceDraft) => {
    if (!item.pattern.trim() || !item.name.trim()) return
    updateResource(item.localId, { saving: true })
    try {
      const saved = await createResource({
        type: item.type,
        name: item.name,
        zh_goal: item.zhGoal,
        pattern: item.pattern,
        items: item.itemsText.split('\n').map((line) => line.trim()).filter(Boolean),
        task_type: payload?.taskType,
        source_essay_id: payload?.essayId,
      })
      updateResource(item.localId, {
        saving: false,
        editing: false,
        selected: true,
        savedId: saved.resource_id,
      })
    } catch {
      updateResource(item.localId, { saving: false })
    }
  }

  if (!payload) {
    return (
      <div className="max-w-[720px] mx-auto px-8 py-16">
        <h1 className="text-2xl font-semibold text-ink mb-3">没有可诊断的作文</h1>
        <p className="text-sm text-dim mb-6">请先回到写作工作台输入作文，再打开全文诊断。</p>
        <Button variant="primary" onClick={() => navigate('/workspace')}>返回写作工作台</Button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] bg-canvas px-5 py-4 flex flex-col gap-4 overflow-hidden">
      <div className="shrink-0 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/workspace')}>返回</Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink">作文批改诊断</h1>
          <p className="text-xs text-ghost truncate">
            {payload.taskType.toUpperCase()} · {payload.questionType || '通用'} · {payload.content.trim().split(/\s+/).length} 词
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {result?.estimated_band && <Badge variant="blue">预估 {result.estimated_band}</Badge>}
          {loading && <span className="text-xs text-ghost">正在诊断...</span>}
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-3 rounded-card bg-danger-light text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(280px,0.95fr)_minmax(360px,1.25fr)_minmax(300px,0.9fr)] gap-4 overflow-hidden">
        <section className="bg-surface border border-line rounded-card shadow-card flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="text-sm font-semibold text-ink">原文结构</h2>
            <p className="text-xs text-ghost mt-0.5">按段落和句子定位修改点</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {paragraphs.map((paragraph, pIndex) => (
              <div key={pIndex} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-muted text-ghost text-xs inline-flex items-center justify-center">
                    P{pIndex + 1}
                  </span>
                  <span className="text-[11px] text-ghost">逻辑块</span>
                </div>
                {paragraph.map((segment) => {
                  const active = selectedFix ? matchFixToSegment(selectedFix, segment) : false
                  return (
                    <button
                      key={`${segment.paragraphIndex}-${segment.sentenceIndex}`}
                      onClick={() => {
                        const index = fixes.findIndex((fix) => matchFixToSegment(fix, segment))
                        if (index >= 0) setSelectedFixIndex(index)
                      }}
                      className={[
                        'w-full text-left px-3 py-2.5 rounded-card border text-sm leading-6 transition-colors',
                        active
                          ? 'border-brand bg-brand-light text-ink'
                          : 'border-line bg-canvas/40 text-dim hover:border-brand/50 hover:bg-muted',
                      ].join(' ')}
                    >
                      <span className="block text-[10px] text-ghost mb-1">
                        S{segment.sentenceIndex + 1}
                      </span>
                      {segment.text}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface border border-line rounded-card shadow-card flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">逐句 / 逐段修改</h2>
                <p className="text-xs text-ghost mt-0.5">修改卡片会连接左侧对应原文</p>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {(Object.keys(CATEGORY_LABEL) as FixCategory[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={[
                      'px-2.5 py-1 text-xs rounded-btn transition-colors',
                      activeCategory === key
                        ? 'bg-brand text-white'
                        : 'bg-muted text-dim hover:bg-brand-light hover:text-brand',
                    ].join(' ')}
                  >
                    {CATEGORY_LABEL[key]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-ghost">正在生成逐句修改...</div>
            ) : visibleFixes.length === 0 ? (
              <div className="py-16 text-center text-sm text-ghost">当前分类没有修改点</div>
            ) : (
              visibleFixes.map(({ fix, index, category }) => (
                <button
                  key={index}
                  onClick={() => setSelectedFixIndex(index)}
                  className={[
                    'relative w-full text-left p-4 rounded-card border transition-colors',
                    selectedFixIndex === index
                      ? 'border-brand bg-brand-light'
                      : 'border-line bg-canvas/40 hover:border-brand/50',
                  ].join(' ')}
                >
                  <span className="absolute -left-3 top-6 text-brand font-semibold">-&gt;</span>
                  <div className="flex items-start gap-2 mb-3">
                    <Badge variant={CATEGORY_BADGE[category] || 'neutral'}>
                      {CATEGORY_LABEL[category]}
                    </Badge>
                    <Badge variant="neutral">{fix.scope || 'sentence'}</Badge>
                    <span className="ml-auto text-[11px] text-ghost">
                      P{(fix.paragraph_index ?? 0) + 1}
                      {fix.sentence_index === -1 ? '' : ` · S${(fix.sentence_index ?? 0) + 1}`}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] font-medium text-ghost mb-1">原文</p>
                      <p className="text-sm text-dim leading-6">{fix.original}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-ghost mb-1">修改后</p>
                      <p className="text-sm text-ink leading-6 font-medium">{fix.suggestion}</p>
                    </div>
                    <div className="pt-2 border-t border-line/70">
                      <p className="text-xs text-dim leading-5">{fix.problem}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="bg-surface border border-line rounded-card shadow-card flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="text-sm font-semibold text-ink">推荐积累</h2>
            <p className="text-xs text-ghost mt-0.5">系统推荐，保存前可选择和编辑</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-ghost">正在整理积累...</div>
            ) : resources.length === 0 ? (
              <div className="py-16 text-center text-sm text-ghost">暂无推荐积累</div>
            ) : (
              resources.map((item) => (
                <div key={item.localId} className="border border-line rounded-card bg-canvas/40 p-3">
                  <div className="flex items-start gap-2 mb-3">
                    <button
                      onClick={() => updateResource(item.localId, { selected: !item.selected })}
                      className={[
                        'w-5 h-5 rounded border text-xs shrink-0 mt-0.5',
                        item.selected || item.savedId
                          ? 'bg-ok border-ok text-white'
                          : 'border-line bg-surface text-transparent',
                      ].join(' ')}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      {item.editing ? (
                        <input
                          value={item.name}
                          onChange={(e) => updateResource(item.localId, { name: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-line bg-surface text-sm text-ink"
                        />
                      ) : (
                        <h3 className="text-sm font-semibold text-ink leading-snug">{item.name}</h3>
                      )}
                      <p className="text-[11px] text-ghost mt-1">{item.type}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {item.editing ? (
                      <>
                        <textarea
                          value={item.zhGoal}
                          onChange={(e) => updateResource(item.localId, { zhGoal: e.target.value })}
                          className="w-full min-h-[52px] px-2 py-1.5 rounded border border-line bg-surface text-xs text-dim"
                          placeholder="积累目标"
                        />
                        <textarea
                          value={item.pattern}
                          onChange={(e) => updateResource(item.localId, { pattern: e.target.value })}
                          className="w-full min-h-[70px] px-2 py-1.5 rounded border border-line bg-surface text-xs text-ink font-mono"
                          placeholder="表达 / 句型 / 搭配"
                        />
                        <textarea
                          value={item.itemsText}
                          onChange={(e) => updateResource(item.localId, { itemsText: e.target.value })}
                          className="w-full min-h-[58px] px-2 py-1.5 rounded border border-line bg-surface text-xs text-dim"
                          placeholder="例句，每行一个"
                        />
                      </>
                    ) : (
                      <>
                        {item.zhGoal && <p className="text-xs text-dim leading-5">{item.zhGoal}</p>}
                        <div className="px-2.5 py-2 rounded bg-muted font-mono text-xs text-ink leading-5 break-words">
                          {item.pattern}
                        </div>
                        {item.itemsText && (
                          <div className="text-[11px] text-dim leading-5 whitespace-pre-line">
                            {item.itemsText}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-line/60 flex items-center gap-2">
                    <button
                      onClick={() => updateResource(item.localId, { editing: !item.editing })}
                      className="text-xs text-dim hover:text-brand"
                    >
                      {item.editing ? '完成编辑' : '编辑'}
                    </button>
                    <button
                      onClick={() => saveResource(item)}
                      disabled={item.saving || Boolean(item.savedId)}
                      className="ml-auto text-xs font-medium text-brand hover:text-brand-hover disabled:text-ghost"
                    >
                      {item.savedId ? '已保存' : item.saving ? '保存中...' : '加入积累'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
