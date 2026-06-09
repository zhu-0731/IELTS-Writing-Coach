export const featureFlags = {
  cet6: import.meta.env.VITE_ENABLE_CET6 !== 'false',
} as const

const CET6_QUESTION_TYPES = new Set(['cet6_writing', 'cet6_translation'])

export function isCet6QuestionType(questionType: string): boolean {
  return CET6_QUESTION_TYPES.has(questionType)
}

export function isEnabledQuestionType(questionType: string): boolean {
  return featureFlags.cet6 || !isCet6QuestionType(questionType)
}
