import { copy } from '../../i18n'
import Tabs from '../ui/Tabs'
import HintTab from './HintTab'
import IdeaTab from './IdeaTab'
import ExpressionTab from './ExpressionTab'

type Tab = 'hint' | 'idea' | 'expression'

interface Props {
  collapsed: boolean
  onToggle: () => void
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  // essay context
  taskType: string
  essayId: string | null
  prompt: string
  questionType: string
  onInsertText: (text: string) => void
}

const c = copy.workspace.sidebar

const TAB_LIST = [
  { key: 'hint' as Tab,        label: c.tabs.hint },
  { key: 'idea' as Tab,        label: c.tabs.idea },
  { key: 'expression' as Tab,  label: c.tabs.expression },
]

const SHORT: Record<Tab, string> = { hint: '提', idea: '思', expression: '表' }

export default function AISidebar({
  collapsed,
  onToggle,
  activeTab,
  onTabChange,
  taskType,
  essayId,
  prompt,
  questionType,
  onInsertText,
}: Props) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-3 h-full">
        <button
          onClick={onToggle}
          title={c.expand}
          className="w-9 h-9 flex items-center justify-center rounded-card bg-brand-light text-brand hover:bg-brand-muted transition-colors text-base"
        >
          ‹
        </button>
        {TAB_LIST.map((t) => (
          <button
            key={t.key}
            onClick={() => { onTabChange(t.key); onToggle() }}
            title={t.label}
            className={[
              'w-9 h-9 flex items-center justify-center rounded-card text-xs font-bold transition-colors',
              activeTab === t.key ? 'bg-brand-muted text-brand' : 'text-ghost hover:bg-muted',
            ].join(' ')}
          >
            {SHORT[t.key]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <span className="text-sm font-semibold text-ink">{c.title}</span>
        <button
          onClick={onToggle}
          title={c.collapse}
          className="w-7 h-7 flex items-center justify-center rounded-btn text-ghost hover:bg-muted hover:text-dim transition-colors"
        >
          ›
        </button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={TAB_LIST}
        active={activeTab}
        onChange={(k) => onTabChange(k as Tab)}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'hint' && (
          <HintTab taskType={taskType} essayId={essayId} />
        )}
        {activeTab === 'idea' && (
          <IdeaTab
            taskType={taskType}
            questionType={questionType}
            prompt={prompt}
            essayId={essayId}
          />
        )}
        {activeTab === 'expression' && (
          <ExpressionTab taskType={taskType} onInsertText={onInsertText} />
        )}
      </div>
    </div>
  )
}
