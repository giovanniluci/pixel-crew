import { describe, expect, test } from 'claude-code/testing'

import type { DecideInput, Decision } from '../hooks/router'
import { agentTier, decideTier, isComplaint, isFollowUp, isShortReply, parseVerdict, ruleTier, tierOfModel } from '../hooks/router'
import { activityText, barText, spriteSvg } from '../hooks/sprite'

describe('routing rules', () => {
  test('clear light and heavy words decide without the classifier', async () => {
    expect(ruleTier('leggi il file README')?.tier).toBe('light')
    expect(ruleTier('progetta l\'architettura del backend')?.tier).toBe('heavy')
    expect(ruleTier('fai una cosa')).toBe(null)
  })

  test('keywords match whole words, not pieces of other words', async () => {
    expect(ruleTier('start the debugger please')?.tier).toBe('heavy') // "debug" starts the word
    expect(ruleTier('add a terrorist level to the game')).toBe(null) // "error" is inside a word
    expect(ruleTier('plan the release')?.tier).toBe('heavy')
    expect(ruleTier('draw a planet')).toBe(null) // "plan " must be the whole word
    expect(ruleTier('apri il progetto')?.tier).toBe('light') // "progetto" is not "progetta"
  })

  test('a negated keyword does not count', async () => {
    expect(ruleTier('mostra il log, nessun errore')?.tier).toBe('light')
    expect(ruleTier('show the log, no errors')?.tier).toBe('light')
  })

  test('a negation must be a whole word before the keyword', async () => {
    expect(ruleTier('ci sono errori nel login')?.tier).toBe('heavy') // "sono" ends in "no" but is not a negation
    expect(ruleTier('il piano debug del server')?.tier).toBe('heavy')
  })

  test('mixed signals, long messages and code go to the classifier', async () => {
    expect(ruleTier('cerca il bug nel login')).toBe(null)
    expect(ruleTier(`show this ${'x'.repeat(700)}`)).toBe(null)
    expect(ruleTier('show this:\n```ts\nconst a = 1\n```')).toBe(null)
  })

  test('empty messages and follow-ups keep the previous tier', async () => {
    expect(isFollowUp('go on!')).toBe(true)
    expect(isFollowUp('Vai')).toBe(true)
    expect(isFollowUp('vai a vedere il file')).toBe(false)
    expect(ruleTier('')).toBe(null)
  })

  test('short replies are recognised with any punctuation or emoji', async () => {
    for (const text of ['no', 'No!', 'sì', 'Si.', 'ok 👍', 'Grazie mille!!', 'thanks', 'va bene', 'ciao', 'lascia stare', 'perché?']) {
      expect(isShortReply(text)).toBe(true)
    }
    for (const text of ['no, rifai il login', 'ok ma cambia il colore', 'list files', 'vai', '']) {
      expect(isShortReply(text)).toBe(false)
    }
  })

  test('complaints are recognised', async () => {
    expect(isComplaint('non funziona ancora')).toBe(true)
    expect(isComplaint('Still broken after that')).toBe(true)
    expect(isComplaint('funziona, grazie')).toBe(false)
    expect(isComplaint('riprova il test con il file nuovo')).toBe(false)
  })

  test('the classifier answer is read in English and Italian', async () => {
    expect(parseVerdict('hard')).toBe('heavy')
    expect(parseVerdict('Facile.')).toBe('light')
    expect(parseVerdict('medium')).toBe('medium')
    expect(parseVerdict('???')).toBe(null)
  })

  test('subagents are routed by type, plugin agents included', async () => {
    expect(agentTier('Explore', 'anything').tier).toBe('light')
    expect(agentTier('feature-dev:code-explorer', 'anything').tier).toBe('light')
    expect(agentTier('Plan', 'anything').tier).toBe('heavy')
    expect(agentTier('pr-review-toolkit:code-reviewer', 'anything').tier).toBe('heavy')
    expect(agentTier('general-purpose', 'do the thing').tier).toBe('medium')
    expect(tierOfModel('claude-opus-5-5')).toBe('heavy')
  })
})

describe('deciding a turn', () => {
  const never = async (): Promise<Decision> => { throw new Error('classifier should not run') }
  const input = (fields: Partial<DecideInput>): DecideInput => ({
    text: 'fai una cosa',
    pinned: 'auto',
    lastTier: 'medium',
    keepCacheAbove: 40_000,
    contextTokens: async () => 1000,
    classify: never,
    ...fields,
  })

  test('a pinned mode wins', async () => {
    expect((await decideTier(input({ pinned: 'heavy', text: 'list files' }))).tier).toBe('heavy')
  })

  test('the classifier runs only when the rules cannot decide', async () => {
    const decision = await decideTier(input({ classify: async () => ({ tier: 'heavy', reason: { kind: 'classifier', answer: 'hard' } }) }))
    expect(decision.tier).toBe('heavy')
    expect((await decideTier(input({ text: 'list files' }))).tier).toBe('light')
  })

  test('with a long context the model does not change, up or down', async () => {
    const long = { contextTokens: async () => 100_000 }
    expect(await decideTier(input({ ...long, text: 'list files' }))).toMatchObject({ tier: 'medium', reason: { kind: 'cache', wanted: 'light' } })
    expect(await decideTier(input({ ...long, text: 'refactor the module' }))).toMatchObject({ tier: 'medium', reason: { kind: 'cache', wanted: 'heavy' } })
    expect((await decideTier(input({ ...long, keepCacheAbove: null, text: 'list files' }))).tier).toBe('light')
  })

  test('the context is not read when the model stays the same', async () => {
    const decision = await decideTier(input({ lastTier: 'light', text: 'list files', contextTokens: async () => { throw new Error('read') } }))
    expect(decision.tier).toBe('light')
  })

  test('a complaint moves one tier up, even with a long context', async () => {
    const long = { contextTokens: async () => 100_000 }
    expect(await decideTier(input({ ...long, lastTier: 'light', text: 'non funziona ancora' }))).toMatchObject({ tier: 'medium', reason: { kind: 'escalation' } })
    expect((await decideTier(input({ lastTier: 'heavy', text: 'still broken' }))).tier).toBe('heavy')
  })

  test('a short reply always goes to Haiku, even after Opus and with a long context', async () => {
    const long = { contextTokens: async () => 100_000 }
    for (const lastTier of ['light', 'medium', 'heavy'] as const) {
      for (const text of ['no', 'Sì', 'ok!', 'grazie', 'thanks 🙏']) {
        expect(await decideTier(input({ ...long, lastTier, text }))).toMatchObject({ tier: 'light', reason: { kind: 'short-reply' } })
      }
    }
  })

  test('follow-ups and empty turns keep the tier', async () => {
    expect((await decideTier(input({ lastTier: 'heavy', text: 'vai' }))).tier).toBe('heavy')
    expect((await decideTier(input({ lastTier: 'light', text: '' }))).tier).toBe('light')
  })
})

describe('drawing', () => {
  test('sprite and bars render', async () => {
    const svg = spriteSvg('#D97757', { body: '#D97757', hat: 'cap', hatColor: '#3FA66B' }, false)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(barText(50, 10)).toBe('█████░░░░░')
    expect(activityText(0)).not.toBe(activityText(2))
    expect(activityText(0).length).toBe(20)
  })
})
