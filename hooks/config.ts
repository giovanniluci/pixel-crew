// Everything you may want to tune lives here.
import type { Hat, Looks, Tier } from '../types'

/** The model each tier runs on. */
export const MODELS: Record<Tier, string> = {
  light: 'claude-haiku-5-5',
  medium: 'claude-sonnet-5-5',
  heavy: 'claude-opus-5-5',
}

/** How hard each tier thinks (ignored by models without effort). */
export const EFFORT: Record<Tier, 'low' | 'medium' | 'high'> = {
  light: 'low',
  medium: 'medium',
  heavy: 'high',
}

/** The model that sorts messages the keyword rules cannot place. */
export const CLASSIFIER_MODEL = MODELS.light

/** Set to false to use the keyword rules alone (zero extra tokens). */
export const USE_CLASSIFIER = true

/**
 * Past this many tokens of context, never step DOWN to a cheaper model:
 * the new model would re-read the whole conversation without the prompt
 * cache, which costs more than staying.
 */
export const KEEP_CACHE_ABOVE_TOKENS = 40_000

/** Words that mark a message as light work (lowercase, matched as prefixes). */
export const LIGHT_WORDS = [
  'leggi', 'cerca', 'trova', 'elenca', 'lista', 'mostra', 'riassum', 'traduc',
  'rinomina', 'apri', 'dove', 'quant', 'cos\'è', 'che cos', 'controlla se',
  'read', 'find', 'list', 'search', 'show', 'summar', 'translate', 'rename',
  'open', 'where', 'what is', 'how many',
]

/** Words that mark a message as heavy work. */
export const HEAVY_WORDS = [
  'progett', 'architett', 'refactor', 'debug', 'bug', 'perché non', 'non funziona',
  'errore', 'analizz', 'ottimizz', 'sicurezz', 'migra', 'strategi', 'pianific',
  'revision', 'riscriv', 'implementa', 'algoritm',
  'design', 'architect', 'why does', 'not working', 'error', 'analy', 'optimi',
  'security', 'migrat', 'strateg', 'plan ', 'review', 'rewrite', 'implement', 'algorithm',
]

/** Short replies that keep the previous tier. */
export const FOLLOW_UPS = [
  'ok', 'okay', 'sì', 'si', 'vai', 'procedi', 'continua', 'perfetto', 'grazie',
  'yes', 'go', 'go on', 'continue', 'proceed', 'thanks', 'next',
]

export const TIER_LABEL: Record<Tier, string> = { light: 'light', medium: 'medium', heavy: 'heavy' }

export const TIER_COLOR: Record<Tier, string> = {
  light: '#3FA66B',
  medium: '#3B82F6',
  heavy: '#E0A030',
}

export const MODEL_LABEL: Record<Tier, string> = { light: 'Haiku', medium: 'Sonnet', heavy: 'Opus' }

/** Colors the customize buttons cycle through. */
export const PALETTE = [
  '#D97757', '#3FA66B', '#3B82F6', '#E0A030', '#F2F2F2', '#A855F7', '#EF4444', '#2B2B2B',
]

export const HATS: Hat[] = ['none', 'cap', 'chef', 'helmet', 'crown', 'beanie']

export const DEFAULT_LOOKS: Looks = {
  body: '#D97757',
  light: { hat: 'cap', hatColor: '#3FA66B' },
  medium: { hat: 'chef', hatColor: '#F2F2F2' },
  heavy: { hat: 'helmet', hatColor: '#E0A030' },
}
