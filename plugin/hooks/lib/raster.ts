import type { Grid, Palette } from './sprites'

export const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584
const SPACE = 0x20

export type Canvas = { width: number; height: number; pixels: Uint32Array }

export const createCanvas = (width: number, rows: number): Canvas => {
  const pixels = new Uint32Array(width * rows * 2)
  pixels.fill(DEFAULT)
  return { width, height: rows * 2, pixels }
}

export const clear = (canvas: Canvas): void => {
  canvas.pixels.fill(DEFAULT)
}

export const setPixel = (canvas: Canvas, x: number, y: number, color: number): void => {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
    return
  }
  canvas.pixels[py * canvas.width + px] = color
}

export type DrawOptions = { isFlipped?: boolean; overrides?: ReadonlyMap<string, number>; tint?: number; scale?: number }

export const drawGrid = (canvas: Canvas, grid: Grid, x: number, y: number, palette: Palette, options: DrawOptions = {}): void => {
  const scale = options.scale ?? 1
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0)
  for (let row = 0; row < grid.length; row += 1) {
    const line = grid[row] ?? ''
    for (let column = 0; column < line.length; column += 1) {
      const key = line[column] ?? '.'
      if (key === '.') {
        continue
      }
      const color = options.tint ?? options.overrides?.get(key) ?? palette.get(key)
      if (color === undefined) {
        continue
      }
      const sourceX = options.isFlipped ? width - 1 - column : column
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          setPixel(canvas, Math.round(x) + sourceX * scale + dx, Math.round(y) + row * scale + dy, color)
        }
      }
    }
  }
}

export const encodeCells = (canvas: Canvas): string => {
  const rows = canvas.height / 2
  const words = new Uint32Array(canvas.width * rows * 3)
  for (let row = 0; row < rows; row += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const top = canvas.pixels[row * 2 * canvas.width + x] ?? DEFAULT
      const bottom = canvas.pixels[(row * 2 + 1) * canvas.width + x] ?? DEFAULT
      const at = (row * canvas.width + x) * 3
      const glyph = top === DEFAULT ? (bottom === DEFAULT ? SPACE : LOWER) : UPPER
      words[at] = glyph
      words[at + 1] = glyph === LOWER ? bottom : top
      words[at + 2] = glyph === UPPER ? bottom : DEFAULT
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const encodeTriple = (bytes: Uint8Array, index: number): string => {
  const triple = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)
  const remaining = bytes.length - index
  return (
    (ALPHABET[(triple >> 18) & 63] ?? '') +
    (ALPHABET[(triple >> 12) & 63] ?? '') +
    (remaining > 1 ? (ALPHABET[(triple >> 6) & 63] ?? '') : '=') +
    (remaining > 2 ? (ALPHABET[triple & 63] ?? '') : '=')
  )
}

export const toBase64 = (bytes: Uint8Array): string =>
  Array.from({ length: Math.ceil(bytes.length / 3) }, (_, group) => encodeTriple(bytes, group * 3)).join('')

const decodeQuad = (values: readonly number[], index: number): number[] => {
  const n = ((values[index] ?? 0) << 18) | ((values[index + 1] ?? 0) << 12) | ((values[index + 2] ?? 0) << 6) | (values[index + 3] ?? 0)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const decodeGlyphs = (cells: string, columns: number): string[] => {
  const values = [...cells.replace(/=+$/, '')].map(char => ALPHABET.indexOf(char))
  const bytes = Array.from({ length: Math.ceil(values.length / 4) }, (_, group) => decodeQuad(values, group * 4)).flat()
  const words = Math.floor(bytes.length / 12)
  const glyphs = Array.from({ length: words }, (_, word) => {
    const at = word * 12
    const code = (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16)
    return code === UPPER ? '▀' : code === LOWER ? '▄' : ' '
  })
  return Array.from({ length: Math.ceil(glyphs.length / columns) }, (_, row) => glyphs.slice(row * columns, (row + 1) * columns).join(''))
}
