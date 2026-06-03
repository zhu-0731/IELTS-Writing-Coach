import { useEffect, useState } from 'react'
import { getSettings, saveSettings, resetAllData, type SettingsData, type SettingsWrite } from '../api/client'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const RESET_CONFIRM_PHRASE = 'reset my data'

function ResetModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('')
  const [resetting, setResetting] = useState(false)
  const [err, setErr] = useState('')
  const confirmed = input === RESET_CONFIRM_PHRASE

  async function handleReset() {
    if (!confirmed) return
    setResetting(true)
    setErr('')
    try {
      await resetAllData()
      window.location.replace('/')
    } catch {
      setErr('清空失败，请确认后端正在运行')
      setResetting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h3 className="text-lg font-bold text-slate-800 mb-2">清空所有数据</h3>
        <p className="text-sm text-slate-500 mb-1">
          此操作将删除：问卷设置、所有作文、语言资源、诊断记录。
        </p>
        <p className="text-sm text-slate-500 mb-6">
          <strong>API 配置（Key、模型）不会删除。</strong>删除后将跳回初始设置。
        </p>

        <p className="text-sm font-medium text-slate-700 mb-2">
          请输入以下内容确认：
          <code className="ml-1 px-2 py-0.5 bg-slate-100 rounded text-red-600 font-mono">
            {RESET_CONFIRM_PHRASE}
          </code>
        </p>
        <input
          className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-red-400 mb-4"
          placeholder={RESET_CONFIRM_PHRASE}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />

        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleReset}
            disabled={!confirmed || resetting}
            className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {resetting ? '清空中…' : '确认清空'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [showReset, setShowReset] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SettingsData | null>(null)

  // 编辑中的字段（api_key 单独管理，不回显）
  const [form, setForm] = useState({
    provider: 'openai_compatible',
    model_name: '',
    base_url: 'https://api.openai.com/v1',
    api_key: '',          // 用户输入的新 key（留空=不修改）
    supports_vision: false,
    temperature: 0.7,
    max_tokens: 2048,
  })

  useEffect(() => {
    getSettings()
      .then((s) => {
        setData(s)
        setForm((f) => ({
          ...f,
          provider: s.provider,
          model_name: s.model_name,
          base_url: s.base_url,
          supports_vision: s.supports_vision,
          temperature: s.temperature,
          max_tokens: s.max_tokens,
          api_key: '',   // 永远不预填，让用户主动输入才更新
        }))
        setStatus('idle')
      })
      .catch(() => {
        setError('无法加载设置，请确认后端已启动')
        setStatus('error')
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      const payload: SettingsWrite = {
        provider: form.provider,
        model_name: form.model_name,
        base_url: form.base_url,
        supports_vision: form.supports_vision,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
      }
      // 只有用户填了新 key 才更新
      if (form.api_key.trim()) {
        payload.api_key = form.api_key.trim()
      }
      const updated = await saveSettings(payload)
      setData(updated)
      setForm((f) => ({ ...f, api_key: '' }))
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
      setStatus('idle')
    }
  }

  function field(label: string, node: React.ReactNode, hint?: string) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        {node}
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {showReset && <ResetModal onClose={() => setShowReset(false)} />}
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">设置</h1>
      <p className="text-sm text-slate-500 mb-8">
        配置 AI 模型。API Key 仅存储在本地数据库，不会上传或提交到代码仓库。
      </p>

      {status === 'loading' && (
        <p className="text-slate-400 text-sm">加载中…</p>
      )}

      {status === 'error' && !data && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {data && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* API 配置 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-700">API 配置</h2>

            {field(
              'Base URL',
              <input
                className={inputCls}
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="https://api.openai.com/v1"
              />,
              '支持任意 OpenAI-compatible 接口，包括本地 Ollama、vLLM 等',
            )}

            {field(
              'Model Name',
              <input
                className={inputCls}
                value={form.model_name}
                onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                placeholder="gpt-4o-mini"
              />,
            )}

            {field(
              'API Key',
              <input
                className={inputCls}
                type="password"
                value={form.api_key}
                onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                placeholder={data.api_key_masked ? `已设置（末四位：${data.api_key_masked.replace(/\*/g, '')}****）` : '输入 API Key'}
                autoComplete="off"
              />,
              '留空则不修改已保存的 Key。Key 仅存于本地 SQLite，不出现在代码或日志中。',
            )}
          </div>

          {/* 能力配置 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-700">模型能力</h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-500"
                checked={form.supports_vision}
                onChange={(e) => setForm((f) => ({ ...f, supports_vision: e.target.checked }))}
              />
              <div>
                <span className="text-sm font-medium text-slate-700">支持多模态图片（Vision）</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  开启后可上传题目图片。需要当前模型支持 vision，否则图片将无法识别。
                </p>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4">
              {field(
                '温度参数 (Temperature)',
                <input
                  className={inputCls}
                  type="number"
                  min="0" max="2" step="0.1"
                  value={form.temperature}
                  onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                />,
              )}
              {field(
                '最大输出 Token',
                <input
                  className={inputCls}
                  type="number"
                  min="256" max="8192" step="128"
                  value={form.max_tokens}
                  onChange={(e) => setForm((f) => ({ ...f, max_tokens: parseInt(e.target.value) }))}
                />,
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === 'saving'}
              className="px-6 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              {status === 'saving' ? '保存中…' : '保存设置'}
            </button>
            {status === 'saved' && (
              <span className="text-sm text-green-600">✓ 已保存</span>
            )}
          </div>
        </form>
      )}

      {/* 危险区 */}
      <div className="mt-12 border-t border-red-100 pt-8">
        <h2 className="text-base font-semibold text-red-600 mb-1">危险操作</h2>
        <p className="text-sm text-slate-400 mb-4">
          清空所有学习数据（问卷、作文、诊断记录）。API 配置保留。
        </p>
        <button
          onClick={() => setShowReset(true)}
          className="px-5 py-2.5 border-2 border-red-300 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors"
        >
          清空数据…
        </button>
      </div>
    </div>
  )
}
