import type { TokoMood, TokoSpecies } from '../../types'

export type Grid = readonly string[]

export const FEET = {
  stand: '...oo......oo...',
  stepA: '..oo.......oo...',
  stepB: '...oo.......oo..',
  tuck: '................',
} as const

type Point = readonly [number, number]

export type Face = { leftEye: Point; rightEye: Point; mouth: Point; leftBlush: Point; rightBlush: Point }

const FACE: Face = { leftEye: [3, 5], rightEye: [11, 5], mouth: [7, 7], leftBlush: [2, 7], rightBlush: [13, 7] }

type EyeStyle = 'round' | 'dot' | 'sparkle'

type EyeShape = 'open' | 'happy' | 'closed' | 'lidded'

const EYE_GRIDS: Readonly<Record<EyeStyle, readonly [Grid, Grid]>> = {
  round: [['we', 'ee'], ['we', 'ee']],
  dot: [['.e', '.e'], ['e.', 'e.']],
  sparkle: [['we', 'ew'], ['we', 'ew']],
}

const EYE_SHAPES: Readonly<Record<Exclude<EyeShape, 'open'>, Grid>> = {
  happy: ['ee', '..'],
  closed: ['..', 'ee'],
  lidded: ['oo', 'ee'],
}

export const eyeGrids = (eyes: EyeStyle, shape: EyeShape): readonly [Grid, Grid] =>
  shape === 'open' ? EYE_GRIDS[eyes] : [EYE_SHAPES[shape], EYE_SHAPES[shape]]

export type Mark = { grid: Grid; dx: number; dy: number }

export type SpeciesArt = {
  body: Grid
  eyes: EyeStyle
  face: Face
  colors: { o: string; b: string; l: string; p: string; t: string; m?: string }
  child?: Mark
  adult?: Mark
  hatDy: number
  isFloating?: boolean
}

