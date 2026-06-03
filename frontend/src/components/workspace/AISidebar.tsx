import { useState } from 'react'

type Tab = 'hint' | 'idea' | 'expression'

interface Props {
  collapsed: boolean
  onToggle: () => void
}

const TABS: { key: Tab; label: string; short: string }[] = [
  { key: 'hint', label: 'AI 提示', short: '提' },
  { key: 'idea', label: '我不知道写什么', short: '思' },
  { key: 'expression', label: '我不会用英文说', short: '表' },
]

export default function AISidebar({ collapsed, onToggle }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('hint')

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-4">
        <button
          onClick={onToggle}
          title="展开 AI 助手"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-500 transition-colors"
        >
          ‹
        </button>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { onToggle(); setActiveTab(t.key) }}
            title={t.label}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100 transition-colors"
          >
            {t.short}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">AI 助手</span>
        <button
          onClick={onToggle}
          title="收起"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Tab 选择 */}
      <div className="flex border-b border-slate-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === t.key
                ? 'text-blue-600 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'hint' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">根据题目和题型，从你的语言资源库中检索相关句型和词块。</p>
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-300">Phase 3 实现</p>
              <p className="text-xs text-slate-200 mt-1">先保存草稿，功能开发中</p>
            </div>
          </div>
        )}
        {activeTab === 'idea' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">根据题目分析写作任务，给出中文思路和可选立场。</p>
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-300">Phase 3 实现</p>
            </div>
          </div>
        )}
        {activeTab === 'expression' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">输入中文或选中编辑器中的文字，获取低/中/高三档英文表达。</p>
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-300">Phase 3 实现</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
