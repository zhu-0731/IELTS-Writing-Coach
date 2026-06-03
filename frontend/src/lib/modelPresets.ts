export interface ModelOption {
  value: string
  label: string
  supportsVision?: boolean
}

export interface ProviderPreset {
  name: string
  match: string[]
  models: ModelOption[]
  supportsVisionDefault?: boolean
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: 'OpenAI',
    match: ['api.openai.com'],
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini（推荐）', supportsVision: true },
      { value: 'gpt-4o', label: 'GPT-4o', supportsVision: true },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', supportsVision: true },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    supportsVisionDefault: true,
  },
  {
    name: 'DeepSeek',
    match: ['api.deepseek.com'],
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek-V3（推荐）' },
      { value: 'deepseek-reasoner', label: 'DeepSeek-R1（推理）' },
      { value: 'deepseek-v4-flash', label: 'DeepSeek-V4 Flash' },
    ],
  },
  {
    name: 'Moonshot AI',
    match: ['api.moonshot.cn'],
    models: [
      { value: 'moonshot-v1-8k', label: 'Moonshot v1 8K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot v1 32K' },
      { value: 'moonshot-v1-128k', label: 'Moonshot v1 128K（推荐）' },
    ],
  },
  {
    name: '智谱 AI',
    match: ['open.bigmodel.cn'],
    models: [
      { value: 'glm-4-flash', label: 'GLM-4 Flash（免费 / 推荐）' },
      { value: 'glm-4', label: 'GLM-4' },
      { value: 'glm-4v', label: 'GLM-4V（多模态）', supportsVision: true },
      { value: 'glm-4-air', label: 'GLM-4 Air' },
    ],
    supportsVisionDefault: true,
  },
  {
    name: '阿里云百炼',
    match: ['dashscope.aliyuncs.com'],
    models: [
      { value: 'qwen-turbo', label: 'Qwen Turbo（推荐）' },
      { value: 'qwen-plus', label: 'Qwen Plus' },
      { value: 'qwen-max', label: 'Qwen Max' },
      { value: 'qwen-vl-max', label: 'Qwen VL Max（多模态）', supportsVision: true },
    ],
    supportsVisionDefault: true,
  },
  {
    name: '百度千帆',
    match: ['qianfan.baidubce.com'],
    models: [
      { value: 'ernie-speed-128k', label: 'ERNIE Speed 128K（推荐）' },
      { value: 'ernie-4.0', label: 'ERNIE 4.0' },
      { value: 'ernie-3.5', label: 'ERNIE 3.5' },
    ],
  },
  {
    name: '腾讯混元',
    match: ['hunyuan.tencentcloudapi.com'],
    models: [
      { value: 'hunyuan-lite', label: '混元 Lite（免费 / 推荐）' },
      { value: 'hunyuan-standard', label: '混元 Standard' },
      { value: 'hunyuan-pro', label: '混元 Pro' },
    ],
  },
  {
    name: '硅基流动',
    match: ['api.siliconflow.cn'],
    models: [
      { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3（推荐）' },
      { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek-R1' },
      { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5 72B' },
      { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B' },
    ],
  },
  {
    name: 'Ollama',
    match: ['localhost', '127.0.0.1', '0.0.0.0'],
    models: [
      { value: 'llama3.1', label: 'Llama 3.1' },
      { value: 'qwen2.5', label: 'Qwen 2.5' },
      { value: 'gemma2', label: 'Gemma 2' },
      { value: 'deepseek-r1', label: 'DeepSeek-R1' },
    ],
  },
]

export function detectProvider(baseUrl: string): ProviderPreset | null {
  const url = baseUrl.toLowerCase().trim()
  if (!url) return null
  return PROVIDER_PRESETS.find((p) =>
    p.match.some((m) => url.includes(m))
  ) || null
}