export const SPECIES_ART: Readonly<Record<TokoSpecies, SpeciesArt>> = {
  cat: {
    body: [
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
    ],
    eyes: 'round',
    face: FACE,
    colors: { o: '#332233', b: '#FFDD99', l: '#FFEECC', p: '#FF9999', t: '#EEBB77' },
    child: { grid: ['..o..........o..'], dx: 0, dy: -1 },
    adult: { grid: ['oo', 'bo', 'o.'], dx: -1, dy: 9 },
    hatDy: 0,
  },
  bear: {
    body: [
      '.ooo........ooo.',
      'oblbo......oblbo',
      'obbboooooooobbbo',
      '.obbbbbbbbbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbllllllbbbbo',
      'obbbbbllllbbbbbo',
      'obbbbbbbbbbbbbbo',
      '.obbbllllllbbbo.',
      '.obbbbllllbbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'dot',
    face: FACE,
    colors: { o: '#331F11', b: '#C08A5A', l: '#F0DCC0', p: '#FF9988', t: '#9A6A40', m: '#442211' },
    adult: { grid: ['oo', 'bo'], dx: -1, dy: 10 },
    hatDy: 0,
  },
  chick: {
    body: [
      '.......oo.......',
      '......obbo......',
      '....oooooooo....',
      '...obbbbbbbbo...',
      '..obbbbbbbbbbo..',
      '.obbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbllllbbbbbo',
      '.obbbllllllbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'dot',
    face: FACE,
    colors: { o: '#443311', b: '#FFE066', l: '#FFF4BB', p: '#FFAA88', t: '#FFCC33', m: '#FF8833' },
    adult: { grid: ['o.', 'bo', 'o.'], dx: -1, dy: 8 },
    hatDy: 1,
  },
  bunny: {
    body: [
      '..oo........oo..',
      '.oblo......olbo.',
      '.oblo......olbo.',
      '..obboooooobbo..',
      '.obbbbbbbbbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbllllbbbbbo',
      '.obbbllllllbbbo.',
      '.obbbbllllbbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'round',
    face: FACE,
    colors: { o: '#443344', b: '#F6F0F2', l: '#FFC8D8', p: '#FF99AA', t: '#FFFFFF' },
    adult: { grid: ['oo', 'Wo', 'oo'], dx: -1, dy: 9 },
    hatDy: 0,
  },
  frog: {
    body: [
      '..oooo....oooo..',
      '.obbbbo..obbbbo.',
      '.obbbbboobbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbllllllllbbbo',
      '.obbllllllllbbo.',
      '.obbbllllllbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'round',
    face: { leftEye: [3, 2], rightEye: [11, 2], mouth: [7, 6], leftBlush: [2, 5], rightBlush: [13, 5] },
    colors: { o: '#1F3322', b: '#8CD06A', l: '#E2F2B0', p: '#FF9999', t: '#5FA84A' },
    hatDy: -1,
  },
  penguin: {
    body: [
      '....oooooooo....',
      '...obbbbbbbbo...',
      '..obbbbbbbbbbo..',
      '.obbbbbbbbbbbbo.',
      '.obllllbbllllbo.',
      'obllllllllllllbo',
      'obllllllllllllbo',
      'obllllllllllllbo',
      'obbllllllllllbbo',
      'obbbllllllllbbbo',
      '.obbllllllllbbo.',
      '.obbbllllllbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'dot',
    face: FACE,
    colors: { o: '#111A22', b: '#3A4A5C', l: '#FFFFFF', p: '#FFAABB', t: '#2A3644', m: '#FF9922' },
    hatDy: 0,
  },
  fox: {
    body: [
      '.oo..........oo.',
      '.olo........olo.',
      '.ollo......ollo.',
      '.obbboooooobbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'olllbbbbbbbblllo',
      'obllllllllllllbo',
      'obbllllllllllbbo',
      '.obbbllllllbbbo.',
      '.obbbbllllbbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'sparkle',
    face: FACE,
    colors: { o: '#3A1F14', b: '#F28A3C', l: '#FFF1E2', p: '#FF7766', t: '#FFF1E2' },
    adult: { grid: ['.oo', 'obb', 'obl', '.oo'], dx: -2, dy: 7 },
    hatDy: 0,
  },
  dragon: {
    body: [
      '...y........y...',
      '..yyo......oyy..',
      '..obboooooobbo..',
      '.obbbbbbbbbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbllllllbbbbo',
      '.obbbTTTTTTbbbo.',
      '.obbbbllllbbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'sparkle',
    face: FACE,
    colors: { o: '#163330', b: '#5CC8A8', l: '#EAF8C8', p: '#FF99BB', t: '#3FA88C' },
    adult: { grid: ['oy', 'bo', 'o.'], dx: -1, dy: 9 },
    hatDy: 0,
  },
  unicorn: {
    body: [
      '.......Y........',
      '..o....yY....o..',
      '.obo..oyyo..obo.',
      '.obboooooooobbo.',
      'okkbbbbbbbbbbbbo',
      'okbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbllllllbbbbo',
      '.obbbllllllbbbo.',
      '.obbbbllllbbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'sparkle',
    face: FACE,
    colors: { o: '#443355', b: '#FAF6FF', l: '#E8DDFF', p: '#FFAACC', t: '#CCBBFF' },
    adult: { grid: ['ok', 'kq', 'o.'], dx: -1, dy: 9 },
    hatDy: 0,
  },
  ghost: {
    body: [
      '.....oooooo.....',
      '...oobbbbbboo...',
      '..obbbbbbbbbbo..',
      '.obbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbobbbbobbbbo',
      '.oooo.oooo.oooo.',
    ],
    eyes: 'round',
    face: FACE,
    colors: { o: '#555577', b: '#F4F6FF', l: '#FFFFFF', p: '#FFBBDD', t: '#DDE2F5' },
    hatDy: 0,
    isFloating: true,
  },
  phoenix: {
    body: [
      '......y.y.......',
      '.....yRyRy......',
      '....oooooooo....',
      '...obbbbbbbbo...',
      '..obbbbbbbbbbo..',
      '.obbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbo.',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbllllbbbbbo',
      'obbbllllllllbbbo',
      '.obbbllllllbbbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
    ],
    eyes: 'sparkle',
    face: FACE,
    colors: { o: '#441111', b: '#FF6633', l: '#FFCC55', p: '#FFDD88', t: '#FFAA22', m: '#FFDD44' },
    adult: { grid: ['.y', 'Ro', 'yo', 'R.'], dx: -1, dy: 7 },
    hatDy: 1,
  },
  robot: {
    body: [
      '.......R........',
      '.......a........',
      '.oooooooooooooo.',
      'obbbbbbbbbbbbbbo',
      'obllllllllllllbo',
      'obllllllllllllbo',
      'obllllllllllllbo',
      'obllllllllllllbo',
      'obllllllllllllbo',
      'obbbbbbbbbbbbbbo',
      'obbTTbbbbbbTTbbo',
      'obbbbbbbbbbbbbbo',
      'obbbbbbbbbbbbbbo',
      '.oooooooooooooo.',
    ],
    eyes: 'round',
    face: FACE,
    colors: { o: '#2A2F3A', b: '#AAB4C4', l: '#CCEEFF', p: '#FF99AA', t: '#FFCC44' },
    hatDy: 1,
  },
  axolotl: {
    body: [
      '....oooooooo....',
      'k..obbbbbbbbo..k',
      '.kobbbbbbbbbbok.',
      'kkobbbbbbbbbbokk',
      '.kobbbbbbbbbbok.',
      'k.obbbbbbbbbbo.k',
      '..obbbbbbbbbbo..',
      '..obbbbbbbbbbo..',
      '..obbbbbbbbbbo..',
      '..obbbllllbbbo..',
      '..obbllllllbbo..',
      '..obbbllllbbbo..',
      '...obbbbbbbbo...',
      '....oooooooo....',
    ],
    eyes: 'dot',
    face: { ...FACE, leftBlush: [3, 7], rightBlush: [12, 7] },
    colors: { o: '#663344', b: '#FFC4D6', l: '#FFE6EE', p: '#FF88AA', t: '#FF6699' },
    adult: { grid: ['oo', 'bo'], dx: 1, dy: 10 },
    hatDy: 0,
  },
}

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

export const paletteOf = (species: TokoSpecies): Palette => {
  const { m, ...body } = SPECIES_ART[species].colors
  const entries: [string, string][] = [
    ...Object.entries(SHARED),
    ['o', body.o],
    ['b', body.b],
    ['l', body.l],
    ['p', body.p],
    ['T', body.t],
    ...(m === undefined ? [] : [['m', m] as [string, string]]),
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
