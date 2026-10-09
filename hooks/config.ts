// Everything you may want to tune lives here.
import type { Hat, Looks, Settings, Tier } from '../types'

/** The model each tier runs on. */
export const MODELS: Record<Tier, string> = {
  light: 'claude-haiku-5-5',
  medium: 'claude-sonnet-5-5',
  heavy: 'claude-opus-5-5',
}

/**
 * What a subagent is started with. The Agent tool takes only these aliases
 * (a full id is refused), and each one resolves to the latest model of its family.
 */
export const AGENT_MODELS: Record<Tier, 'haiku' | 'sonnet' | 'opus'> = {
  light: 'haiku',
  medium: 'sonnet',
  heavy: 'opus',
}

/** How hard each tier thinks (ignored by models without effort). */
export const EFFORT: Record<Tier, 'low' | 'medium' | 'high'> = {
  light: 'low',
  medium: 'medium',
  heavy: 'high',
}

/** The model that sorts messages the keyword rules cannot place. */
export const CLASSIFIER_MODEL = MODELS.light

/** How long the classifier may take before the message goes to Sonnet. */
export const CLASSIFIER_TIMEOUT_MS = 2500

/** Defaults of the settings `/crew` can change. */
export const DEFAULT_SETTINGS: Settings = {
  useClassifier: true,
  // Past this many tokens of context the model is not changed: the new model
  // would re-read the whole conversation without the prompt cache.
  keepCacheAbove: 40_000,
  lang: 'en',
}

/**
 * USD per million tokens, used only to estimate the savings shown in the pane.
 * Cache writes are 1.25x input; Haiku's cache read is assumed at 0.1x input.
 */
export const PRICES: Record<Tier, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  light: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  medium: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  heavy: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
}

/** A subagent still marked as running after this long is taken to be interrupted. */
export const AGENT_STALE_MS = 15 * 60_000

/** Messages longer than this (or with code) are never sent to Haiku by a keyword alone. */
export const LONG_MESSAGE_CHARS = 600

/**
 * Keywords, lowercase. Each one matches at the start of a word ("summar"
 * matches "summarize"); one ending with a space must be the whole word.
 */
/** Light work for Haiku: looking things up, reading, listing, small chores. */
export const LIGHT_WORDS = [
  // italiano
  'leggi', 'cerca', 'trova', 'elenca', 'mostra', 'riassum', 'traduc', 'rinomina', 'apri ', 'dove ',
  'quanti', 'quante', 'cos\'è', 'che cos', 'qual è', 'quale ', 'controlla se', 'verifica se', 'conta ',
  'stampa', 'visualizza', 'dimmi', 'formatta', 'ordina', 'copia', 'sposta', 'esiste', 'versione',
  // English
  'read', 'find', 'list ', 'search', 'show', 'summar', 'translate', 'rename', 'open ', 'where',
  'what is', 'which ', 'how many', 'count ', 'print', 'display', 'tell me', 'check if', 'look up',
  'lookup', 'grep', 'locate', 'format ', 'sort ', 'copy', 'move ', 'exists', 'version',
]

/** Normal work for Sonnet: writing, adding and changing code, explaining. */
export const MEDIUM_WORDS = [
  // italiano
  'scrivi', 'aggiungi', 'modifica', 'crea', 'aggiorna', 'correggi', 'cambia', 'spiega', 'completa',
  'genera', 'documenta', 'commenta', 'converti', 'estendi', 'integra', 'configura', 'installa',
  'collega', 'test ', 'unit test', 'sostituisci', 'rimuovi', 'elimina',
  // English
  'write', 'add ', 'modify', 'create', 'update', 'fix', 'change', 'explain', 'complete', 'generate',
  'document', 'comment', 'convert', 'extend', 'integrate', 'configure', 'install', 'connect', 'edit',
  'build', 'tests', 'replace', 'remove', 'delete',
]

/** Hard work for Opus: design, deep debugging, analysis, big rewrites. */
export const HEAVY_WORDS = [
  // italiano
  'progetta', 'architett', 'refactor', 'debug', 'bug', 'perché non', 'non funziona', 'errore',
  'analizz', 'ottimizz', 'sicurezz', 'migra', 'strategi', 'pianific', 'revision', 'riscriv',
  'implementa', 'algoritm', 'ristruttur', 'rifattorizz', 'vulnerabil', 'prestazion', 'scalabil',
  'concorrenz', 'indaga', 'valuta', 'confronta', 'da zero', 'causa principale',
  // English
  'design', 'architect', 'why does', 'not working', 'error', 'analy', 'optimi', 'security', 'migrat',
  'strateg', 'plan ', 'review', 'rewrite', 'implement', 'algorithm', 'restructur', 'vulnerab',
  'performance', 'scalab', 'concurren', 'race condition', 'deadlock', 'memory leak', 'crash',
  'investigat', 'evaluat', 'compare', 'trade-off', 'tradeoff', 'from scratch', 'root cause',
  'deep dive', 'end-to-end', 'system design', 'audit',
]

