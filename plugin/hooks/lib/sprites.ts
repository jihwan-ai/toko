import type { TokoColor, TokoEyes, TokoMood, TokoPattern } from '../../types'

export type Grid = readonly string[]

export const BODY: Grid = [
  '...o........o...',
  '..obo......obo..',
  '..obboooooobbo..',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbllllllbbbbo',
  '.obbbllllllbbbo.',
  '.obbbbllllbbbbo.',
  '..obbbbbbbbbbo..',
  '...oooooooooo...',
]

export const EAR_TIPS_CHILD: Grid = ['..o..........o..']

export const TAIL_ADULT: Grid = ['oo', 'bo', 'o.']

export const FEET = {
  stand: '...oo......oo...',
  stepA: '..oo.......oo...',
  stepB: '...oo.......oo..',
  tuck: '................',
} as const

export const PATTERNS: Readonly<Record<TokoPattern, readonly (readonly [number, number])[]>> = {
  plain: [],
  spots: [[3, 3], [4, 3], [11, 4], [12, 8], [2, 9], [13, 10]],
  stripe: [[6, 3], [7, 3], [8, 3], [9, 3], [7, 4], [8, 4]],
}

export const FACE = { leftEye: [3, 5], rightEye: [11, 5], mouth: [7, 7], leftBlush: [2, 7], rightBlush: [13, 7] } as const

type EyeShape = 'open' | 'happy' | 'closed' | 'lidded'

const EYE_GRIDS: Readonly<Record<TokoEyes, readonly [Grid, Grid]>> = {
  round: [['we', 'ee'], ['we', 'ee']],
  dot: [['.e', '.e'], ['e.', 'e.']],
  sparkle: [['we', 'ew'], ['we', 'ew']],
}

const EYE_SHAPES: Readonly<Record<Exclude<EyeShape, 'open'>, Grid>> = {
  happy: ['ee', '..'],
  closed: ['..', 'ee'],
  lidded: ['oo', 'ee'],
}

export const eyeGrids = (eyes: TokoEyes, shape: EyeShape): readonly [Grid, Grid] =>
  shape === 'open' ? EYE_GRIDS[eyes] : [EYE_SHAPES[shape], EYE_SHAPES[shape]]

export const MOUTHS = {
  small: [[0, 0, 'm'], [1, 0, 'm']],
  open: [[0, 0, 'm'], [1, 0, 'm'], [0, 1, 'm'], [1, 1, 'm']],
  flat: [[0, 0, 'o'], [1, 0, 'o']],
  wavy: [[-1, 1, 'm'], [0, 0, 'm'], [1, 0, 'm'], [2, 1, 'm']],
  pout: [[1, 0, 'm'], [1, 1, 'm']],
} as const

export type MouthShape = keyof typeof MOUTHS

export const MOOD_FACE: Readonly<Record<TokoMood, { eyes: EyeShape; mouth: MouthShape; hasBrows: boolean }>> = {
  excited: { eyes: 'happy', mouth: 'open', hasBrows: false },
  calm: { eyes: 'open', mouth: 'small', hasBrows: false },
  sleepy: { eyes: 'lidded', mouth: 'flat', hasBrows: false },
  worried: { eyes: 'open', mouth: 'wavy', hasBrows: true },
  sulky: { eyes: 'lidded', mouth: 'pout', hasBrows: false },
}

export const EGG: Grid = [
  '...oooo...',
  '..oEEEEo..',
  '.oEEsEEEo.',
  '.oEEEEEEo.',
  'oEEEEEEsEo',
  'oEsEEEEEEo',
  'oEEEEEEEEo',
  'oEEEEsEEEo',
  '.oEEEEEEo.',
  '..oooooo..',
]

export const EGG_CRACK: Grid = [
  '...oooo...',
  '..oEEEEo..',
  '.oEEsEEEo.',
  '.oEoEoEEo.',
  'oEo.o.oEEo',
  'oEsEEEEoEo',
  'oEEEEEEEEo',
  'oEEEEsEEEo',
  '.oEEEEEEo.',
  '..oooooo..',
]

export const EGG_SHELL: Grid = ['oEEo..oEEo', 'oEEEooEEEo', '.oooooooo.']

