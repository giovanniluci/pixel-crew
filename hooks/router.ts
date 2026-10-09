// Pure routing rules: no `$`, so the tests call them directly.
import type { Tier } from '../types'
import { FOLLOW_UPS, HEAVY_WORDS, LIGHT_WORDS } from './config'

export type Decision = { tier: Tier; reason: string }

export const RANK: Record<Tier, number> = { light: 0, medium: 1, heavy: 2 }

const hits = (text: string, words: readonly string[]) => words.filter(word => text.includes(word))

export function isFollowUp(text: string): boolean {
  const clean = text.toLowerCase().replace(/[!.?,\s]+$/g, '').trim()

  return FOLLOW_UPS.includes(clean)
}

/** The keyword rules: a decision when the signal is clear, null otherwise. */
export function ruleTier(text: string): Decision | null {
  const lower = text.toLowerCase()
  const heavy = hits(lower, HEAVY_WORDS)
  const light = hits(lower, LIGHT_WORDS)

  if (heavy.length > 0 && light.length === 0) {
    return { tier: 'heavy', reason: `regola: "${heavy[0]}"` }
  }
  if (light.length > 0 && heavy.length === 0 && text.length <= 600) {
    return { tier: 'light', reason: `regola: "${light[0]}"` }
  }

  return null
}

export function classifierPrompt(text: string): string {
  return [
    'Classify how hard this request is for a coding assistant.',
    'Answer with ONE word only: easy, medium or hard.',
    '',
    'Request:',
    text.slice(0, 2000),
  ].join('\n')
}

/** Reads the classifier's one-word answer (English or Italian). */
export function parseVerdict(answer: string): Tier | null {
  const word = answer.toLowerCase()
  if (/hard|difficil/.test(word)) return 'heavy'
  if (/easy|facil/.test(word)) return 'light'
  if (/medium|medi/.test(word)) return 'medium'

  return null
}

/** Picks a subagent's tier from its type and task. */
export function agentTier(subagentType: string, task: string): Decision {
  const type = subagentType.toLowerCase()
  if (type === 'explore') return { tier: 'light', reason: 'agent: ricerca' }
  if (type === 'plan' || /review|architect|critic|auditor/.test(type)) {
    return { tier: 'heavy', reason: `agent: ${subagentType}` }
  }

  return ruleTier(task) ?? { tier: 'medium', reason: 'agent: lavoro normale' }
}

export function tierOfModel(model: string): Tier {
  if (model.includes('haiku')) return 'light'
  if (model.includes('opus')) return 'heavy'

  return 'medium'
}
