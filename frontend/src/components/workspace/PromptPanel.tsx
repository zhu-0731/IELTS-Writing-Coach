import { useRef } from 'react'
import { copy } from '../../i18n'

type TaskType = 'task1' | 'task2'

interface Props {
  taskType: TaskType
  questionType: string
  prompt: string
  promptImage: string | null
  onTaskChange: (t: TaskType) => void
  onQuestionTypeChange: (v: string) => void
  onPromptChange: (v: string) => void
  onImageChange: (dataUrl: string | null) => void
}

const c = copy.workspace

const TASK1_TYPES = Object.entries(c.taskTypes.task1).map(([value, label]) => ({ value, label }))
const TASK2_TYPES = Object.entries(c.taskTypes.task2).map(([value, label]) => ({ value, label }))

const REQUIREMENTS: Record<TaskType, string[]> = {
  task1: [...c.requirements.task1],
  task2: [...c.requirements.task2],
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB

export default function PromptPanel({
  taskType, questionType, prompt, promptImage,
  onTaskChange, onQuestionTypeChange, onPromptChange, onImageChange,
}: Props) {
  const types = taskType === 'task1' ? TASK1_TYPES : TASK2_TYPES
  const reqs = REQUIREMENTS[taskType]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      alert('图片不超过 4 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onImageChange(reader.result as string)
    reader.readAsDataURL(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Task type toggle */}
      <div className="p-4 shrink-0">
        <div className="flex gap-1 bg-muted p-1 rounded-card">
          {(['task1', 'task2'] as TaskType[]).map((t) => (
            <button
              key={t}
              onClick={() => onTaskChange(t)}
              className={[
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                taskType === t
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ghost hover:text-dim',
              ].join(' ')}
            >
              {t === 'task1' ? 'Task 1' : 'Task 2'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 flex flex-col gap-4">
        {/* Question type */}
        <div>
          <label className="block text-[11px] font-semibold text-ghost uppercase tracking-widest mb-1.5">
            {c.prompt.questionType}
          </label>
          <select
            value={questionType}
            onChange={(e) => onQuestionTypeChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-line rounded-input bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
          >
            <option value="">{c.prompt.selectType}</option>
            {types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Essay prompt */}
        <div className="shrink-0 flex flex-col">
          <label className="block text-[11px] font-semibold text-ghost uppercase tracking-widest mb-1.5">
            {c.prompt.section}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={taskType === 'task1' ? c.prompt.placeholder1 : c.prompt.placeholder2}
            className="h-52 w-full px-3 py-2.5 text-sm border border-line rounded-input resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand leading-relaxed text-ink placeholder:text-ghost transition-colors"
          />
        </div>

        {/* Writing requirements */}
        <div className="shrink-0 pt-3 border-t border-line">
          <p className="text-[11px] font-semibold text-ghost uppercase tracking-widest mb-2">
            {c.requirements.title}
          </p>
          <ul className="space-y-1.5">
            {reqs.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-dim leading-relaxed">
                <span className="text-ok shrink-0 mt-px">✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Image upload (Task 1 only) */}
        {taskType === 'task1' && (
          <div className="shrink-0">
            <label className="block text-[11px] font-semibold text-ghost uppercase tracking-widest mb-1.5">
              {c.prompt.imageUpload}
            </label>
            {promptImage ? (
              <div className="relative rounded-input overflow-hidden border border-line">
                <img
                  src={promptImage}
                  alt="题目图片"
                  className="w-full max-h-40 object-contain bg-muted"
                />
                <button
                  onClick={() => onImageChange(null)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/60 text-white text-xs flex items-center justify-center hover:bg-ink transition-colors"
                  title="移除图片"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-line rounded-input py-3 px-3 text-center hover:border-brand/50 hover:bg-brand-light/30 transition-colors"
              >
                <p className="text-xs text-ghost">点击上传图表图片</p>
                <p className="text-[11px] text-ghost/60 mt-0.5">{c.prompt.imageUploadHint}</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
