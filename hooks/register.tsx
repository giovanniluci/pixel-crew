import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, TurnStepResult } from 'claude-code'

import type { Limit, Look, Looks, Member, Mode, Tier } from '../types'
import {
  CLASSIFIER_MODEL, DEFAULT_LOOKS, EFFORT, HATS, KEEP_CACHE_ABOVE_TOKENS, MODEL_LABEL, MODELS,
  PALETTE, TIER_COLOR, TIER_LABEL, USE_CLASSIFIER,
} from './config'
import type { Decision } from './router'
import { RANK, agentTier, classifierPrompt, isFollowUp, parseVerdict, ruleTier, tierOfModel } from './router'
import { barSvg, barText, limitColor, spriteSvg } from './sprite'

const PANE = 'pixel-crew'
const TIERS: Tier[] = ['light', 'medium', 'heavy']

const mode = atom({ plugin: 'pixel-crew', key: 'mode' } as const, 'auto')
const crew = atom({ plugin: 'pixel-crew', key: 'crew' } as const, [])
const limits = atom({ plugin: 'pixel-crew', key: 'limits' } as const, [])
const costUsd = atom({ plugin: 'pixel-crew', key: 'costUsd' } as const, null)
const looks = atom({ plugin: 'pixel-crew', key: 'looks' } as const, DEFAULT_LOOKS)
const isEditing = atom({ plugin: 'pixel-crew', key: 'isEditing' } as const, false)
const now = atom({ plugin: 'pixel-crew', key: 'now' } as const, 0)
const sessionStart = atom({ plugin: 'pixel-crew', key: 'sessionStart' } as const, 0)

const MODES: Mode[] = ['auto', 'light', 'medium', 'heavy']
const MODE_LABEL: Record<Mode, string> = { auto: 'Auto', light: 'Haiku', medium: 'Sonnet', heavy: 'Opus' }
const LIMIT_LABEL: Record<string, string> = {
  five_hour: 'Sessione (5 ore)',
  seven_day: 'Settimana (7 giorni)',
  spend_limit: 'Limite di spesa',
}

const toLimit = (one: SessionRateLimit): Limit => ({
  kind: one.kind,
  percentUsed: one.percentUsed,
  resetsAt: one.resetsAt ?? null,
})

