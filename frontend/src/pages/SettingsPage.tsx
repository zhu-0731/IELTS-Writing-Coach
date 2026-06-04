import { useEffect, useState } from 'react'
import {
  getSettings,
  saveSettings,
  resetAllData,
  getFeatureSettings,
  saveFeatureSettings,
  type SettingsData,
  type SettingsWrite,
  type FeatureSettings,
  type FeatureSettingsWrite,
  type FeatureKey,
} from '../api/client'
import { copy } from '../i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModelSelect from '../components/ui/ModelSelect'
import { detectProvider, type ProviderPreset } from '../lib/modelPresets'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const c = copy.settings
const RESET_CONFIRM_PHRASE = c.reset.phrase

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
      sessionStorage.clear()
      window.location.replace('/')
    } catch {
      setErr(c.reset.error)
      setResetting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-panel shadow-panel w-full max-w-md p-8">
        <h3 className="text-base font-semibold text-ink mb-2">{c.reset.title}</h3>
        <p className="text-sm text-dim mb-1">{c.reset.desc1}</p>
        <p className="text-sm text-dim mb-5">
          <strong className="font-semibold text-ink">{c.reset.desc2Prefix}</strong> {c.reset.desc3}
        </p>

        <p className="text-sm font-medium text-dim mb-2">
          {c.reset.confirmInstruction}
          <code className="ml-1 px-2 py-0.5 bg-muted rounded text-danger font-mono text-xs">
            {RESET_CONFIRM_PHRASE}
          </code>
        </p>
        <input
          className="w-full px-3 py-2 border-2 border-line rounded-input text-sm font-mono focus:outline-none focus:border-danger text-ink mb-4 transition-colors"
          placeholder={RESET_CONFIRM_PHRASE}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />

        {err && <p className="text-sm text-danger mb-3">{err}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>{c.reset.cancel}</Button>
          <Button
            variant="danger-filled"
            onClick={handleReset}
            loading={resetting}
            disabled={!confirmed}
          >
            {resetting ? c.reset.confirming : c.reset.confirmBtn}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ghost">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-line rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors'

const a = copy.settings.advanced

function FeatureConfigCard({
  feature,
  initial,
}: {
  feature: FeatureKey
  initial: FeatureSettings
}) {
  const [eff, setEff] = useState<FeatureSettings>(initial)
  const [form, setForm] = useState({
    enabled: initial.enabled,
    base_url: initial.base_url,
    model_name: initial.model_name,
    api_key: '',
    temperature: initial.temperature,
    max_tokens: initial.max_tokens,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const payload: FeatureSettingsWrite = {
        enabled: form.enabled,
        base_url: form.base_url,
        model_name: form.model_name,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
      }
      if (form.api_key.trim()) payload.api_key = form.api_key.trim()
      const updated = await saveFeatureSettings(feature, payload)
      setEff(updated)
      setForm((f) => ({ ...f, api_key: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-card border border-line p-4">
      {/* Enable toggle */}
      <label className="flex items-start justify-between gap-3 cursor-pointer">
        <div>
          <span className="text-sm font-medium text-ink">{a.featureLabel[feature]}</span>
          <p className="text-xs text-ghost mt-0.5">{a.featureHint[feature]}</p>
        </div>
        <input
          type="checkbox"
          className="mt-1 accent-brand shrink-0"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
      </label>

      {/* Override fields */}
      {form.enabled && (
        <div className="mt-4 space-y-3">
          <FieldRow label={c.api.baseUrl} hint={a.fieldBlankHint}>
            <input
              className={inputCls}
              value={form.base_url}
              onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              placeholder={c.api.baseUrlPlaceholder}
            />
          </FieldRow>
          <FieldRow label={c.api.modelName} hint={a.fieldBlankHint}>
            <input
              className={inputCls}
              value={form.model_name}
              onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
              placeholder={c.api.modelPlaceholder}
            />
          </FieldRow>
          <FieldRow label={c.api.apiKey} hint={a.apiKeyHint}>
            <input
              className={inputCls}
              type="password"
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder={
                eff.api_key_masked
                  ? c.api.apiKeySet(eff.api_key_masked.replace(/\*/g, ''))
                  : c.api.apiKeyEmpty
              }
              autoComplete="off"
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label={c.capabilities.temperature}>
              <input
                className={inputCls}
                type="number" min="0" max="2" step="0.1"
                value={form.temperature}
                onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
              />
            </FieldRow>
            <FieldRow label={c.capabilities.maxTokens}>
              <input
                className={inputCls}
                type="number" min="256" max="8192" step="128"
                value={form.max_tokens}
                onChange={(e) => setForm((f) => ({ ...f, max_tokens: parseInt(e.target.value) }))}
              />
            </FieldRow>
          </div>
        </div>
      )}

      {/* Effective config indicator (reflects last saved state) */}
      <p className="mt-3 text-[11px] text-ghost leading-relaxed">
        {a.effectivePrefix}
        <span className={eff.effective_source === 'feature' ? 'text-brand font-medium' : 'text-dim font-medium'}>
          {eff.effective_source === 'feature' ? a.effectiveFeature : a.effectiveGeneral}
        </span>
        {' · '}
        {a.effectiveModel(eff.effective_model_name)} {a.effectiveBase(eff.effective_base_url)}
      </p>

      {/* Save */}
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={save} loading={saving}>
          {saving ? c.saving : c.save}
        </Button>
        {saved && <span className="text-xs text-ok font-medium">✓ {c.saved}</span>}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [showReset, setShowReset] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SettingsData | null>(null)
  const [detected, setDetected] = useState<ProviderPreset | null>(null)
  const [features, setFeatures] = useState<Record<FeatureKey, FeatureSettings> | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [form, setForm] = useState({
    provider: 'openai_compatible',
    model_name: '',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    supports_vision: false,
    temperature: 0.7,
    max_tokens: 2048,
  })

  function updateDetected(url: string) {
    const preset = detectProvider(url)
    setDetected(preset)
    return preset
  }

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
          api_key: '',
        }))
        updateDetected(s.base_url)
        setStatus('idle')
      })
      .catch(() => {
        setError(c.loadError)
        setStatus('error')
      })
    getFeatureSettings().then(setFeatures).catch(() => {})
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
      if (form.api_key.trim()) payload.api_key = form.api_key.trim()
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

  return (
    <div className="max-w-2xl mx-auto py-10 px-5">
      {showReset && <ResetModal onClose={() => setShowReset(false)} />}

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
        <p className="text-sm text-dim mt-1">{c.subtitle}</p>
      </div>

      {status === 'loading' && <p className="text-sm text-ghost">{c.loading}</p>}

      {status === 'error' && !data && (
        <div className="bg-danger-light border border-danger/20 rounded-card p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {data && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* API config */}
          <Card padding="lg">
            <h2 className="text-sm font-semibold text-ink mb-5">{c.api.title}</h2>
            <div className="space-y-4">
              <FieldRow label={c.api.baseUrl} hint={c.api.baseUrlHint}>
                <input
                  className={inputCls}
                  value={form.base_url}
                  onChange={(e) => {
                    const url = e.target.value
                    const preset = updateDetected(url)
                    setForm((f) => ({
                      ...f,
                      base_url: url,
                      ...(preset && f.model_name === '' && preset.supportsVisionDefault !== undefined
                        ? { supports_vision: preset.supportsVisionDefault }
                        : {}),
                    }))
                  }}
                  placeholder={c.api.baseUrlPlaceholder}
                />
              </FieldRow>

              <FieldRow label={c.api.modelName}>
                <ModelSelect
                  value={form.model_name}
                  onChange={(val, supportsVision) => {
                    setForm((f) => ({
                      ...f,
                      model_name: val,
                      ...(supportsVision !== undefined
                        ? { supports_vision: supportsVision }
                        : {}),
                    }))
                  }}
                  options={detected?.models ?? []}
                  providerName={detected?.name ?? null}
                  placeholder={c.api.modelPlaceholder}
                />
              </FieldRow>

              <FieldRow label={c.api.apiKey} hint={c.api.apiKeyHint}>
                <input
                  className={inputCls}
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder={
                    data.api_key_masked
                      ? c.api.apiKeySet(data.api_key_masked.replace(/\*/g, ''))
                      : c.api.apiKeyEmpty
                  }
                  autoComplete="off"
                />
              </FieldRow>
            </div>
          </Card>

          {/* Capabilities */}
          <Card padding="lg">
            <h2 className="text-sm font-semibold text-ink mb-5">{c.capabilities.title}</h2>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-brand"
                  checked={form.supports_vision}
                  onChange={(e) => setForm((f) => ({ ...f, supports_vision: e.target.checked }))}
                />
                <div>
                  <span className="text-sm font-medium text-ink">{c.capabilities.vision}</span>
                  <p className="text-xs text-ghost mt-0.5">{c.capabilities.visionHint}</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <FieldRow label={c.capabilities.temperature}>
                  <input
                    className={inputCls}
                    type="number" min="0" max="2" step="0.1"
                    value={form.temperature}
                    onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                  />
                </FieldRow>
                <FieldRow label={c.capabilities.maxTokens}>
                  <input
                    className={inputCls}
                    type="number" min="256" max="8192" step="128"
                    value={form.max_tokens}
                    onChange={(e) => setForm((f) => ({ ...f, max_tokens: parseInt(e.target.value) }))}
                  />
                </FieldRow>
              </div>
            </div>
          </Card>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" loading={status === 'saving'}>
              {status === 'saving' ? c.saving : c.save}
            </Button>
            {status === 'saved' && (
              <span className="text-sm text-ok font-medium">✓ {c.saved}</span>
            )}
          </div>
        </form>
      )}

      {/* Advanced: per-feature LLM overrides */}
      {features && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-dim hover:text-ink transition-colors"
          >
            <span className={`inline-block transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>›</span>
            {a.title}
          </button>

          {showAdvanced && (
            <Card padding="lg" className="mt-3">
              <p className="text-xs text-ghost mb-4 leading-relaxed">{a.subtitle}</p>
              <div className="space-y-4">
                <FeatureConfigCard feature="diagnosis" initial={features.diagnosis} />
                <FeatureConfigCard feature="practice" initial={features.practice} />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-12 pt-8 border-t border-line">
        <h2 className="text-sm font-semibold text-danger mb-1">{c.danger.title}</h2>
        <p className="text-sm text-ghost mb-4">{c.danger.desc}</p>
        <Button variant="danger" onClick={() => setShowReset(true)}>
          {c.danger.button}
        </Button>
      </div>
    </div>
  )
}
