// Pixel art as SVG strings: drawn locally by the app, never sent to a model.
import type { Hat, Look } from '../types'

// 14 x 12 grid. H = hat, h = hat shade, B = body, E = eye.
const HAT_ROWS: Record<Hat, string[]> = {
  none: ['..............', '..............', '..............', '..............'],
  cap: ['..............', '....HHHHHH....', '...HHHHHHHH...', '...HHHHHHHHhhh'],
  chef: ['....HHHHHH....', '...HHHHHHHH...', '....HHHHHH....', '...hhhhhhhh...'],
  helmet: ['..............', '....HHHHHH....', '...HHHHHHHH...', '..hhhhhhhhhh..'],
  crown: ['..............', '...H..HH..H...', '...HHHHHHHH...', '...HHHHHHHH...'],
  beanie: ['......H.......', '....HHHHHH....', '...HHHHHHHH...', '...hhhhhhhh...'],
}

const BODY_ROWS = [
  '..BBBBBBBBBB..',
  '..BBBBBBBBBB..',
  'BBBEBBBBBBEBBB',
  'BBBEBBBBBBEBBB',
  '..BBBBBBBBBB..',
  '..BBBBBBBBBB..',
  '..B.B....B.B..',
  '..B.B....B.B..',
]

export function shade(hex: string, amount = 0.25): string {
  const value = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return hex
  const channel = (i: number) => {
    const c = Math.round(parseInt(value.slice(i, i + 2), 16) * (1 - amount))

    return Math.max(0, c).toString(16).padStart(2, '0')
  }

  return `#${channel(0)}${channel(2)}${channel(4)}`
}

export function spriteSvg(body: string, look: Look, isDone: boolean, scale = 3): string {
  const colors: Record<string, string> = {
    H: look.hatColor,
    h: shade(look.hatColor),
    B: body,
    E: '#1A1A1A',
  }
  const rows = [...HAT_ROWS[look.hat], ...BODY_ROWS]
  const rects: string[] = []
  rows.forEach((row, y) => {
    ;[...row].forEach((cell, x) => {
      const fill = colors[cell]
      if (fill) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`)
    })
  })
  const width = 14 * scale
  const height = rows.length * scale
  const opacity = isDone ? ' opacity="0.75"' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 ${rows.length}" width="${width}" height="${height}" shape-rendering="crispEdges"${opacity}>${rects.join('')}</svg>`
}

export function limitColor(percent: number): string {
  if (percent >= 90) return '#EF4444'
  if (percent >= 70) return '#E0A030'

  return '#3FA66B'
}

export function barSvg(percent: number, color: string, width = 240): string {
  const filled = Math.max(0, Math.min(100, percent)) / 100 * width

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="8" viewBox="0 0 ${width} 8"><rect width="${width}" height="8" rx="4" fill="#80808033"/><rect width="${filled.toFixed(1)}" height="8" rx="4" fill="${color}"/></svg>`
}

/** The terminal has no Svg: a text bar instead. */
export function barText(percent: number, cells = 20): string {
  const full = Math.round(Math.max(0, Math.min(100, percent)) / 100 * cells)

  return '█'.repeat(full) + '░'.repeat(cells - full)
}
