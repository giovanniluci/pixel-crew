import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, TurnStepResult } from 'claude-code'

import type { Hat, Limit, Looks, Member, Mode, Settings, Tier } from '../types'
import {
  AGENT_MODELS, CLASSIFIER_MODEL, CLASSIFIER_TIMEOUT_MS, DEFAULT_LOOKS, DEFAULT_SETTINGS, EFFORT, HATS, MODEL_LABEL, MODELS,
  TIER_COLOR, TIER_LABEL,
} from './config'
import type { CrewCommand } from './crew'
import { isLooks, isSettings, parseCrew, savedPercent, startTurn, stepCost, tierState, validMembers, withDefaults } from './crew'
import type { Decision } from './router'
import { agentTier, classifierPrompt, decideTier, parseVerdict, tierOfModel } from './router'
import { activitySvg, activityText, barSvg, barText, limitColor, spriteSvg } from './sprite'
import { colorOptions, hatOptions, strings, systemLang } from './strings'

const PANE = 'pixel-crew'
const TIERS: Tier[] = ['light', 'medium', 'heavy']
const MODES: Mode[] = ['auto', 'light', 'medium', 'heavy']
const MODE_LABEL: Record<Mode, string> = { auto: 'Auto', ...MODEL_LABEL }

const mode = atom({ plugin: 'pixel-crew', key: 'mode' } as const, 'auto')
const crew = atom({ plugin: 'pixel-crew', key: 'crew' } as const, [])
const limits = atom({ plugin: 'pixel-crew', key: 'limits' } as const, [])
const costUsd = atom({ plugin: 'pixel-crew', key: 'costUsd' } as const, null)
const looks = atom({ plugin: 'pixel-crew', key: 'looks' } as const, DEFAULT_LOOKS)
const isEditing = atom({ plugin: 'pixel-crew', key: 'isEditing' } as const, false)
const now = atom({ plugin: 'pixel-crew', key: 'now' } as const, 0)
const commandStart = atom({ plugin: 'pixel-crew', key: 'commandStart' } as const, 0)
const settings = atom({ plugin: 'pixel-crew', key: 'settings' } as const, DEFAULT_SETTINGS)
const spend = atom({ plugin: 'pixel-crew', key: 'spend' } as const, { cost: 0, opusCost: 0 })

