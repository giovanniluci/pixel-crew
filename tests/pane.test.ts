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
    expect(await ui.find({ type: 'Text', text: /Limiti di utilizzo/ })).toBeDefined()

    await ui.press({ key: 'mode-heavy' })
    expect(await ui.find({ key: 'mode-heavy' })).toMatchObject({ props: { variant: 'primary' } })

    await ui.press({ key: 'edit' })
    await ui.press({ key: 'hat-light' })
    expect(await ui.find({ key: 'hat-light' })).toMatchObject({ props: { label: 'Cappello: chef' } })
    await ui.press({ key: 'reset-looks' })
    await ui.press({ key: 'edit' })

    await ui.press({ key: 'mode-auto' })
    await ui.unmount()
  }
})
