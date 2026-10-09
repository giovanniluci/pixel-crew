import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'pixel-crew',
  component: 'Pane',
  requestId: 'pixel-crew',
  props: { title: 'Pixel Crew', isFocused: false, bodyColumns: 48, placement: 'dock' },
} as const

test('the pane draws and its buttons work on every surface', async ($, on) => {
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, props: PANE.props as never })
    expect(await ui.find({ type: 'Text', text: /Usage limits|Limiti di utilizzo/ })).toBeDefined()
    // The three operators are on screen even with no work.
    for (const name of ['Haiku', 'Sonnet', 'Opus']) {
      expect(await ui.find({ type: 'Text', text: new RegExp(`${name} · (waiting|in attesa)`) })).toBeDefined()
    }

    await ui.press({ key: 'mode-heavy' })
    expect(await ui.find({ key: 'mode-heavy' })).toMatchObject({ props: { variant: 'primary' } })

    await ui.press({ key: 'edit' })
    await ui.select({ key: 'hat-light', value: 'crown' })
    expect(await ui.find({ key: 'hat-light' })).toMatchObject({ props: { value: 'crown' } })
    await ui.select({ key: 'color-heavy', value: '#A855F7' })
    expect(await ui.find({ key: 'color-heavy' })).toMatchObject({ props: { value: '#A855F7' } })
    await ui.select({ key: 'body-light', value: '#A855F7' })
    expect(await ui.find({ key: 'body-light' })).toMatchObject({ props: { value: '#A855F7' } })
    await ui.press({ key: 'reset-looks' })
    expect(await ui.find({ key: 'hat-light' })).toMatchObject({ props: { value: 'cap' } })
    await ui.press({ key: 'edit' })

    await ui.press({ key: 'mode-auto' })
    await ui.unmount()
  }
})
