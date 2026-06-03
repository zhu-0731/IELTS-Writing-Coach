const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text}`)
  }
  return res.json()
}

// Profile
export interface ProfileStatus { is_setup_complete: boolean }
export interface ProfileData {
  target_band: string
  main_task: string
  main_problem: string
  template_style: string
  allow_profile_update: boolean
}

export const getProfileStatus = () =>
  request<ProfileStatus>('/profile/status')

export const getProfile = () =>
  request<ProfileData>('/profile')

export const saveProfile = (data: ProfileData) =>
  request<ProfileData>('/profile', { method: 'POST', body: JSON.stringify(data) })

// Settings
export interface SettingsData {
  provider: string
  model_name: string
  base_url: string
  api_key_masked: string
  supports_vision: boolean
  supports_json_schema: boolean
  supports_tool_calling: boolean
  temperature: number
  max_tokens: number
}

export interface SettingsWrite {
  provider?: string
  model_name?: string
  base_url?: string
  api_key?: string
  supports_vision?: boolean
  supports_json_schema?: boolean
  supports_tool_calling?: boolean
  temperature?: number
  max_tokens?: number
}

export const getSettings = () =>
  request<SettingsData>('/settings')

export const saveSettings = (data: SettingsWrite) =>
  request<SettingsData>('/settings', { method: 'PUT', body: JSON.stringify(data) })

// Data reset
export const resetAllData = () =>
  request<{ ok: boolean }>('/data/reset', { method: 'POST' })

// Essays
export interface EssayData {
  essay_id: string
  task_type: string
  question_type: string | null
  prompt: string
  content: string
  word_count: number
  topic_tags_json: string
  created_at: string
  updated_at: string
}

export interface EssayCreate {
  task_type: string
  question_type?: string
  prompt?: string
  content?: string
  word_count?: number
}

export interface EssayUpdate {
  question_type?: string
  prompt?: string
  content?: string
  word_count?: number
}

export const createEssay = (data: EssayCreate) =>
  request<EssayData>('/essays', { method: 'POST', body: JSON.stringify(data) })

export const updateEssay = (id: string, data: EssayUpdate) =>
  request<EssayData>(`/essays/${id}`, { method: 'PUT', body: JSON.stringify(data) })
