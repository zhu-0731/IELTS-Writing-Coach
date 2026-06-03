import { useState, useEffect, useRef, useCallback } from 'react'
import { createEssay, updateEssay } from '../api/client'
import { copy } from '../i18n'
import PromptPanel from '../components/workspace/PromptPanel'
import AISidebar from '../components/workspace/AISidebar'
import DiagnosisModal from '../components/workspace/DiagnosisModal'
import Button from '../components/ui/Button'

type TaskType = 'task1' | 'task2'
type SidebarTab = 'hint' | 'idea' | 'expression'

const c = copy.workspace

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const MIN_LEFT = 260
const MAX_LEFT = 380
const MIN_RIGHT = 300
const MAX_RIGHT = 440
const SIDEBAR_COLLAPSED_W = 56

// Read a key from the persisted workspace draft in sessionStorage.
function draft<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem('workspace_draft')
    if (!raw) return undefined
    return (JSON.parse(raw) as Record<string, unknown>)[key] as T | undefined
  } catch { return undefined }
}

export default function WorkspacePage() {
  // Lazy initialisers read from sessionStorage so state is correct on the
  // very first render — no double-render / race condition from a restoration effect.
  const [taskType, setTaskType] = useState<TaskType>(() => draft('taskType') ?? 'task2')
  const [questionType, setQuestionType] = useState<string>(() => draft('questionType') ?? '')
  const [prompt, setPrompt] = useState<string>(() => draft('prompt') ?? '')
  const [content, setContent] = useState<string>(() => draft('content') ?? '')
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => draft('sidebarCollapsed') ?? false)
  const [activeTab, setActiveTab] = useState<SidebarTab>(() => draft('activeTab') ?? 'hint')
  const [showDiagModal, setShowDiagModal] = useState(false)

  const [leftWidth, setLeftWidth] = useState<number>(() => draft('leftWidth') ?? 320)
  const [rightWidth, setRightWidth] = useState<number>(() => draft('rightWidth') ?? 340)
  const [isResizing, setIsResizing] = useState(false)

  const [promptImage, setPromptImage] = useState<string | null>(null)
  const [essayId, setEssayId] = useState<string | null>(() => draft('essayId') ?? null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [elapsed, setElapsed] = useState<number>(() => draft('elapsed') ?? 0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const leftDrag = useRef({ active: false, startX: 0, startW: 0 })
  const rightDrag = useRef({ active: false, startX: 0, startW: 0 })

  // Persist workspace state to sessionStorage on every relevant change
  useEffect(() => {
    try {
      sessionStorage.setItem('workspace_draft', JSON.stringify({
        taskType, questionType, prompt, content, essayId,
        elapsed, sidebarCollapsed, activeTab, leftWidth, rightWidth,
      }))
    } catch { /* quota exceeded — silently skip */ }
  }, [taskType, questionType, prompt, content, essayId, elapsed, sidebarCollapsed, activeTab, leftWidth, rightWidth])

  const wordCount = countWords(content)
  const targetWords = taskType === 'task1' ? 150 : 250
  const maxWords = taskType === 'task1' ? 200 : 300
  const wordProgress = Math.min(100, (wordCount / maxWords) * 100)

  // Global drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (leftDrag.current.active) {
        const d = e.clientX - leftDrag.current.startX
        setLeftWidth(Math.max(MIN_LEFT, Math.min(MAX_LEFT, leftDrag.current.startW + d)))
      }
      if (rightDrag.current.active) {
        const d = rightDrag.current.startX - e.clientX
        setRightWidth(Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, rightDrag.current.startW + d)))
      }
    }
    const onUp = () => {
      if (leftDrag.current.active || rightDrag.current.active) {
        leftDrag.current.active = false
        rightDrag.current.active = false
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        setIsResizing(false)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startLeftDrag = (e: React.MouseEvent) => {
    leftDrag.current = { active: true, startX: e.clientX, startW: leftWidth }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    setIsResizing(true)
    e.preventDefault()
  }

  const startRightDrag = (e: React.MouseEvent) => {
    rightDrag.current = { active: true, startX: e.clientX, startW: rightWidth }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    setIsResizing(true)
    e.preventDefault()
  }

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  const handleContentChange = (val: string) => {
    setContent(val)
    if (!timerRunning && val.length > 0) setTimerRunning(true)
  }

  const resetTimer = () => {
    setElapsed(0)
    setTimerRunning(false)
  }

  // Auto-save
  const doSave = useCallback(async () => {
    if (!content && !prompt) return
    setSaveStatus('saving')
    try {
      const wc = countWords(content)
      if (!essayId) {
        const essay = await createEssay({
          task_type: taskType,
          question_type: questionType || undefined,
          prompt,
          content,
          word_count: wc,
        })
        setEssayId(essay.essay_id)
      } else {
        await updateEssay(essayId, {
          question_type: questionType || undefined,
          prompt,
          content,
          word_count: wc,
        })
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }, [content, prompt, essayId, taskType, questionType])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (content || prompt) {
      saveTimerRef.current = setTimeout(doSave, 1500)
    }
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [content, prompt, doSave])

  const switchTask = (t: TaskType) => {
    try {
      sessionStorage.removeItem('workspace_draft')
      sessionStorage.removeItem('workspace_idea')
      sessionStorage.removeItem('workspace_expression')
    } catch { /* ignore */ }
    setTaskType(t)
    setQuestionType('')
    setPrompt('')
    setContent('')
    setPromptImage(null)
    setEssayId(null)
    setElapsed(0)
    setTimerRunning(false)
    setSaveStatus('idle')
  }

  const openTab = (tab: SidebarTab) => {
    setActiveTab(tab)
    setSidebarCollapsed(false)
  }

  const handleInsertText = useCallback((text: string) => {
    const ta = editorRef.current
    if (!ta) {
      const updated = content + (content ? '\n' : '') + text
      handleContentChange(updated)
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const updated = content.slice(0, start) + text + content.slice(end)
    handleContentChange(updated)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length
      ta.focus()
    })
  }, [content])

  const saveLabel = (() => {
    if (saveStatus === 'saving') return c.saveStatus.saving
    if (saveStatus === 'saved')  return c.saveStatus.saved
    if (saveStatus === 'error')  return c.saveStatus.error
    return essayId ? c.saveStatus.idleSaved : c.saveStatus.idle
  })()

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-canvas px-7 py-5 gap-4 overflow-hidden">
      {/* ── Status bar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(180px,1fr)_auto_minmax(220px,1fr)] items-center gap-4 px-4 py-3 bg-surface border border-line rounded-card shadow-card shrink-0">
        <div className="min-w-0">
          <span className={`block truncate text-xs ${saveStatus === 'error' ? 'text-danger' : 'text-ghost'}`}>
            {saveLabel}
          </span>
        </div>

        <div className="flex items-center justify-center gap-5">
          <span className="text-sm tabular-nums whitespace-nowrap">
            <span className={wordCount >= targetWords ? 'text-ok font-semibold' : 'text-dim'}>
              {wordCount}
            </span>
            <span className="text-ghost text-xs ml-1">/ {targetWords}+ 词</span>
          </span>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              onClick={() => setTimerRunning((r) => !r)}
              title={timerRunning ? c.timer.pause : c.timer.resume}
              className="font-mono text-sm text-dim hover:text-ink transition-colors select-none tabular-nums"
            >
              {timerRunning ? '⏸' : '▶'} {formatTime(elapsed)}
            </button>
            <button
              onClick={resetTimer}
              title={c.timer.reset}
              className="text-ghost hover:text-dim transition-colors select-none text-base leading-none"
            >
              ↺
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={doSave} disabled={saveStatus === 'saving'}>
            {c.saveDraft}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowDiagModal(true)}
            disabled={wordCount < 10}
          >
            {c.diagnose}
          </Button>
        </div>
      </div>

      {/* ── Three-column body ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-3 min-h-0">

        {/* Left panel */}
        <div
          className="shrink-0 bg-surface border border-line rounded-card shadow-card flex flex-col overflow-hidden"
          style={{ width: leftWidth }}
        >
          <PromptPanel
            taskType={taskType}
            questionType={questionType}
            prompt={prompt}
            promptImage={promptImage}
            onTaskChange={switchTask}
            onQuestionTypeChange={setQuestionType}
            onPromptChange={setPrompt}
            onImageChange={setPromptImage}
          />
        </div>

        {/* Left drag handle */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize rounded-full bg-line/70 hover:bg-brand-muted transition-colors my-2"
          onMouseDown={startLeftDrag}
        />

        {/* Editor */}
        <div className="flex-1 min-w-[420px] flex flex-col overflow-hidden gap-3">
          {/* Editor card */}
          <div className="flex-1 bg-surface rounded-card border border-line shadow-editor overflow-hidden flex flex-col min-h-0">
            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={taskType === 'task1' ? c.editor.placeholder1 : c.editor.placeholder2}
              className="flex-1 w-full px-7 py-6 text-[15px] text-ink bg-transparent resize-none focus:outline-none leading-8 placeholder:text-ghost/60"
              spellCheck
            />
          </div>

          {/* Editor bottom bar */}
          <div className="shrink-0 flex flex-col gap-2">
            {/* Progress bar */}
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  wordCount >= targetWords ? 'bg-ok' : 'bg-brand'
                }`}
                style={{ width: `${wordProgress}%` }}
              />
            </div>

            {/* Action row */}
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => openTab('idea')}
                className="px-3 py-1.5 text-xs font-medium text-dim hover:text-brand hover:bg-brand-light rounded-btn transition-colors"
              >
                💡 {c.aiIdea}
              </button>
              <button
                onClick={() => openTab('expression')}
                className="px-3 py-1.5 text-xs font-medium text-dim hover:text-brand hover:bg-brand-light rounded-btn transition-colors"
              >
                ✍️ {c.aiExpression}
              </button>
              <div className="flex-1" />
              <span className="text-xs text-ghost">{taskType === 'task1' ? c.task1 : c.task2}</span>
            </div>
          </div>
        </div>

        {/* Right drag handle — only when sidebar expanded */}
        {!sidebarCollapsed && (
          <div
            className="w-1.5 shrink-0 cursor-col-resize rounded-full bg-line/70 hover:bg-brand-muted transition-colors my-2"
            onMouseDown={startRightDrag}
          />
        )}

        {/* AI Sidebar */}
        <div
          className={[
            'shrink-0 border border-line rounded-card shadow-card bg-surface flex flex-col overflow-hidden',
            !isResizing ? 'transition-[width] duration-200' : '',
          ].join(' ')}
          style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_W : rightWidth }}
        >
          <AISidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            taskType={taskType}
            essayId={essayId}
            prompt={prompt}
            questionType={questionType}
            onInsertText={handleInsertText}
          />
        </div>
      </div>

      {/* ── Diagnosis modal ───────────────────────────────────────── */}
      {showDiagModal && (
        <DiagnosisModal
          essayId={essayId}
          taskType={taskType}
          questionType={questionType}
          prompt={prompt}
          promptImage={promptImage}
          content={content}
          wordCount={wordCount}
          onClose={() => setShowDiagModal(false)}
        />
      )}
    </div>
  )
}
