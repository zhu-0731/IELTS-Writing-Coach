interface Props {
  taskType: 'task1' | 'task2'
  questionType: string
  prompt: string
  onQuestionTypeChange: (v: string) => void
  onPromptChange: (v: string) => void
}

const TASK1_TYPES = [
  { value: 'bar_chart', label: '柱状图' },
  { value: 'line_chart', label: '折线图' },
  { value: 'pie_chart', label: '饼图' },
  { value: 'table', label: '表格' },
  { value: 'map', label: '地图' },
  { value: 'process', label: '流程图' },
  { value: 'mixed', label: '混合图' },
]

const TASK2_TYPES = [
  { value: 'discussion', label: 'Discussion' },
  { value: 'opinion', label: 'Opinion' },
  { value: 'problem_solution', label: 'Problem-Solution' },
  { value: 'direct_question', label: 'Direct Question' },
  { value: 'advantages_disadvantages', label: 'Adv. / Disadv.' },
]

export default function PromptPanel({ taskType, questionType, prompt, onQuestionTypeChange, onPromptChange }: Props) {
  const types = taskType === 'task1' ? TASK1_TYPES : TASK2_TYPES

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">题型</label>
        <select
          value={questionType}
          onChange={(e) => onQuestionTypeChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">请选择…</option>
          {types.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex flex-col">
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">题目</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={taskType === 'task1'
            ? '粘贴题目描述，或描述图表内容…'
            : '粘贴题目，例如：Some people think that…'}
          className="flex-1 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed"
        />
      </div>

      {taskType === 'task1' && (
        <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400">图片上传（Phase 5）</p>
          <p className="text-xs text-slate-300 mt-0.5">需开启 Vision 模型支持</p>
        </div>
      )}
    </div>
  )
}