export const HAMMER_UP: Grid = ['rRRRr', 'RRRRR', 'rRRRr', '..h..', '..h..', '..h..']
export const HAMMER_DOWN: Grid = ['..h..', '..h..', '..h..', 'rRRRr', 'RRRRR', 'rRRRr']
export const HAMMER_SIDE: Grid = ['.rRr...', 'RRRRhhh', '.rRr...']

export const DOLL: Grid = ['.oooooo.', 'oWWWWWWo', 'oWDWDWDo', 'oWWWWWWo', '.ooooWWo', '.....oo.']
export const DOLL_SQUASHED: Grid = ['........', '........', '.oooooo.', 'oWDWDWDo', 'ooooooWo', '.....oo.']

export const STAR: Grid = ['.y.', 'yYy', '.y.']
export const HEART: Grid = ['k.k', 'kkk', '.k.']
export const COIN: Grid = ['.gg.', 'gGgg', 'gGgg', '.gg.']
export const ZZZ: Grid = ['zzz', '.z.', 'zzz']
export const SPARKLE: Grid = ['.Y.', 'Y.Y', '.Y.']
export const NOTE: Grid = ['.kk', '.k.', 'kk.']

export const BUTTERFLY: readonly Grid[] = [
  ['qq.qq', 'qqaqq', '.q.q.'],
  ['.q.q.', '..a..', '.q.q.'],
]
export const LEAF: readonly Grid[] = [['nN', 'N.'], ['Nn', '.N']]
export const CRUMB: Grid = ['g']
export const BUBBLE: Grid = ['.u.', 'u.u', '.u.']
export const FIREFLY: readonly Grid[] = [['f'], ['F']]
export const SHOOTING_STAR: Grid = ['Y...', '.y..', '..y.', '...a']
export const CLOUD: Grid = ['..aaa..', '.aAAAa.', 'aAAAAAa', '.aaaaa.']
export const DROP: Grid = ['d']
export const UMBRELLA: Grid = ['..UUU..', '.UUUUU.', 'UUuUuUU', '...h...', '...h...']
export const SPROUT: readonly Grid[] = [
  ['.....', '.....', '..n..', '.ttt.', '.ttt.'],
  ['.....', 'n.n..', '.nn..', '.ttt.', '.ttt.'],
  ['nn.nn', '.nNn.', '..n..', '.ttt.', '.ttt.'],
]
export const WATERING_CAN: Grid = ['..UUU.', 'uUUUUU', '.UUUU.']
export const GIFT: Grid = ['..yy..', 'RRyyRR', 'RRyyRR', 'RRyyRR']
export const GIFT_OPEN: Grid = ['.yy.yy', '......', 'RRyyRR', 'RRyyRR']
export const CUP: Grid = ['uuuu', 'cUUc', 'cUUc', '.cc.']
export const BUG: readonly Grid[] = [['.v.', 'vVv', 'v.v'], ['.v.', 'vVv', '.v.']]

export const HATS: Readonly<Record<string, { grid: Grid; dx: number; dy: number }>> = {
  beanie: { grid: ['.....ii.....', '...iiiiii...', '..iIiIiIii..'], dx: 2, dy: 0 },
  ribbon: { grid: ['kk.kk', '.kkk.', 'kk.kk'], dx: 10, dy: 0 },
  crown: { grid: ['y.y.y', 'yYyYy', 'yyyyy'], dx: 5, dy: -1 },
}

export const NECKS: Readonly<Record<string, { grid: Grid; dx: number; dy: number }>> = {
  scarf: { grid: ['.RRRRRRRRRRRR.', '..RRrr....RRR.', '..........RR..'], dx: 1, dy: 12 },
}

export const CRITTERS: Readonly<Record<string, { stand: Grid; step: Grid; fur: string }>> = {
  chick: {
    stand: ['..oo...', '.oyyo..', 'oyyyeyG', 'oggyyyo', 'ogyyyyo', '.oooo..', '.G..G..'],
    step: ['..oo...', '.oyyo..', 'oyyyeyG', 'oggyyyo', 'ogyyyyo', '.oooo..', 'G....G.'],
    fur: 'y',
  },
  hamster: {
    stand: ['....Gq..', '.oooGGoo', 'oGGGGGeo', 'oGGGGGsk', 'osssssso', '.oooooo.', '.k...k..'],
    step: ['....Gq..', '.oooGGoo', 'oGGGGGeo', 'oGGGGGsk', 'osssssso', '.oooooo.', 'k.....k.'],
    fur: 'G',
  },
  kitten: {
    stand: ['....a..a', 'a...oAAo', 'a.ooAAeo', '.aAAAAAk', '.oAaAaAo', '..oooooo', '..a...a.'],
    step: ['....a..a', 'a...oAAo', 'a.ooAAeo', '.aAAAAAk', '.oAaAaAo', '..oooooo', '.a.....a'],
    fur: 'A',
  },
}

