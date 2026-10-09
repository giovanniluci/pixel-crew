/** How heavy a piece of work is: each tier runs on its own model. */
export type Tier = 'light' | 'medium' | 'heavy'

/** `auto` routes every message; a tier pins every message to it. */
export type Mode = 'auto' | Tier

export type Lang = 'en' | 'it'

export type Hat = 'none' | 'cap' | 'chef' | 'helmet' | 'crown' | 'beanie'

export type Look = { body: string; hat: Hat; hatColor: string }

export type Looks = { light: Look; medium: Look; heavy: Look }

/** Why a tier was picked; turned into words by hooks/strings.ts in the pane's language. */
export type Reason =
  | { kind: 'rule'; word: string }
  | { kind: 'classifier'; answer: string }
  | { kind: 'classifier-off' }
  | { kind: 'classifier-failed' }
  | { kind: 'pinned' }
  | { kind: 'follow-up' }
  | { kind: 'short-reply' }
  | { kind: 'cache'; wanted: Tier }
  | { kind: 'escalation' }
  | { kind: 'agent-type'; type: string }
  | { kind: 'agent-default' }
  | { kind: 'agent-asked' }

/** One worker in the pane: the main conversation or a subagent. */
export type Member = {
  id: string
  kind: 'main' | 'agent'
  name: string
  tier: Tier
  reason: Reason
  status: 'running' | 'done'
  startedAt: number
  endedAt: number | null
  /** Tokens paid at full price: input, output and cache writes. */
  tokens: number
  /** Tokens read back from the prompt cache, about a tenth of the price. */
  cached: number
  /** Estimated cost on the model it ran on, and on Opus for the same tokens. */
  cost: number
  opusCost: number
  steps: number
}

/** Settings changed with /crew, kept across sessions. */
export type Settings = {
  useClassifier: boolean
  /** Past this many tokens of context the model is not changed; null turns the guard off. */
  keepCacheAbove: number | null
  lang: Lang
}

/** Running totals for the whole session, kept when a new command clears the crew. */
export type Spend = { cost: number; opusCost: number }

/** A usage window: `five_hour` (session) or `seven_day` (weekly). */
export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }

declare module 'claude-code' {
  interface PluginState {
    'pixel-crew': {
      mode: Mode
      crew: Member[]
      limits: Limit[]
      costUsd: number | null
      looks: Looks
      isEditing: boolean
      now: number
      commandStart: number
      settings: Settings
      spend: Spend
    }
  }
}
