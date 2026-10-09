import { describe, expect, test } from 'claude-code/testing'

import { agentTier, isFollowUp, parseVerdict, ruleTier, tierOfModel } from '../hooks/router'
import { barText, spriteSvg } from '../hooks/sprite'

describe('routing rules', () => {
  test('clear light and heavy words decide without the classifier', async () => {
    expect(ruleTier('leggi il file README')?.tier).toBe('light')
    expect(ruleTier('progetta l\'architettura del backend')?.tier).toBe('heavy')
    expect(ruleTier('fai una cosa')).toBe(null)
  })

  test('mixed signals go to the classifier', async () => {
    expect(ruleTier('cerca il bug nel login')).toBe(null)
  })

  test('follow-ups keep the previous tier', async () => {
    expect(isFollowUp('ok!')).toBe(true)
    expect(isFollowUp('Vai')).toBe(true)
    expect(isFollowUp('vai a vedere il file')).toBe(false)
  })

  test('the classifier answer is read in English and Italian', async () => {
    expect(parseVerdict('hard')).toBe('heavy')
    expect(parseVerdict('Facile.')).toBe('light')
    expect(parseVerdict('medium')).toBe('medium')
    expect(parseVerdict('???')).toBe(null)
  })

  test('subagents are routed by type', async () => {
    expect(agentTier('Explore', 'anything').tier).toBe('light')
    expect(agentTier('Plan', 'anything').tier).toBe('heavy')
    expect(agentTier('general-purpose', 'do the thing').tier).toBe('medium')
    expect(tierOfModel('claude-opus-5-5')).toBe('heavy')
  })
})

describe('drawing', () => {
  test('sprite and bars render', async () => {
    const svg = spriteSvg('#D97757', { hat: 'cap', hatColor: '#3FA66B' }, false)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(barText(50, 10)).toBe('█████░░░░░')
  })
})
