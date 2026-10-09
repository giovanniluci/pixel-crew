// Pure routing rules: no `$`, so the tests call them directly.
import type { Mode, Reason, Tier } from '../types'
import { COMPLAINTS, FOLLOW_UPS, HEAVY_WORDS, LIGHT_WORDS, LONG_MESSAGE_CHARS, NEGATIONS, SHORT_REPLIES } from './config'

export type Decision = { tier: Tier; reason: Reason }

export const RANK: Record<Tier, number> = { light: 0, medium: 1, heavy: 2 }
const BY_RANK: Tier[] = ['light', 'medium', 'heavy']

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A keyword matches at the start of a word, so "bug" is not found inside
 * "debugger". A keyword written with a trailing space must also end the word
 * ("plan " matches "plan" but not "planet").
 */
function keywordPattern(word: string): RegExp {
  const isWhole = word.endsWith(' ')
  const body = escape(word.trim())

  return new RegExp(`(?<![\\p{L}\\p{N}])${body}${isWhole ? '(?![\\p{L}\\p{N}])' : ''}`, 'u')
}

const patterns = new Map<string, RegExp>()
const patternOf = (word: string) => {
  let found = patterns.get(word)
  if (found === undefined) {
    found = keywordPattern(word)
    patterns.set(word, found)
  }

  return found
}

// A negation is a whole word right before the keyword: "no errors", not "sono errori".
const NEGATED = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${NEGATIONS.map(escape).join('|')})\\s+$`, 'u')

/** The keywords found in the text, skipping the ones right after a negation ("no errors"). */
export function hits(text: string, words: readonly string[]): string[] {
  return words.filter(word => {
    const match = patternOf(word).exec(text)
    if (match === null) return false

    return !NEGATED.test(text.slice(Math.max(0, match.index - 16), match.index))
  })
}

// Punctuation and emoji at the end do not change what a short reply says.
const clean = (text: string) => text.toLowerCase().replace(/[\s!.?,;:…\p{Extended_Pictographic}\u200d\ufe0f]+$/gu, '').trim()

/** "no", "thanks", "ok": nothing here needs more than Haiku. */
export function isShortReply(text: string): boolean {
  return SHORT_REPLIES.includes(clean(text))
}

export function isFollowUp(text: string): boolean {
  return FOLLOW_UPS.includes(clean(text))
}

/** "It still doesn't work": the previous answer was not good enough. */
export function isComplaint(text: string): boolean {
  return hits(text.toLowerCase(), COMPLAINTS).length > 0
}

export function escalate(tier: Tier): Tier {
  return BY_RANK[Math.min(RANK[tier] + 1, BY_RANK.length - 1)] ?? 'heavy'
}

/** Long messages and code are rarely light work, whatever words they use. */
export function isBig(text: string): boolean {
  return text.length > LONG_MESSAGE_CHARS || text.includes('```')
}

/** The keyword rules: a decision when the signal is clear, null otherwise. */
export function ruleTier(text: string): Decision | null {
  const lower = text.toLowerCase()
  const heavy = hits(lower, HEAVY_WORDS)
  const light = hits(lower, LIGHT_WORDS)

  if (heavy.length > 0 && light.length === 0) {
    return { tier: 'heavy', reason: { kind: 'rule', word: heavy[0]?.trim() ?? '' } }
  }
  if (light.length > 0 && heavy.length === 0 && !isBig(text)) {
    return { tier: 'light', reason: { kind: 'rule', word: light[0]?.trim() ?? '' } }
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

export type DecideInput = {
  text: string
  pinned: Mode
  lastTier: Tier
  keepCacheAbove: number | null
  /** Asked only when the model would change, so a normal turn costs nothing. */
  contextTokens: () => Promise<number>
  classify: (text: string) => Promise<Decision>
}

/** Picks the tier of a new message. */
export async function decideTier(input: DecideInput): Promise<Decision> {
  const { pinned, lastTier } = input
  if (pinned !== 'auto') return { tier: pinned, reason: { kind: 'pinned' } }
  const text = input.text.trim()
  if (text === '' || isFollowUp(text)) return { tier: lastTier, reason: { kind: 'follow-up' } }
  // Always Haiku, even with a long context: the cache guard is about work, not "no".
  if (isShortReply(text)) return { tier: 'light', reason: { kind: 'short-reply' } }
  // The user is unhappy with the answer: one tier up, even if the cache is lost.
  if (isComplaint(text)) return { tier: escalate(lastTier), reason: { kind: 'escalation' } }

  const decision = ruleTier(text) ?? (await input.classify(text))
  // The prompt cache belongs to one model: any switch re-reads the whole
  // conversation at full price, up or down.
  if (decision.tier !== lastTier && input.keepCacheAbove !== null) {
    if ((await input.contextTokens()) > input.keepCacheAbove) {
      return { tier: lastTier, reason: { kind: 'cache', wanted: decision.tier } }
    }
  }

  return decision
}

/** Picks a subagent's tier from its type and task. */
export function agentTier(subagentType: string, task: string): Decision {
  const type = subagentType.toLowerCase()
  if (/explor|search|research/.test(type)) return { tier: 'light', reason: { kind: 'agent-type', type: subagentType } }
  if (/(^|[:_-])plan|review|architect|critic|auditor/.test(type)) {
    return { tier: 'heavy', reason: { kind: 'agent-type', type: subagentType } }
  }

  return ruleTier(task) ?? { tier: 'medium', reason: { kind: 'agent-default' } }
}

export function tierOfModel(model: string): Tier {
  if (model.includes('haiku')) return 'light'
  if (model.includes('opus')) return 'heavy'

  return 'medium'
}