export const ROOM_PROPS: Readonly<Record<string, Grid>> = {
  plant: ['.nn.n', 'n.Nnn', '.nNn.', '.ttt.', '.ttt.'],
  lamp: ['.yyy.', 'yYYYy', '.yyy.', '..h..', '..h..', '.hhh.'],
  rug: ['.ssssssssssssssss.', 'sSsSsSsSsSsSsSsSss', '.ssssssssssssssss.'],
}

const CHANNEL = 0x11

export const hex = (value: string): number => {
  const parsed = Number.parseInt(value.replace('#', ''), 16)
  const r = Math.round(((parsed >> 16) & 0xff) / CHANNEL) * CHANNEL
  const g = Math.round(((parsed >> 8) & 0xff) / CHANNEL) * CHANNEL
  const b = Math.round((parsed & 0xff) / CHANNEL) * CHANNEL
  return (r << 16) | (g << 8) | b
}

const BODY_COLORS: Readonly<Record<TokoColor, { o: string; b: string; l: string; p: string; t: string }>> = {
  honey: { o: '#332233', b: '#FFDD99', l: '#FFEECC', p: '#FF9999', t: '#EEBB77' },
  mint: { o: '#223333', b: '#AAEECC', l: '#DDFFEE', p: '#FF9999', t: '#88DDAA' },
  peach: { o: '#332222', b: '#FFBBAA', l: '#FFDDCC', p: '#FF8888', t: '#EE9988' },
  lavender: { o: '#222233', b: '#CCBBEE', l: '#EEDDFF', p: '#FF99BB', t: '#AA99DD' },
}

const SHARED: Readonly<Record<string, string>> = {
  e: '#221122',
  w: '#FFFFFF',
  m: '#883344',
  R: '#EE3344',
  r: '#AA2233',
  h: '#AA7744',
  Y: '#FFFFAA',
  y: '#FFDD44',
  k: '#FF6699',
  g: '#FFCC22',
  G: '#CC8811',
  z: '#99AADD',
  q: '#FFAACC',
  a: '#777788',
  A: '#BBBBCC',
  u: '#BBDDFF',
  U: '#66AADD',
  c: '#DDDDEE',
  d: '#5599DD',
  E: '#FFFFEE',
  s: '#DDCC99',
  S: '#CCAA88',
  n: '#77CC66',
  N: '#449944',
  t: '#AA6644',
  W: '#FFFFFF',
  D: '#888899',
  f: '#DDFF66',
  F: '#889944',
  i: '#5577CC',
  I: '#334499',
  v: '#663355',
  V: '#AA4477',
  x: '#888899',
}

export type Palette = ReadonlyMap<string, number>

export const paletteOf = (color: TokoColor): Palette => {
  const body = BODY_COLORS[color]
  const entries: [string, string][] = [
    ...Object.entries(SHARED),
    ['o', body.o],
    ['b', body.b],
    ['l', body.l],
    ['p', body.p],
    ['T', body.t],
  ]
  return new Map(entries.map(([key, value]) => [key, hex(value)]))
}

export const HAMMER_SKINS: Readonly<Record<string, { R: string; r: string }>> = {
  toy: { R: '#EE3344', r: '#AA2233' },
  duck: { R: '#FFDD33', r: '#EE9922' },
  pillow: { R: '#FFFFFF', r: '#CCCCDD' },
  leek: { R: '#88DD66', r: '#EEFFEE' },
}

export const KAOMOJI: Readonly<Record<TokoMood, string>> = {
  excited: '(ﾉ◕ヮ◕)ﾉ',
  calm: '(•ᴗ•)',
  sleepy: '(－_－) zZ',
  worried: '(・_・;)',
  sulky: '(¬_¬)',
}
