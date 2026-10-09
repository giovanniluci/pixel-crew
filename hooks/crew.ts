// Pure crew helpers: no `$`, so the tests call them directly.
import type { Lang, Looks, Member, Mode, Settings, Tier } from '../types'
import { AGENT_STALE_MS, HATS, PRICES } from './config'

const TIERS: Tier[] = ['light', 'medium', 'heavy']
const HEX = /^#[0-9a-fA-F]{6}$/

/** The token counts of one model response, as the API reports them. */
export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

/** What one response adds to a worker: full-price tokens, cached tokens, and its cost here and on Opus. */
export function stepCost(tier: Tier, usage: Usage | null) {
  if (usage === null) return { tokens: 0, cached: 0, cost: 0, opusCost: 0 }
  const read = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const priced = (on: Tier) => {
    const p = PRICES[on]

    return (usage.input_tokens * p.input + usage.output_tokens * p.output + read * p.cacheRead + write * p.cacheWrite) / 1e6
  }

  return {
    tokens: usage.input_tokens + usage.output_tokens + write,
    cached: read,
    cost: priced(tier),
    opusCost: priced('heavy'),
  }
}

/** Share of the Opus cost that routing saved, 0 to 100. */
export function savedPercent(cost: number, opusCost: number): number {
  return opusCost <= 0 ? 0 : Math.max(0, Math.round((1 - cost / opusCost) * 100))
}

/** A member saved by an older version lacks fields the pane needs; those are ignored. */
export function isMember(value: unknown): value is Member {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return (v.kind === 'main' || v.kind === 'agent') && typeof v.reason === 'object' && v.reason !== null
    && ['tokens', 'cached', 'cost', 'opusCost', 'steps', 'startedAt'].every(key => typeof v[key] === 'number')
}

export const validMembers = (list: readonly unknown[]): Member[] => list.filter(isMember)

/**
 * A typed command starts a fresh crew, but subagents still working for the
 * previous one stay until they finish. A continuation keeps the whole crew.
 * A main turn still marked as running was interrupted, and so is a subagent
 * that has run for longer than AGENT_STALE_MS: both are closed.
 */
export function startTurn(list: readonly Member[], member: Member, isNewCommand: boolean, at: number): Member[] {
  const closed = validMembers(list).map(one => {
    const isStale = one.kind === 'main' || at - one.startedAt > AGENT_STALE_MS

    return one.status === 'running' && isStale ? { ...one, status: 'done' as const, endedAt: at } : one
  })
  if (isNewCommand) return [...closed.filter(one => one.kind === 'agent' && one.status === 'running'), member]

  return [...closed.filter(one => one.id !== member.id), member].slice(-30)
}

/** One operator of the crew: everything the pane shows for a tier, whatever it is doing. */
export type TierState = {
  tier: Tier
  status: 'idle' | 'working' | 'done'
  job: Member | undefined
  working: number
  steps: number
  tokens: number
  cached: number
  startedAt: number
  endedAt: number | null
}

/** Each tier works on its own: its state follows only the members that run on it. */
export function tierState(list: readonly Member[], tier: Tier): TierState {
  const mine = list.filter(one => one.tier === tier)
  const running = mine.filter(one => one.status === 'running')
  const status = mine.length === 0 ? 'idle' : running.length > 0 ? 'working' : 'done'

  return {
    tier,
    status,
    job: running.at(-1) ?? mine.at(-1),
    working: running.length,
    steps: mine.reduce((sum, one) => sum + one.steps, 0),
    tokens: mine.reduce((sum, one) => sum + one.tokens, 0),
    cached: mine.reduce((sum, one) => sum + one.cached, 0),
    startedAt: mine.length === 0 ? 0 : Math.min(...mine.map(one => one.startedAt)),
    endedAt: status === 'done' ? Math.max(...mine.map(one => one.endedAt ?? 0)) : null,
  }
}

export function isLooks(value: unknown): value is Looks {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return TIERS.every(tier => {
    const look = v[tier] as Record<string, unknown> | null | undefined
    if (typeof look !== 'object' || look === null) return false

    return HATS.includes(look.hat as never)
      && typeof look.hatColor === 'string' && HEX.test(look.hatColor)
      && typeof look.body === 'string' && HEX.test(look.body)
  })
}

/** Fills what a look saved by an older version lacks (the per-tier body) from the defaults. */
export function withDefaults(value: Looks, defaults: Looks): Looks {
  const fill = (tier: Tier) => ({ ...defaults[tier], ...value[tier] })

  return { light: fill('light'), medium: fill('medium'), heavy: fill('heavy') }
}

export function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return typeof v.useClassifier === 'boolean'
    && (v.keepCacheAbove === null || typeof v.keepCacheAbove === 'number')
    && (v.lang === 'en' || v.lang === 'it')
}

/** What a `/crew` command asks for. Only the first words count, so extra text is ignored. */
export type CrewCommand =
  | { kind: 'status' }
  | { kind: 'help' }
  | { kind: 'mode'; mode: Mode }
  | { kind: 'reset' }
  | { kind: 'classifier'; on: boolean }
  | { kind: 'cache'; above: number | null }
  | { kind: 'lang'; lang: Lang }

const MODE_WORDS: Record<string, Mode> = { auto: 'auto', haiku: 'light', sonnet: 'medium', opus: 'heavy' }

export function parseCrew(args: string): CrewCommand {
  const [first = '', second = ''] = args.trim().toLowerCase().split(/\s+/)
  const mode = MODE_WORDS[first]
  if (mode !== undefined) return { kind: 'mode', mode }
  if (first === 'reset') return { kind: 'reset' }
  if (first === 'help' || first === 'aiuto') return { kind: 'help' }
  if (first === 'classifier' && (second === 'on' || second === 'off')) return { kind: 'classifier', on: second === 'on' }
  if (first === 'cache') {
    if (second === 'off') return { kind: 'cache', above: null }
    const tokens = Number(second.replace(/[._,k]/g, '')) * (second.endsWith('k') ? 1000 : 1)
    if (Number.isFinite(tokens) && tokens > 0) return { kind: 'cache', above: Math.round(tokens) }
  }
  if (first === 'lang' && (second === 'en' || second === 'it')) return { kind: 'lang', lang: second }

  return first === '' ? { kind: 'status' } : { kind: 'help' }
}