const next_ = <T,>(list: readonly T[], current: T): T => list[(list.indexOf(current) + 1) % list.length] ?? current

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`

  return String(tokens)
}

function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')

  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function formatReset(iso: string | null, at: number): string {
  if (iso === null) return ''
  const ms = Date.parse(iso) - at
  if (!Number.isFinite(ms) || ms <= 0) return 'si azzera ora'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours >= 24) return `si azzera tra ${Math.floor(hours / 24)}g ${hours % 24}h`

  return `si azzera tra ${hours}h ${minutes}m`
}

function isLooks(value: unknown): value is Looks {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return typeof v.body === 'string' && TIERS.every(t => typeof v[t] === 'object' && v[t] !== null)
}

// Per-turn decisions; a reload forgets them and the next message decides again.
const decisions = new Map<string, Decision>()
let lastTier: Tier = 'medium'

async function classify($: EngineInterface, text: string): Promise<Decision> {
  if (!USE_CLASSIFIER) return { tier: 'medium', reason: 'nessuna regola: medio' }
  const reply = await $.model.complete({
    model: CLASSIFIER_MODEL,
    prompt: classifierPrompt(text),
    maxTokens: 5,
    timeoutMs: 8000,
  })
  if (!reply.isAnswered) return { tier: 'medium', reason: 'smistatore non disponibile' }
  const tier = parseVerdict(reply.text)

  return { tier: tier ?? 'medium', reason: `Haiku: ${reply.text.trim().toLowerCase() || '?'}` }
}

async function decide($: EngineInterface, text: string): Promise<Decision> {
  const pinned = await read($, mode)
  if (pinned !== 'auto') return { tier: pinned, reason: 'scelto a mano' }
  const trimmed = text.trim()
  if (trimmed === '' || isFollowUp(trimmed)) return { tier: lastTier, reason: 'continua come prima' }

  const decision = ruleTier(trimmed) ?? (await classify($, trimmed))
  if (RANK[decision.tier] < RANK[lastTier]) {
    const { context } = await $.session.usage()
    if ((context.tokens ?? 0) > KEEP_CACHE_ABOVE_TOKENS) {
      return { tier: lastTier, reason: `resto su ${MODEL_LABEL[lastTier]}: contesto lungo, la cache vale di più` }
    }
  }

  return decision
}

async function addMember($: EngineInterface, member: Member) {
  await update($, crew, list => [...list.filter(one => one.id !== member.id), member].slice(-30))
}

async function recordStep($: EngineInterface, id: string, result: TurnStepResult) {
  const usage = result.usage
  const tokens = usage === null
    ? 0
    : usage.input_tokens + usage.output_tokens
      + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
  await update($, crew, list =>
    list.map(one => (one.id === id && one.status === 'running'
      ? { ...one, tokens: one.tokens + tokens, steps: one.steps + 1 }
      : one)),
  )
}

async function finish($: EngineInterface, id: string) {
  const at = await $.clock.now()
  await update($, crew, list =>
    list.map(one => (one.id === id && one.status === 'running' ? { ...one, status: 'done' as const, endedAt: at } : one)),
  )
}

async function setMode($: EngineInterface, value: Mode) {
  await update($, mode, () => value)
  await $.store.set('mode', value)
}

async function setLooks($: EngineInterface, change: (old: Looks) => Looks) {
  const fresh = await update($, looks, change)
  await $.store.set('looks', fresh)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'crew',
      description: 'Pixel Crew: apre il riquadro o sceglie il modello (auto, haiku, sonnet, opus, reset)',
    })

    const storedMode = await $.store.get('mode')
    if (typeof storedMode === 'string' && MODES.includes(storedMode as Mode)) {
      await update($, mode, () => storedMode as Mode)
    }
    const storedLooks = await $.store.get('looks')
    if (isLooks(storedLooks)) await update($, looks, () => storedLooks)

    const usage = await $.session.usage()
    await update($, sessionStart, () => usage.startedAt)
    await update($, limits, () => usage.rateLimits.map(toLimit))
    await update($, costUsd, () => usage.cost?.usd ?? null)
    await update($, now, () => Date.now())

    // Keeps the running timers moving; local only, no tokens.
    $.clock.every(1000, async () => {
      const list = await read($, crew)
      if (list.some(one => one.status === 'running')) await update($, now, () => Date.now())
    })

    void $.ui.open({ id: PANE, title: 'Pixel Crew' })

    return next(e)
  })

  on('command.run', { command: 'crew' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const byName: Record<string, Mode> = { auto: 'auto', haiku: 'light', sonnet: 'medium', opus: 'heavy' }
    const picked = byName[arg]
    if (picked !== undefined) {
      await setMode($, picked)
      await $.ui.open({ id: PANE, title: 'Pixel Crew' })

      return { text: `Pixel Crew: modello ${MODE_LABEL[picked]}.` }
    }
    if (arg === 'reset') {
      await update($, crew, () => [])

      return { text: 'Pixel Crew: lista azzerata.' }
    }
    await $.ui.open({ id: PANE, title: 'Pixel Crew' })

    return { text: 'Pixel Crew aperto.' }
  })

  on('turn.start', async ($, e, next) => {
    const decision = await decide($, e.text)
    decisions.set(e.turnId, decision)
    lastTier = decision.tier
    const name = e.text.trim().split('\n')[0]?.slice(0, 60) || 'Continua'
    await addMember($, {
      id: e.turnId,
      name,
      tier: decision.tier,
      reason: decision.reason,
      status: 'running',
      startedAt: await $.clock.now(),
      endedAt: null,
      tokens: 0,
      steps: 0,
    })

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      // A subagent: its model was picked at agent.spawn; only count it.
      const result = yield* next(e)
      await recordStep($, e.agentId, result)

      return result
    }
    const decision = decisions.get(e.turnId)
    const routed = decision === undefined
      ? e
      : { ...e, model: MODELS[decision.tier], effort: EFFORT[decision.tier] }
    const result = yield* next(routed)
    await recordStep($, e.turnId, result)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    await finish($, e.agentId ?? e.turnId)
    if (e.agentId === undefined) decisions.delete(e.turnId)

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    if (e.workflow !== undefined) return next(e)
    const pinned = await read($, mode)
    const decision: Decision = e.model !== undefined
      ? { tier: tierOfModel(e.model), reason: 'modello chiesto da Claude' }
      : pinned !== 'auto'
        ? { tier: pinned, reason: 'scelto a mano' }
        : agentTier(e.subagentType, `${e.description} ${e.prompt}`)
    const result = e.model !== undefined ? await next(e) : await next({ ...e, model: MODELS[decision.tier] })
    if (result.agentId !== undefined) {
      await addMember($, {
        id: result.agentId,
        name: e.description || e.subagentType,
        tier: decision.tier,
        reason: decision.reason,
        status: 'running',
        startedAt: await $.clock.now(),
        endedAt: null,
        tokens: 0,
        steps: 0,
      })
    }

    return result
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits.map(toLimit))
    if (e.cost !== undefined) await update($, costUsd, () => e.cost?.usd ?? null)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const Svg = e.surface !== 'terminal' ? $.ui.resolve(e).Svg : undefined
    const list = await read($, crew)
    const windows = await read($, limits)
    const cost = await read($, costUsd)
    const look = await read($, looks)
    const editing = await read($, isEditing)
    const pinned = await read($, mode)
    const at = Math.max(await read($, now), Date.now())
    const started = await read($, sessionStart)

    const running = list.filter(one => one.status === 'running')
    const done = list.filter(one => one.status === 'done').slice(-6).reverse()
    const totalTokens = list.reduce((sum, one) => sum + one.tokens, 0)

    const sprite = (member: Member) => {
      const hatLook: Look = look[member.tier]
      if (Svg === undefined) return <Text color={TIER_COLOR[member.tier]}>▣</Text>

      return (
        <Svg
          source={spriteSvg(look.body, hatLook, member.status === 'done')}
          alt={`${MODEL_LABEL[member.tier]} pixel agent`}
          width={42}
          height={36}
        />
      )
    }

    const row = (member: Member) => {
      const elapsed = (member.endedAt ?? at) - member.startedAt

      return (
        <Box flexDirection="row" gap={1} marginBottom={1}>
          {sprite(member)}
          <Box flexDirection="column" flexGrow={1}>
            <Text bold wrap="truncate-end">{member.name}</Text>
            <Text>
              <Text color={TIER_COLOR[member.tier]}>{TIER_LABEL[member.tier]}</Text>
              <Text dimColor> {MODEL_LABEL[member.tier]} · {EFFORT[member.tier]}</Text>
              {member.status === 'done' && <Text color="#3FA66B"> ✓</Text>}
            </Text>
            <Text dimColor wrap="truncate-end">{member.reason}</Text>
            <Text dimColor>
              {member.steps} passi · {formatTokens(member.tokens)} token · {formatTime(elapsed)}
            </Text>
          </Box>
        </Box>
      )
    }

    const limitRow = (one: Limit) => {
      const color = limitColor(one.percentUsed)

      return (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            {LIMIT_LABEL[one.kind] ?? one.kind} <Text bold color={color}>{one.percentUsed}%</Text>
          </Text>
          {Svg === undefined
            ? <Text color={color}>{barText(one.percentUsed)}</Text>
            : <Svg source={barSvg(one.percentUsed, color)} alt={`${one.percentUsed}% usato`} width={240} height={8} />}
          <Text dimColor>{formatReset(one.resetsAt, at)}</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" gap={1} flexWrap="wrap" marginBottom={1}>
          {MODES.map(value => (
            <Button
              key={`mode-${value}`}
              label={MODE_LABEL[value]}
              variant={pinned === value ? 'primary' : 'secondary'}
              onPress={() => setMode($, value)}
            />
          ))}
        </Box>

        <Box flexDirection="row" gap={2} marginBottom={1}>
          <Box flexDirection="column">
            <Text dimColor>Costo</Text>
            <Text bold>{cost === null ? '—' : `≈$${cost.toFixed(2)}`}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Token</Text>
            <Text bold>{formatTokens(totalTokens)}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Tempo</Text>
            <Text bold>{started > 0 ? formatTime(at - started) : '—'}</Text>
          </Box>
        </Box>

        <Text dimColor>In corso · {running.length}</Text>
        {running.length === 0 && <Text dimColor>Nessuno al lavoro.</Text>}
        {running.map(row)}

        {done.length > 0 && <Text dimColor>Finiti · {done.length}</Text>}
        {done.map(row)}

        <Text bold>Limiti di utilizzo</Text>
        {windows.length === 0
          ? <Text dimColor>Nessuna lettura ancora (arriva dopo il primo messaggio; solo con abbonamento).</Text>
          : windows.map(limitRow)}

        <Box marginTop={1}>
          <Button
            key="edit"
            label={editing ? 'Chiudi personalizza' : 'Personalizza omini'}
            onPress={() => update($, isEditing, value => !value)}
          />
        </Box>
        {editing && (
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="row" gap={1}>
              <Text>Corpo</Text>
              <Button
                key="body"
                label={look.body}
                onPress={() => setLooks($, old => ({ ...old, body: next_(PALETTE, old.body) }))}
              />
            </Box>
            {TIERS.map(tier => (
              <Box flexDirection="row" gap={1}>
                <Text color={TIER_COLOR[tier]}>{MODEL_LABEL[tier]}</Text>
                <Button
                  key={`hat-${tier}`}
                  label={`Cappello: ${look[tier].hat}`}
                  onPress={() => setLooks($, old => ({ ...old, [tier]: { ...old[tier], hat: next_(HATS, old[tier].hat) } }))}
                />
                <Button
                  key={`color-${tier}`}
                  label={look[tier].hatColor}
                  onPress={() => setLooks($, old => ({ ...old, [tier]: { ...old[tier], hatColor: next_(PALETTE, old[tier].hatColor) } }))}
                />
              </Box>
            ))}
            <Button key="reset-looks" label="Ripristina" onPress={() => setLooks($, () => DEFAULT_LOOKS)} />
          </Box>
        )}
      </Box>
    )
  })
}
