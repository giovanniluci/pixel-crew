/** How heavy a piece of work is: each tier runs on its own model. */
export type Tier = 'light' | 'medium' | 'heavy'

/** `auto` routes every message; a tier pins every message to it. */
export type Mode = 'auto' | Tier

export type Hat = 'none' | 'cap' | 'chef' | 'helmet' | 'crown' | 'beanie'

export type Look = { hat: Hat; hatColor: string }

export type Looks = { body: string; light: Look; medium: Look; heavy: Look }

/** One worker in the pane: the main conversation or a subagent. */
export type Member = {
  id: string
  name: string
  tier: Tier
  reason: string
  status: 'running' | 'done'
  startedAt: number
  endedAt: number | null
  tokens: number
  steps: number
}

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
      sessionStart: number
    }
  }
}