/** A keyword right after one of these does not count ("nessun errore", "no errors"). */
export const NEGATIONS = ['no', 'non', 'nessun', 'nessuna', 'senza', 'without', 'zero']

/** Replies that say the last answer failed: the next turn moves one tier up. */
export const COMPLAINTS = [
  'non funziona ancora', 'ancora non funziona', 'non va ancora', 'ancora errore', 'è sbagliato',
  'non è giusto', 'non hai capito',
  'still not working', 'still doesn\'t work', 'still broken', 'still fails', 'that\'s wrong',
  'not what i asked',
]

/** Short replies that keep the previous tier. */
export const FOLLOW_UPS = [
  'vai', 'procedi', 'continua', 'avanti', 'prosegui', 'vai avanti', 'fai pure',
  'go', 'go on', 'continue', 'proceed', 'next', 'go ahead', 'do it',
]

/**
 * Short replies and pleasantries that always go to Haiku, whatever the last
 * model was: nothing in them needs a bigger one. Compared with the whole
 * message, lowercase, without final punctuation or emoji.
 */
export const SHORT_REPLIES = [
  // yes / no
  'sì', 'si', 'sì grazie', 'no', 'no grazie', 'nope', 'yes', 'yep', 'yeah', 'yup', 'sure', 'certo', 'esatto', 'giusto',
  'non so', 'forse', 'maybe', 'idk', 'boh',
  // agreement and acknowledgement
  'ok', 'okay', 'va bene', "d'accordo", 'ricevuto', 'capito', 'chiaro', 'visto', 'fine', 'got it', 'understood', 'noted', 'alright', 'all right',
  // praise and thanks
  'grazie', 'grazie mille', 'mille grazie', 'perfetto', 'ottimo', 'bene', 'benissimo', 'bravo', 'fantastico', 'top', 'splendido',
  'thanks', 'thank you', 'thx', 'ty', 'great', 'perfect', 'nice', 'cool', 'awesome', 'good', 'excellent', 'well done', 'good job',
  // greetings
  'ciao', 'salve', 'buongiorno', 'buonasera', 'buonanotte', 'a dopo', 'a presto', 'hi', 'hello', 'hey', 'bye', 'good morning', 'good night',
  // letting go
  'niente', 'nulla', 'lascia stare', 'lascia perdere', 'non importa', 'fa niente', 'stop', 'basta', 'fermati', 'aspetta', 'wait',
  'never mind', 'nevermind', 'forget it', 'skip', 'salta', 'nothing',
  // short questions
  'perché', 'perche', 'why', 'come', 'how', 'cosa', 'what', 'quando', 'when', 'chi', 'who', 'dove', 'where', 'e poi', 'and then', 'e quindi',
]

export const TIER_LABEL: Record<Tier, string> = { light: 'light', medium: 'medium', heavy: 'heavy' }

export const TIER_COLOR: Record<Tier, string> = {
  light: '#3FA66B',
  medium: '#3B82F6',
  heavy: '#E0A030',
}

export const MODEL_LABEL: Record<Tier, string> = { light: 'Haiku', medium: 'Sonnet', heavy: 'Opus' }

/** Colors offered by the customize pickers; their names are in hooks/strings.ts. */
export const PALETTE = [
  '#D97757', '#EF4444', '#EC4899', '#A855F7', '#3B82F6', '#06B6D4',
  '#3FA66B', '#E0A030', '#F2F2F2', '#9CA3AF', '#2B2B2B', '#8B5E3C',
] as const

export const HATS: Hat[] = ['none', 'cap', 'chef', 'helmet', 'crown', 'beanie']

export const DEFAULT_LOOKS: Looks = {
  light: { body: '#3FA66B', hat: 'cap', hatColor: '#F2F2F2' },
  medium: { body: '#3B82F6', hat: 'chef', hatColor: '#F2F2F2' },
  heavy: { body: '#E0A030', hat: 'helmet', hatColor: '#2B2B2B' },
}
