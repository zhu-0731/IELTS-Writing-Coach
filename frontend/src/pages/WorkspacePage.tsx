import { useState, useEffect, useRef, useCallback } from 'react'
import { createEssay, updateEssay } from '../api/client'
import PromptPanel from '../components/workspace/PromptPanel'
import AISidebar from '../components/workspace/AISidebar'

type TaskType = 'task1' | 'task2'

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function WorkspacePage() {
  const [taskType, setTaskType] = useState<TaskType>('task2')
  const [questionType, setQuestionType] = useState('')
  const [prompt, setPrompt] = useState('')
  const [content, setContent] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showDiagModal, setShowDiagModal] = useState(false)

  const [essayId, setEssayId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [elapsed, setElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const wordCount = countWords(content)

  const handleContentChange = (val: string) => {
    setContent(val)
    if (!timerRunning && val.length > 0) setTimerRunning(true)
  }

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

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
    setTaskType(t)
    setQuestionType('')
    setPrompt('')
    setContent('')
    setEssayId(null)
    setElapsed(0)
    setTimerRunning(false)
    setSaveStatus('idle')
  }

  const saveStatusLabel = {
    idle: essayId ? '草稿已保存' : '',
    saving: '保存中…',
    saved: '已保存 ✓',
    error: '保存失败',
  }[saveStatus]

  const targetWords = taskType === 'task1' ? 150 : 250
  const maxWords = taskType === 'task1' ? 200 : 300

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['task1', 'task2'] as TaskType[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTask(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                taskType === t
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'task1' ? 'Task 1 小作文' : 'Task 2 大作文'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-5 text-sm text-slate-500">
          <span className="tabular-nums">
            <span className={wordCount >= targetWords ? 'text-green-600 font-medium' : ''}>
              {wordCount}
            </span>
            <span className="ml-1 text-xs text-slate-300">/ 建议 {targetWords}+</span>
          </span>

          <button
            onClick={() => setTimerRunning((r) => !r)}
            className="tabular-nums font-mono hover:text-slate-700 transition-colors select-none"
            title={timerRunning ? '暂停' : '继续'}
          >
            {timerRunning ? '⏸' : '▶'} {formatTime(elapsed)}
          </button>

          <span className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
            {saveStatusLabel}
          </span>

          <button
            onClick={doSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
          >
            保存草稿
          </button>

          <button
            onClick={() => setShowDiagModal(true)}
            disabled={wordCount < 10}
            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          >
            诊断全文
          </button>
        </div>
      </div>

      {/* 三栏主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 题目区 */}
        <div className="w-[280px] shrink-0 border-r border-slate-100 bg-white flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-0 shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">题目</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <PromptPanel
              taskType={taskType}
              questionType={questionType}
              prompt={prompt}
              onQuestionTypeChange={setQuestionType}
              onPromptChange={setPrompt}
            />
          </div>
        </div>

        {/* 写作区 */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={taskType === 'task1'
              ? 'The chart illustrates… 开始你的小作文'
              : 'In recent years, … 开始你的大作文'}
            className="flex-1 w-full px-8 py-6 text-[15px] text-slate-800 bg-transparent resize-none focus:outline-none leading-8 placeholder:text-slate-300"
            spellCheck
          />
          <div className="px-8 pb-3 shrink-0">
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${wordCount >= targetWords ? 'bg-green-400' : 'bg-blue-400'}`}
                style={{ width: `${Math.min(100, (wordCount / maxWords) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* AI 侧边栏 */}
        <div
          className={`shrink-0 border-l border-slate-100 bg-white flex flex-col overflow-hidden transition-[width] duration-200 ${
            sidebarCollapsed ? 'w-14' : 'w-[360px]'
          }`}
        >
          <AISidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
        </div>
      </div>

      {/* 诊断 Modal 占位 */}
      {showDiagModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDiagModal(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-2">诊断全文</h3>
            <p className="text-sm text-slate-500 mb-6">
              AI 诊断功能将在 Phase 4 实现。届时将输出估分、最大失分点、最该改的三句话等结构化诊断结果。
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500 space-y-1.5">
              <p>当前字数：<strong>{wordCount}</strong> 词</p>
              {essayId && <p className="text-xs text-slate-400 font-mono">草稿 ID：{essayId}</p>}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDiagModal(false)}
                className="px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
