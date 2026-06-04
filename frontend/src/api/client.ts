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

// Per-feature LLM overrides
export type FeatureKey = 'diagnosis' | 'practice'

export interface FeatureSettings {
  feature: string
  enabled: boolean
  model_name: string
  base_url: string
  api_key_masked: string
  temperature: number
  max_tokens: number
  // Effective config after override/fallback resolution
  effective_source: 'general' | 'feature'
  effective_model_name: string
  effective_base_url: string
  effective_api_key_masked: string
}

export interface FeatureSettingsWrite {
  enabled?: boolean
  model_name?: string
  base_url?: string
  api_key?: string
  temperature?: number
  max_tokens?: number
}

export const getFeatureSettings = () =>
  request<Record<FeatureKey, FeatureSettings>>('/settings/features')

export const saveFeatureSettings = (feature: FeatureKey, data: FeatureSettingsWrite) =>
  request<FeatureSettings>(`/settings/features/${feature}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

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

// Hints (language resources)
export interface HintCard {
  resource_id: string
  type: string
  name: string
  zh_goal: string
  pattern: string
  items_json: string
  zh_logic_chain_json: string
  common_errors_json: string
  difficulty: string
  mastery: string
  mastery_score: number
}

export const getHints = (taskType: string, limit = 6) =>
  request<HintCard[]>(`/hints?task_type=${taskType}&limit=${limit}`)

export const recordHintAction = (
  resourceId: string,
  data: { essay_id?: string | null; action: string },
) => request<{ ok: boolean; new_mastery_score: number }>(`/hints/${resourceId}/action`, {
  method: 'POST',
  body: JSON.stringify(data),
})

export interface MatchHintsResult {
  context: string
  hints: HintCard[]
}

export const matchHints = (data: {
  prompt: string
  task_type: string
  essay_id?: string | null
  limit?: number
}) => request<MatchHintsResult>('/hints/match', {
  method: 'POST',
  body: JSON.stringify(data),
})

// Idea Coach
export interface IdeaStance {
  label: string
  logic_chain: string[]
}

export interface IdeaResult {
  task_breakdown: string
  stances: IdeaStance[]
  usage_note: string
}

export const generateIdea = (data: {
  task_type: string
  question_type: string
  prompt: string
  essay_id?: string | null
}) => request<IdeaResult>('/coach/idea', { method: 'POST', body: JSON.stringify(data) })

// Expression Coach
export interface ExpressionLevel {
  en: string
  tip: string
}

export interface ExpressionResult {
  low_risk: ExpressionLevel
  recommended: ExpressionLevel
  advanced: ExpressionLevel
  usage_guide: string
}

export const generateExpression = (data: { chinese_text: string; task_type: string }) =>
  request<ExpressionResult>('/coach/expression', { method: 'POST', body: JSON.stringify(data) })

// Diagnosis
export interface DiagnosisProblem {
  category: string
  issue: string
  severity: 'high' | 'medium'
}

export interface DiagnosisFix {
  original: string
  problem: string
  suggestion: string
  scope?: 'word' | 'sentence' | 'paragraph'
  category?: 'spelling' | 'grammar' | 'expression' | 'logic'
  paragraph_index?: number
  sentence_index?: number
  resource_name: string
  resource_type: string
  resource_goal?: string
  resource_pattern?: string
  resource_items?: string[]
}

export interface DiagnosisPhraseResource {
  pattern: string
  name: string
  goal: string
  type: string
}

export interface DiagnosisResult {
  diagnosis_id: string
  estimated_band: string
  main_problems: DiagnosisProblem[]
  top_sentence_fixes: DiagnosisFix[]
  phrase_resources?: DiagnosisPhraseResource[]
  template_misuse: string
  next_training_task: string
  saved_resource_count: number
}

export const runDiagnosis = (data: {
  essay_id?: string | null
  task_type: string
  question_type: string
  prompt: string
  content: string
  image_base64?: string
}) => request<DiagnosisResult>('/diagnosis/full', { method: 'POST', body: JSON.stringify(data) })

// Home summary
export interface HomeResource {
  resource_id: string
  type: string
  name: string
  zh_goal: string
  mastery: string
  mastery_score: number
}

export interface HomeProblemStat {
  category: string
  count: number
}

export interface HomeSummary {
  profile: {
    target_band: string
    main_task: string
    main_problem: string
    template_style: string
    allow_profile_update: boolean
  } | null
  api_configured: boolean
  recent_diagnosis: {
    diagnosis_id: string
    essay_id: string
    estimated_band: string
    main_problems: DiagnosisProblem[]
    next_training_task: string
    created_at: string
  } | null
  recent_resources: HomeResource[]
  problem_stats: HomeProblemStat[]
  essay_count: number
  diagnosis_count: number
}

export const getHomeSummary = () => request<HomeSummary>('/home/summary')

// Language Resources (templates page)
export interface ResourceItem {
  resource_id: string
  type: string
  name: string
  zh_goal: string
  pattern: string
  items_json: string
  zh_logic_chain_json: string
  common_errors_json: string
  difficulty: string
  mastery: string
  mastery_score: number
  task_types_json: string
  source_essay_id: string | null
  created_at: string
}

export interface ResourceList {
  total: number
  items: ResourceItem[]
}

export const listResources = (params?: {
  type?: string
  mastery?: string
  task_type?: string
  limit?: number
  offset?: number
}) => {
  const q = new URLSearchParams()
  if (params?.type) q.set('type', params.type)
  if (params?.mastery) q.set('mastery', params.mastery)
  if (params?.task_type) q.set('task_type', params.task_type)
  if (params?.limit != null) q.set('limit', String(params.limit))
  if (params?.offset != null) q.set('offset', String(params.offset))
  const qs = q.toString()
  return request<ResourceList>(`/resources${qs ? '?' + qs : ''}`)
}

export const createResource = (data: {
  type: string
  name: string
  zh_goal: string
  pattern: string
  items?: string[]
  task_type?: string
  source_essay_id?: string | null
}) => request<ResourceItem>('/resources', {
  method: 'POST',
  body: JSON.stringify(data),
})

// Essays list (history page)
export interface EssayListItem {
  essay_id: string
  task_type: string
  question_type: string | null
  prompt: string
  word_count: number
  created_at: string
  updated_at: string
  diagnosis_id: string | null
  estimated_band: string | null
  main_problems_json: string | null
  next_training_task: string | null
}

export interface EssayList {
  total: number
  items: EssayListItem[]
}

export const listEssays = (params?: { limit?: number; offset?: number }) => {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set('limit', String(params.limit))
  if (params?.offset != null) q.set('offset', String(params.offset))
  const qs = q.toString()
  return request<EssayList>(`/essays${qs ? '?' + qs : ''}`)
}

export const getEssayContent = (essayId: string) =>
  request<EssayData>(`/essays/${essayId}`)

export const deleteEssay = (essayId: string) =>
  fetch(`${BASE}/essays/${essayId}`, { method: 'DELETE' })

export const deleteResource = (resourceId: string) =>
  fetch(`${BASE}/resources/${resourceId}`, { method: 'DELETE' })

// Practice
export interface PracticeItem {
  item_id: string
  session_id: string
  order_idx: number
  category: string        // 'grammar' | 'vocabulary' | 'dictation'
  sentence_original: string
  sentence_display: string
  answer: string
  acceptable_answers_json: string
  weak_answer: string
  hint_zh: string
  explanation_zh: string
  user_answer: string
  is_correct: number | null
}

export interface PracticeSession {
  session_id: string
  essay_id: string
  mode: string            // 'cloze' | 'dictation'
  status: string          // 'in_progress' | 'completed'
  score: number
  total: number
  created_at: string
  items: PracticeItem[]
}

export interface PracticeSessionSummary {
  session_id: string
  essay_id: string
  mode: string
  status: string
  score: number
  total: number
  created_at: string
  task_type: string
  prompt: string
}

export const generatePractice = (data: { essay_id: string; mode?: string }) =>
  request<{ session_id: string; total: number; mode: string }>(
    '/practice/generate',
    { method: 'POST', body: JSON.stringify(data) },
  )

export const getPracticeSession = (sessionId: string) =>
  request<PracticeSession>(`/practice/session/${sessionId}`)

export const completePracticeSession = (
  sessionId: string,
  score: number,
  itemResults: { item_id: string; user_answer: string; is_correct: boolean }[] = [],
) =>
  request<{ ok: boolean }>(`/practice/session/${sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ score, item_results: itemResults }),
  })

export const deletePracticeSession = (sessionId: string) =>
  request<{ ok: boolean }>(`/practice/session/${sessionId}`, { method: 'DELETE' })

export interface PracticeAppealResult {
  accepted: boolean
  verdict: string
  reason_zh: string
  acceptable_answers: string[]
}

export const appealPracticeAnswer = (data: { item_id: string; user_answer: string }) =>
  request<PracticeAppealResult>('/practice/appeal', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const listPracticeSessions = (limit = 10) =>
  request<PracticeSessionSummary[]>(`/practice/sessions?limit=${limit}`)

export const getLatestPracticeForEssay = (essayId: string) =>
  request<PracticeSessionSummary | null>(`/practice/essay/${essayId}/latest`)
