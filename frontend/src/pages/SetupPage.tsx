import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfile, type ProfileData } from '../api/client'

const STEPS = [
  {
    key: 'target_band',
    question: '你的目标雅思写作分数是？',
    options: ['5.5', '6.0', '6.5', '7.0+'],
  },
  {
    key: 'main_task',
    question: '你主要练习哪种题型？',
    options: [
      { label: 'Task 1 小作文', value: 'task1' },
      { label: 'Task 2 大作文', value: 'task2' },
      { label: '两个都练', value: 'both' },
    ],
  },
  {
    key: 'main_problem',
    question: '写作时你最常卡在哪里？',
    options: [
      '不知道写什么',
      '知道中文但不会英文说',
      '语法和拼写容易错',
      '写得太慢',
      '不知道怎么套模板',
    ],
  },
  {
    key: 'template_style',
    question: '你希望模板和语言资源的难度偏向？',
    options: ['简单稳妥，少出错', '稍微高级，冲 6.5', '更学术，冲 7+'],
  },
  {
    key: 'allow_profile_update',
    question: '是否允许系统持续学习你的写作习惯？',
    hint: '开启后，系统会根据你的历史作文持续更新个性化推荐。',
    options: [
      { label: '允许，持续学习', value: 'true' },
      { label: '不允许，只做单次分析', value: 'false' },
    ],
  },
]

type Answers = Record<string, string>

interface Props {
  onComplete: () => void
}

export default function SetupPage({ onComplete }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const current = STEPS[step]
  const selected = answers[current.key]
  const isLast = step === STEPS.length - 1

  function getOptionValue(opt: string | { label: string; value: string }) {
    return typeof opt === 'string' ? opt : opt.value
  }

  function getOptionLabel(opt: string | { label: string; value: string }) {
    return typeof opt === 'string' ? opt : opt.label
  }

  function select(value: string) {
    setAnswers((prev) => ({ ...prev, [current.key]: value }))
  }

  async function next() {
    if (!selected) return
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    setSaving(true)
    setError('')
    try {
      const profile: ProfileData = {
        target_band: answers['target_band'],
        main_task: answers['main_task'],
        main_problem: answers['main_problem'],
        template_style: answers['template_style'],
        allow_profile_update: answers['allow_profile_update'] === 'true',
      }
      await saveProfile(profile)
      onComplete()
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败，请重试')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 顶部进度条 */}
      <div className="w-full h-1 bg-slate-200">
        <div
          className="h-1 bg-blue-500 transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">

          {/* 步骤指示 */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                  i < step ? 'bg-blue-400' : i === step ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* 主卡片 */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 px-10 py-12">
            <p className="text-xs font-semibold text-blue-500 tracking-widest uppercase mb-4">
              第 {step + 1} 步 / 共 {STEPS.length} 步
            </p>
            <h2 className="text-2xl font-bold text-slate-800 mb-2 leading-snug">
              {current.question}
            </h2>
            {'hint' in current && current.hint && (
              <p className="text-sm text-slate-400 mb-8">{current.hint}</p>
            )}

            <div className="space-y-3 mt-8">
              {current.options.map((opt) => {
                const val = getOptionValue(opt)
                const label = getOptionLabel(opt)
                const isSelected = selected === val
                return (
                  <button
                    key={val}
                    onClick={() => select(val)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className={`inline-block w-4 h-4 rounded-full border-2 mr-3 align-middle transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                    }`} />
                    {label}
                  </button>
                )
              })}
            </div>

            {error && (
              <p className="mt-5 text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* 导航按钮 */}
          <div className="flex items-center justify-between mt-6 px-1">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← 上一步
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={next}
              disabled={!selected || saving}
              className="px-7 py-3 bg-blue-500 text-white text-sm font-semibold rounded-2xl hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {saving ? '保存中…' : isLast ? '完成设置 ✓' : '下一步 →'}
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-slate-300">
            IELTS Writing Coach · 开源个人写作训练工具
          </p>
        </div>
      </div>
    </div>
  )
}
