import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_LOOKS } from '../hooks/config'
import { isLooks, parseCrew, savedPercent, startTurn, stepCost, tierState, validMembers, withDefaults } from '../hooks/crew'
import { strings } from '../hooks/strings'
import type { Member, Reason } from '../types'

const member = (id: string, extra: Partial<Member> = {}): Member => ({
  id, kind: 'main', name: id, tier: 'medium', reason: { kind: 'follow-up' }, status: 'running',
  startedAt: 0, endedAt: null, tokens: 0, cached: 0, cost: 0, opusCost: 0, steps: 0, ...extra,
})

describe('crew', () => {
  test('a new command restarts the crew but keeps subagents still working', () => {
    const old = [
      member('a', { status: 'done' }),
      member('b', { kind: 'agent', tier: 'light' }),
      member('c', { kind: 'agent', status: 'done' }),
    ]
    expect(startTurn(old, member('d'), true, 5).map(one => one.id)).toEqual(['b', 'd'])
    expect(startTurn(old, member('d'), false, 5).map(one => one.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  test('a subagent that ran for too long is taken to be interrupted', () => {
    const stale = member('s', { kind: 'agent', startedAt: 0 })
    const fresh = member('f', { kind: 'agent', startedAt: 20 * 60_000 })
    const next = startTurn([stale, fresh], member('n'), true, 21 * 60_000)
    expect(next.map(one => one.id)).toEqual(['f', 'n'])
  })

  test('members saved by an older version are ignored', () => {
    const old = { id: 'x', name: 'x', tier: 'light', reason: 'regola: "find"', status: 'running', startedAt: 0, endedAt: null, tokens: 5, steps: 1 }
    expect(validMembers([old, member('ok')]).map(one => one.id)).toEqual(['ok'])
    expect(startTurn([old as never], member('n'), false, 1).map(one => one.id)).toEqual(['n'])
  })

  test('an interrupted main turn is closed when the next one starts', () => {
    const list = startTurn([member('a')], member('b'), false, 9)
    expect(list[0]).toMatchObject({ id: 'a', status: 'done', endedAt: 9 })
  })

  test('each tier has its own state', () => {
    const list = [
      member('a', { tier: 'light', status: 'done', steps: 3 }),
      member('b', { tier: 'heavy', steps: 2, cached: 10 }),
      member('c', { tier: 'heavy', steps: 8, cached: 5 }),
    ]
    expect(tierState(list, 'light')).toMatchObject({ status: 'done', steps: 3 })
    expect(tierState(list, 'medium')).toMatchObject({ status: 'idle', job: undefined })
    expect(tierState(list, 'heavy')).toMatchObject({ status: 'working', working: 2, steps: 10, cached: 15 })
  })
})

describe('cost', () => {
  test('cached tokens are counted apart and cost less', () => {
    const step = stepCost('medium', { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 0 })
    expect(step.tokens).toBe(1500)
    expect(step.cached).toBe(100_000)
    expect(Math.round(step.cost * 1e6)).toBe(1000 * 2 + 500 * 10 + 100_000 * 0.2)
    expect(step.opusCost).toBeGreaterThan(step.cost)
  })

  test('the saving is measured against Opus', () => {
    const step = stepCost('light', { input_tokens: 1000, output_tokens: 1000 })
    expect(savedPercent(step.cost, step.opusCost)).toBe(98)
    expect(savedPercent(0, 0)).toBe(0)
    expect(stepCost('heavy', null)).toEqual({ tokens: 0, cached: 0, cost: 0, opusCost: 0 })
  })
})

describe('/crew', () => {
  test('only the first words count', () => {
    expect(parseCrew('opus altro che modificheresti?')).toEqual({ kind: 'mode', mode: 'heavy' })
    expect(parseCrew('  AUTO ')).toEqual({ kind: 'mode', mode: 'auto' })
    expect(parseCrew('')).toEqual({ kind: 'status' })
    expect(parseCrew('boh')).toEqual({ kind: 'help' })
  })

  test('settings', () => {
    expect(parseCrew('classifier off')).toEqual({ kind: 'classifier', on: false })
    expect(parseCrew('cache 60k')).toEqual({ kind: 'cache', above: 60_000 })
    expect(parseCrew('cache 80.000')).toEqual({ kind: 'cache', above: 80_000 })
    expect(parseCrew('cache off')).toEqual({ kind: 'cache', above: null })
    expect(parseCrew('cache lots')).toEqual({ kind: 'help' })
    expect(parseCrew('lang it')).toEqual({ kind: 'lang', lang: 'it' })
  })
})

describe('looks and words', () => {
  test('a saved look is checked before it is used', () => {
    expect(isLooks(DEFAULT_LOOKS)).toBe(true)
    expect(isLooks({ ...DEFAULT_LOOKS, light: { ...DEFAULT_LOOKS.light, body: 'red' } })).toBe(false)
    expect(isLooks({ ...DEFAULT_LOOKS, light: { body: '#FFFFFF', hat: 'sombrero', hatColor: '#FFFFFF' } })).toBe(false)
    expect(isLooks(null)).toBe(false)
  })

  test('a look saved without a body gets the default one', () => {
    const old = { light: { hat: 'cap', hatColor: '#FFFFFF' }, medium: DEFAULT_LOOKS.medium, heavy: DEFAULT_LOOKS.heavy }
    const fixed = withDefaults(old as never, DEFAULT_LOOKS)
    expect(fixed.light.body).toBe(DEFAULT_LOOKS.light.body)
    expect(fixed.light.hat).toBe('cap')
  })

  test('every reason has words in both languages', () => {
    const reasons: Reason[] = [
      { kind: 'rule', word: 'read' }, { kind: 'classifier', answer: 'hard' }, { kind: 'classifier-off' },
      { kind: 'classifier-failed' }, { kind: 'pinned' }, { kind: 'follow-up' }, { kind: 'short-reply' }, { kind: 'cache', wanted: 'light' },
      { kind: 'escalation' }, { kind: 'agent-type', type: 'Explore' }, { kind: 'agent-default' }, { kind: 'agent-asked' },
    ]
    for (const lang of ['en', 'it'] as const) {
      for (const reason of reasons) expect(strings(lang).reason(reason).length).toBeGreaterThan(0)
      expect(strings(lang).colors.length).toBe(12)
    }
  })
})