const toLimit = (one: SessionRateLimit): Limit => ({
  kind: one.kind,
  percentUsed: one.percentUsed,
  resetsAt: one.resetsAt ?? null,
})

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`

  return String(tokens)
}

const formatUsd = (usd: number) => `≈$${usd < 0.01 && usd > 0 ? usd.toFixed(3) : usd.toFixed(2)}`

function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')

  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function formatReset(iso: string | null, at: number, t: ReturnType<typeof strings>): string {
  if (iso === null) return ''
  const ms = Date.parse(iso) - at
  if (!Number.isFinite(ms) || ms <= 0) return t.resetsNow
  const hours = Math.floor(ms / 3_600_000)

  return t.resetsIn(Math.floor(hours / 24), hours >= 24 ? hours % 24 : hours, Math.floor((ms % 3_600_000) / 60_000))
}

// The main turn's decision; only one main turn runs at a time, so a new one replaces it.
let current: { turnId: string; decision: Decision } | null = null
let lastTier: Tier = 'medium'

async function classify($: EngineInterface, text: string, useClassifier: boolean): Promise<Decision> {
  if (!useClassifier) return { tier: 'medium', reason: { kind: 'classifier-off' } }
  const reply = await $.model.complete({
    model: CLASSIFIER_MODEL,
    prompt: classifierPrompt(text),
    maxTokens: 5,
    timeoutMs: CLASSIFIER_TIMEOUT_MS,
  }).catch(() => undefined)
  if (reply === undefined || !reply.isAnswered) return { tier: 'medium', reason: { kind: 'classifier-failed' } }
  const tier = parseVerdict(reply.text)
  if (tier === null) return { tier: 'medium', reason: { kind: 'classifier-failed' } }

  return { tier, reason: { kind: 'classifier', answer: reply.text.trim().toLowerCase() } }
}

async function addMember($: EngineInterface, member: Member) {
  await update($, crew, list => [...list.filter(one => one.id !== member.id), member].slice(-30))
}

async function recordStep($: EngineInterface, id: string, result: TurnStepResult) {
  const list = validMembers(await read($, crew))
  const member = list.find(one => one.id === id && one.status === 'running')
  if (member === undefined) return
  const step = stepCost(member.tier, result.usage)
  await update($, crew, all =>
    all.map(one => (one.id === id
      ? {
          ...one,
          steps: one.steps + 1,
          tokens: one.tokens + step.tokens,
          cached: one.cached + step.cached,
          cost: one.cost + step.cost,
          opusCost: one.opusCost + step.opusCost,
        }
      : one)),
  )
  await update($, spend, old => ({ cost: old.cost + step.cost, opusCost: old.opusCost + step.opusCost }))
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

async function setSettings($: EngineInterface, change: (old: Settings) => Settings) {
  const fresh = await update($, settings, change)
  await $.store.set('settings', fresh)

  return fresh
}

async function setLooks($: EngineInterface, change: (old: Looks) => Looks) {
  const fresh = await update($, looks, old => change(withDefaults(old, DEFAULT_LOOKS)))
  await $.store.set('looks', fresh)
}

const newMember = (fields: Pick<Member, 'id' | 'kind' | 'name' | 'tier' | 'reason' | 'startedAt'>): Member => ({
  ...fields,
  status: 'running',
  endedAt: null,
  tokens: 0,
  cached: 0,
  cost: 0,
  opusCost: 0,
  steps: 0,
})

async function runCrew($: EngineInterface, command: CrewCommand) {
  const t = strings((await read($, settings)).lang)
  switch (command.kind) {
    case 'mode':
      await setMode($, command.mode)
      await $.ui.open({ id: PANE, title: 'Pixel Crew' })

      return { text: t.modeSet(command.mode) }
    case 'reset':
      await update($, crew, () => [])

      return { text: t.cleared }
    case 'classifier':
      await setSettings($, old => ({ ...old, useClassifier: command.on }))

      return { text: t.classifierSet(command.on) }
    case 'cache':
      await setSettings($, old => ({ ...old, keepCacheAbove: command.above }))

      return { text: t.cacheSet(command.above) }
    case 'lang':
      await setSettings($, old => ({ ...old, lang: command.lang }))

      return { text: strings(command.lang).langSet }
    case 'help':
      return { text: t.help }
    case 'status':
      await $.ui.open({ id: PANE, title: 'Pixel Crew' })

      return { text: `${t.status(await read($, mode), await read($, settings))}\n\n${t.help}` }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const description = strings('en')
    await $.command.register({ name: 'crew', description: description.commandDescription })
    for (const [name, label] of [['crew-auto', 'Auto'],['crew-haiku', 'Haiku'], ['crew-sonnet', 'Sonnet'], ['crew-opus', 'Opus']] as const) {
      await $.command.register({ name, description: `Pixel Crew: ${label}` })
    }

    const storedMode = await $.store.get('mode')
    if (typeof storedMode === 'string' && MODES.includes(storedMode as Mode)) {
      await update($, mode, () => storedMode as Mode)
    }
    const storedLooks = await $.store.get('looks')
    if (isLooks(storedLooks)) await update($, looks, () => storedLooks)
    const storedSettings = await $.store.get('settings')
    await update($, settings, () => (isSettings(storedSettings) ? storedSettings : { ...DEFAULT_SETTINGS, lang: systemLang() }))

    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits.map(toLimit))
    await update($, costUsd, () => usage.cost?.usd ?? null)
    await update($, now, () => Date.now())

    // Keeps the running timers and bars moving; local only, no tokens.
    $.clock.every(1000, async () => {
      const list = await read($, crew)
      if (list.some(one => one.status === 'running')) await update($, now, () => Date.now())
    })

    void $.ui.open({ id: PANE, title: 'Pixel Crew' })

    return next(e)
  })

  on('command.run', { command: 'crew' }, ($, e) => runCrew($, parseCrew(e.args)))
  // One command per model; extra words after them are ignored.
  on('command.run', { command: 'crew-auto' }, $ => runCrew($, { kind: 'mode', mode: 'auto' }))
  on('command.run', { command: 'crew-haiku' }, $ => runCrew($, { kind: 'mode', mode: 'light' }))
  on('command.run', { command: 'crew-sonnet' }, $ => runCrew($, { kind: 'mode', mode: 'medium' }))
  on('command.run', { command: 'crew-opus' }, $ => runCrew($, { kind: 'mode', mode: 'heavy' }))

  on('turn.start', async ($, e, next) => {
    const options = await read($, settings)
    const decision = await decideTier({
      text: e.text,
      pinned: await read($, mode),
      lastTier,
      keepCacheAbove: options.keepCacheAbove,
      contextTokens: async () => (await $.session.usage()).context.tokens ?? 0,
      classify: text => classify($, text, options.useClassifier),
    })
    current = { turnId: e.turnId, decision }
    lastTier = decision.tier
    const startedAt = await $.clock.now()
    const member = newMember({
      id: e.turnId,
      kind: 'main',
      name: e.text.trim().split('\n')[0]?.slice(0, 60) || '…',
      tier: decision.tier,
      reason: decision.reason,
      startedAt,
    })
    // A typed command starts a fresh crew, so every bar restarts.
    const isNewCommand = e.text.trim() !== ''
    await update($, crew, list => startTurn(list, member, isNewCommand, startedAt))
    if (isNewCommand) await update($, commandStart, () => startedAt)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      // A subagent: its model was picked at agent.spawn; only count it.
      const result = yield* next(e)
      await recordStep($, e.agentId, result)

      return result
    }
    const decision = current?.turnId === e.turnId ? current.decision : undefined
    const routed = decision === undefined
      ? e
      : { ...e, model: MODELS[decision.tier], effort: EFFORT[decision.tier] }
    const result = yield* next(routed)
    await recordStep($, e.turnId, result)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    await finish($, e.agentId ?? e.turnId)
    if (e.agentId === undefined && current?.turnId === e.turnId) current = null

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    if (e.workflow !== undefined) return next(e)
    const pinned = await read($, mode)
    const decision: Decision = e.model !== undefined
      ? { tier: tierOfModel(e.model), reason: { kind: 'agent-asked' } }
      : pinned !== 'auto'
        ? { tier: pinned, reason: { kind: 'pinned' } }
        : agentTier(e.subagentType, `${e.description} ${e.prompt}`)
    const result = e.model !== undefined ? await next(e) : await next({ ...e, model: AGENT_MODELS[decision.tier] })
    if (result.agentId !== undefined) {
      await addMember($, newMember({
        id: result.agentId,
        kind: 'agent',
        name: e.description || e.subagentType,
        tier: decision.tier,
        reason: decision.reason,
        startedAt: await $.clock.now(),
      }))
    }

    return result
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits.map(toLimit))
    if (e.cost !== undefined) await update($, costUsd, () => e.cost?.usd ?? null)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    const Svg = e.surface !== 'terminal' ? $.ui.resolve(e).Svg : undefined
    const list = validMembers(await read($, crew))
    const windows = await read($, limits)
    const sessionCost = await read($, costUsd)
    const totals = await read($, spend)
    const look = withDefaults(await read($, looks), DEFAULT_LOOKS)
    const editing = await read($, isEditing)
    const pinned = await read($, mode)
    const { lang } = await read($, settings)
    const t = strings(lang)
    const at = Math.max(await read($, now), Date.now())
    const tick = Math.floor(at / 1000)
    const commandAt = await read($, commandStart)

    const isWorking = list.some(one => one.status === 'running')
    const commandCost = list.reduce((sum, one) => sum + one.cost, 0)
    const commandTokens = list.reduce((sum, one) => sum + one.tokens, 0)
    const lastEnd = Math.max(0, ...list.map(one => one.endedAt ?? 0))
    const commandTime = commandAt > 0 ? (isWorking ? at : lastEnd || at) - commandAt : 0
    const doneCount = list.filter(one => one.status === 'done').length
    const title = list.find(one => one.kind === 'main')?.name ?? 'Pixel Crew'

    const sprite = (tier: Tier, isDim: boolean) => {
      if (Svg === undefined) return <Text color={TIER_COLOR[tier]} dimColor={isDim}>▣</Text>

      return (
        <Svg
          source={spriteSvg(look[tier].body, look[tier], isDim)}
          alt={`${MODEL_LABEL[tier]} pixel agent`}
          width={42}
          height={36}
        />
      )
    }

    // Full when done, empty when idle, a sliding block while working: the
    // number of steps left is unknown, so no percentage is made up.
    const bar = (key: string, status: 'idle' | 'working' | 'done', color: string) => {
      if (Svg === undefined) {
        const text = status === 'working' ? activityText(tick) : barText(status === 'done' ? 100 : 0)

        return <Text key={key} color={color}>{text}</Text>
      }
      const source = status === 'working' ? activitySvg(tick, color, 260) : barSvg(status === 'done' ? 100 : 0, color, 260)

      return <Svg key={key} source={source} alt={status} width={260} height={8} />
    }

    // The three operators are always on screen, each with its own bar.
    const operator = (tier: Tier) => {
      const state = tierState(list, tier)
      const job = state.job
      const elapsed = state.startedAt === 0 ? 0 : (state.endedAt ?? at) - state.startedAt
      const marker = state.status === 'working' ? '●' : state.status === 'done' ? '✓' : ''

      return (
        <Box key={`operator-${tier}`} flexDirection="row" gap={1} marginBottom={1}>
          {sprite(tier, state.status === 'idle')}
          <Box flexDirection="column" flexGrow={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold dimColor={state.status === 'idle'} wrap="truncate-end">
                {job === undefined ? `${MODEL_LABEL[tier]} · ${t.waiting}` : job.name}
              </Text>
              <Text color={state.status === 'done' ? '#3FA66B' : TIER_COLOR[tier]}>{marker}</Text>
            </Box>
            <Text>
              <Text color={TIER_COLOR[tier]}>{TIER_LABEL[tier]}</Text>
              <Text dimColor> {MODEL_LABEL[tier]} · {EFFORT[tier]}</Text>
              {state.working > 1 && <Text dimColor> · {t.jobs(state.working)}</Text>}
            </Text>
            {job !== undefined && <Text dimColor wrap="truncate-end">{t.reason(job.reason)}</Text>}
            {job !== undefined && (
              <Text dimColor>
                {state.steps} {t.steps} · {formatTokens(state.tokens)} {t.tokens} · {formatTokens(state.cached)} {t.cached} · {formatTime(elapsed)}
              </Text>
            )}
            {bar(`bar-${tier}`, state.status, TIER_COLOR[tier])}
          </Box>
        </Box>
      )
    }

    const limitRow = (one: Limit) => {
      const color = limitColor(one.percentUsed)

      return (
        <Box key={`limit-${one.kind}`} flexDirection="column" marginBottom={1}>
          <Text>
            {t.limitLabel[one.kind] ?? one.kind} <Text bold color={color}>{one.percentUsed}%</Text>
          </Text>
          {Svg === undefined
            ? <Text color={color}>{barText(one.percentUsed)}</Text>
            : <Svg source={barSvg(one.percentUsed, color)} alt={`${one.percentUsed}%`} width={240} height={8} />}
          <Text dimColor>{formatReset(one.resetsAt, at, t)}</Text>
        </Box>
      )
    }

    const card = (label: string, value: string) => (
      <Box key={`card-${label}`} flexDirection="column" flexGrow={1} borderStyle="round" paddingX={1}>
        <Text dimColor>{label}</Text>
        <Text bold>{value}</Text>
      </Box>
    )

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

        <Text bold wrap="truncate-end">{title}</Text>
        <Box flexDirection="row" gap={1}>
          {card(t.commandCost, list.length > 0 ? formatUsd(commandCost) : '—')}
          {card(t.commandTokens, formatTokens(commandTokens))}
          {card(t.commandTime, commandAt > 0 ? formatTime(commandTime) : '—')}
        </Box>
        <Box marginBottom={1}>
          <Text dimColor wrap="wrap">
            {t.session}: {sessionCost === null ? formatUsd(totals.cost) : formatUsd(sessionCost)}
            {totals.opusCost > 0 && ` · ${t.saved(formatUsd(totals.opusCost - totals.cost), savedPercent(totals.cost, totals.opusCost))}`}
          </Text>
        </Box>

        <Text dimColor>
          {t.crew} · {isWorking ? t.crewDone(doneCount, list.length) : list.length > 0 ? t.crewAllDone : t.crewIdle}
        </Text>
        {TIERS.map(operator)}

        <Text bold>{t.limits}</Text>
        {windows.length === 0 ? <Text dimColor>{t.noLimits}</Text> : windows.map(limitRow)}

        <Box marginTop={1}>
          <Button
            key="edit"
            label={editing ? t.closeCustomize : t.customize}
            onPress={() => update($, isEditing, value => !value)}
          />
        </Box>
        {editing && (
          <Box flexDirection="column" marginTop={1} gap={1}>
            {TIERS.map(tier => (
              <Box key={`look-${tier}`} flexDirection="row" gap={1} alignItems="center">
                {sprite(tier, false)}
                <Box flexDirection="column" flexGrow={1}>
                  <Text color={TIER_COLOR[tier]}>{MODEL_LABEL[tier]}</Text>
                  <Select
                    key={`body-${tier}`}
                    label={t.body}
                    options={colorOptions(lang)}
                    value={look[tier].body}
                    onSelect={value => setLooks($, old => ({ ...old, [tier]: { ...old[tier], body: value } }))}
                  />
                  <Select
                    key={`hat-${tier}`}
                    label={t.hat}
                    options={hatOptions(lang, HATS)}
                    value={look[tier].hat}
                    onSelect={value => setLooks($, old => ({ ...old, [tier]: { ...old[tier], hat: value as Hat } }))}
                  />
                  <Select
                    key={`color-${tier}`}
                    label={t.hatColor}
                    options={colorOptions(lang)}
                    value={look[tier].hatColor}
                    onSelect={value => setLooks($, old => ({ ...old, [tier]: { ...old[tier], hatColor: value } }))}
                  />
                </Box>
              </Box>
            ))}
            <Button key="reset-looks" label={t.restore} onPress={() => setLooks($, () => DEFAULT_LOOKS)} />
          </Box>
        )}
      </Box>
    )
  })
}
