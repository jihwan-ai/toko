import type { TokoBones, TokoMood, TokoSpecies, TokoStage } from '../../types'

import { rarityOf } from './pet'

import type { Random } from './random'
import type { Canvas, DrawOptions } from './raster'
import { clear, drawGrid, setPixel } from './raster'
import type { Grid, Mark, MouthShape, Palette } from './sprites'
import {
  BUBBLE,
  BUG,
  BUTTERFLY,
  CLOUD,
  COIN,
  CRITTERS,
  CRUMB,
  CUP,
  DOLL,
  DOLL_SQUASHED,
  DROP,
  EGG,
  EGG_CRACK,
  FEET,
  FIREFLY,
  GIFT,
  GIFT_OPEN,
  HAMMER_DOWN,
  HAMMER_SIDE,
  HAMMER_SKINS,
  HAMMER_UP,
  HATS,
  HEART,
  LEAF,
  MOOD_FACE,
  MOUTHS,
  NECKS,
  NOTE,
  ROOM_PROPS,
  SHOOTING_STAR,
  SPARKLE,
  SPECIES_ART,
  SPROUT,
  STAR,
  UMBRELLA,
  WATERING_CAN,
  ZZZ,
  eyeGrids,
  hex,
  paletteOf,
} from './sprites'

export const PET_WIDTH = 16
export const BAND_ROWS = 8

export type Pose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'yawn'
  | 'eat'
  | 'jump'
  | 'stretch'
  | 'wave'
  | 'look'
  | 'windup'
  | 'strike'
  | 'recoil'
  | 'proud'
  | 'breathe-in'
  | 'breathe-out'
  | 'cower'
  | 'full'
  | 'dance'
  | 'egg'
  | 'egg-wobble'
  | 'egg-crack'
  | 'hidden'

export type Step = {
  pose: Pose
  ms: number
  toX?: number
  speed?: number
  dir?: 1 | -1
  enter?: (scene: Scene) => void
  priority?: number
}

export type EffectKind = 'z' | 'heart' | 'star' | 'coin' | 'sparkle' | 'note' | 'crumb' | 'leaf' | 'bubble' | 'drop' | 'shooting-star' | 'firefly' | 'butterfly'

export type Effect = { kind: EffectKind; x: number; y: number; vx: number; vy: number; until: number; born: number; gravity: number }

export type PropKind = 'doll' | 'doll-squashed' | 'gift' | 'gift-open' | 'cup' | 'umbrella' | 'cloud' | 'sprout' | 'can' | 'bug'

export type Prop = { id: string; kind: PropKind; x: number; y: number; vx: number; until: number; born: number }

export type Visitor = { id: string; species: TokoSpecies | 'shadow'; x: number; dir: 1 | -1; speed: number; until: number; pauseAt: number | null; pauseMs: number }

export type Look = {
  bones: TokoBones
  stage: TokoStage
  mood: TokoMood
  hat?: string
  neck?: string
  hammer: string
  critter?: string
}

export type Follower = { x: number; dir: 1 | -1; side: 1 | -1; isMoving: boolean }

export type Scene = {
  width: number
  clock: number
  x: number
  dir: 1 | -1
  current: Step | null
  stepAt: number
  steps: Step[]
  effects: Effect[]
  props: Prop[]
  visitors: Visitor[]
  follower: Follower
  nextBlinkAt: number
  blinkUntil: number
  look: Look
  palette: Palette
  hammerPalette: ReadonlyMap<string, number>
  isFrozen: boolean
  planIdle: (scene: Scene) => Step[]
}

const hammerOverrides = (skin: string): ReadonlyMap<string, number> => {
  const colors = HAMMER_SKINS[skin] ?? HAMMER_SKINS.toy ?? { R: '#EE3344', r: '#AA2233' }
  return new Map([
    ['R', hex(colors.R)],
    ['r', hex(colors.r)],
  ])
}

export const createScene = (width: number, look: Look, planIdle: (scene: Scene) => Step[]): Scene => ({
  width,
  clock: 0,
  x: Math.max(0, Math.round(width / 2 - PET_WIDTH / 2)),
  dir: 1,
  current: null,
  stepAt: 0,
  steps: [],
  effects: [],
  props: [],
  visitors: [],
  follower: { x: Math.max(0, Math.round(width / 2 - PET_WIDTH / 2)), dir: 1, side: -1, isMoving: false },
  nextBlinkAt: 3000,
  blinkUntil: 0,
  look,
  palette: paletteOf(look.bones.species),
  hammerPalette: hammerOverrides(look.hammer),
  isFrozen: false,
  planIdle,
})

export const setLook = (scene: Scene, look: Look): void => {
  if (look.bones.species !== scene.look.bones.species) {
    scene.palette = paletteOf(look.bones.species)
  }
  if (look.hammer !== scene.look.hammer) {
    scene.hammerPalette = hammerOverrides(look.hammer)
  }
  scene.look = look
}

export const resize = (scene: Scene, width: number): void => {
  scene.width = width
  scene.x = Math.min(Math.max(0, scene.x), Math.max(0, width - PET_WIDTH))
}

export const centerX = (scene: Scene): number => Math.max(0, Math.round(scene.width / 2 - PET_WIDTH / 2))
export const rightX = (scene: Scene): number => Math.max(0, scene.width - PET_WIDTH - 10)
export const isOffstage = (scene: Scene): boolean => scene.x <= -PET_WIDTH || scene.x >= scene.width

export const perform = (scene: Scene, steps: readonly Step[], priority: number): void => {
  const currentPriority = scene.current?.priority ?? 0
  if (priority >= currentPriority) {
    scene.current = null
    scene.steps = steps.map(step => ({ ...step, priority }))
    return
  }
  scene.steps = [...scene.steps, ...steps.map(step => ({ ...step, priority }))]
}

export const isBusy = (scene: Scene): boolean => (scene.current?.priority ?? 0) > 0 || scene.steps.length > 0

export const spawn = (scene: Scene, kind: EffectKind, x: number, y: number, vx: number, vy: number, lifeMs: number, gravity = 0): void => {
  scene.effects = [...scene.effects, { kind, x, y, vx, vy, until: scene.clock + lifeMs, born: scene.clock, gravity }].slice(-40)
}

export const placeProp = (scene: Scene, id: string, kind: PropKind, x: number, y: number, lifeMs: number, vx = 0): void => {
  scene.props = [...scene.props.filter(prop => prop.id !== id), { id, kind, x, y, vx, until: scene.clock + lifeMs, born: scene.clock }]
}

export const removeProp = (scene: Scene, id: string): void => {
  scene.props = scene.props.filter(prop => prop.id !== id)
}

export const addVisitor = (scene: Scene, id: string, species: TokoSpecies | 'shadow', lifeMs: number, pauseMs = 0): void => {
  const fromLeft = scene.x > scene.width / 2
  const visitor: Visitor = {
    id,
    species,
    x: fromLeft ? -PET_WIDTH : scene.width,
    dir: fromLeft ? 1 : -1,
    speed: 10,
    until: scene.clock + lifeMs,
    pauseAt: pauseMs > 0 ? scene.x + (fromLeft ? -PET_WIDTH - 4 : PET_WIDTH + 4) : null,
    pauseMs,
  }
  scene.visitors = [...scene.visitors.filter(other => other.id !== id), visitor].slice(-3)
}

const advanceStep = (scene: Scene): void => {
  if (scene.current === null) {
    if (scene.steps.length === 0) {
      scene.steps = scene.planIdle(scene).map(step => ({ ...step, priority: 0 }))
    }
    const [next, ...rest] = scene.steps
    scene.steps = rest
    scene.current = next ?? { pose: 'idle', ms: 1000, priority: 0 }
    scene.stepAt = scene.clock
    if (scene.current.dir !== undefined) {
      scene.dir = scene.current.dir
    }
    scene.current.enter?.(scene)
  }
}

const moveToward = (scene: Scene, step: Step, dt: number): boolean => {
  if (step.toX === undefined) {
    return scene.clock - scene.stepAt >= step.ms
  }
  const speed = step.speed ?? (step.pose === 'run' ? 22 : 8)
  const distance = step.toX - scene.x
  scene.dir = distance === 0 ? scene.dir : distance > 0 ? 1 : -1
  const move = (speed * dt) / 1000
  if (Math.abs(distance) <= move) {
    scene.x = step.toX
    return true
  }
  scene.x += Math.sign(distance) * move
  return scene.clock - scene.stepAt >= Math.max(step.ms, 20_000)
}

const stepEffects = (scene: Scene, dt: number): void => {
  const seconds = dt / 1000
  scene.effects = scene.effects
    .filter(effect => effect.until > scene.clock)
    .map(effect => ({
      ...effect,
      x: effect.x + effect.vx * seconds,
      y: effect.y + effect.vy * seconds,
      vy: effect.vy + effect.gravity * seconds,
    }))
  scene.props = scene.props
    .filter(prop => prop.until > scene.clock)
    .map(prop => ({ ...prop, x: prop.x + prop.vx * seconds }))
  scene.visitors = scene.visitors.filter(visitor => visitor.until > scene.clock).map(visitor => moveVisitor(visitor, scene, seconds))
}

const moveVisitor = (visitor: Visitor, scene: Scene, seconds: number): Visitor => {
  if (visitor.pauseAt !== null && Math.abs(visitor.x - visitor.pauseAt) < 1) {
    return visitor.pauseMs > 0 ? { ...visitor, pauseMs: visitor.pauseMs - seconds * 1000 } : { ...visitor, pauseAt: null }
  }
  if (visitor.pauseAt !== null) {
    const distance = visitor.pauseAt - visitor.x
    const move = Math.min(Math.abs(distance), visitor.speed * seconds)
    return { ...visitor, x: visitor.x + Math.sign(distance) * move }
  }
  const x = visitor.x + visitor.dir * visitor.speed * seconds
  return x < -PET_WIDTH * 2 || x > scene.width + PET_WIDTH ? { ...visitor, x, until: scene.clock } : { ...visitor, x }
}

const CRITTER_GAP = 2
const CRITTER_SPEED = 16

const critterWidth = (grid: Grid): number => grid.reduce((max, row) => Math.max(max, row.length), 0)

const follow = (scene: Scene, dt: number): void => {
  const critter = scene.look.critter === undefined ? undefined : CRITTERS[scene.look.critter]
  const follower = scene.follower
  if (critter === undefined) {
    scene.follower = { ...follower, x: scene.x, isMoving: false }
    return
  }
  const pose = scene.current?.pose
  const side = pose === 'walk' || pose === 'run' ? (scene.dir > 0 ? -1 : 1) : follower.side
  const target = pose === 'hidden' ? scene.x : side < 0 ? scene.x - CRITTER_GAP - critterWidth(critter.stand) : scene.x + PET_WIDTH + CRITTER_GAP
  const distance = target - follower.x
  const move = (CRITTER_SPEED * dt) / 1000
  if (Math.abs(distance) <= move) {
    scene.follower = { x: target, dir: side < 0 ? 1 : -1, side, isMoving: false }
    return
  }
  scene.follower = { x: follower.x + Math.sign(distance) * move, dir: distance > 0 ? 1 : -1, side, isMoving: true }
}

const ambientEffects = (scene: Scene, random: Random): void => {
  const pose = scene.current?.pose
  if (pose === 'sleep' && random() < 0.04) {
    spawn(scene, 'z', scene.x + 13, 4, 2, -2.5, 1800)
  }
  const rarityChance = { normal: 0, rare: 0.03 }[rarityOf(scene.look.bones)]
  if (pose !== 'hidden' && random() < rarityChance) {
    spawn(scene, 'sparkle', scene.x - 2 + random() * (PET_WIDTH + 4), 1 + random() * 10, 0, 0, 500)
  }
  if (pose === 'dance' && random() < 0.05) {
    spawn(scene, 'note', scene.x + (random() < 0.5 ? -3 : PET_WIDTH), 4, 0, -3, 1200)
  }
}

export const tick = (scene: Scene, dt: number, random: Random): void => {
  if (scene.isFrozen) {
    return
  }
  scene.clock += dt
  advanceStep(scene)
  const step = scene.current
  if (step !== null && moveToward(scene, step, dt)) {
    scene.current = null
    advanceStep(scene)
  }
  follow(scene, dt)
  if (scene.clock >= scene.nextBlinkAt) {
    scene.blinkUntil = scene.clock + 160
    scene.nextBlinkAt = scene.clock + 3000 + random() * 3000
  }
  ambientEffects(scene, random)
  stepEffects(scene, dt)
}

type Frame = { dy: number; feet: keyof typeof FEET; eyes?: 'happy' | 'closed' | 'lidded' | 'open'; mouth?: MouthShape; arms?: 'up' | 'wave-a' | 'wave-b'; hammer?: 'up' | 'down' | 'side'; shakeX: number }

const cycle = (elapsed: number, frameMs: number, count: number): number => Math.floor(elapsed / frameMs) % count

export const frameOf = (pose: Pose, elapsed: number): Frame => {
  const base: Frame = { dy: 0, feet: 'stand', shakeX: 0 }
  switch (pose) {
    case 'idle':
    case 'look':
      return { ...base, dy: cycle(elapsed, 700, 2) }
    case 'walk':
    case 'run': {
      const index = cycle(elapsed, pose === 'run' ? 80 : 140, 4)
      return { ...base, dy: index % 2, feet: index === 0 ? 'stepA' : index === 2 ? 'stepB' : 'stand' }
    }
    case 'sit':
      return { ...base, dy: 1, feet: 'tuck' }
    case 'sleep':
      return { ...base, dy: 1, feet: 'tuck', eyes: 'closed', mouth: 'flat' }
    case 'yawn':
      return { ...base, dy: cycle(elapsed, 500, 2), eyes: 'closed', mouth: 'open' }
    case 'eat':
      return { ...base, mouth: cycle(elapsed, 160, 2) === 0 ? 'open' : 'small', eyes: 'happy' }
    case 'jump': {
      const index = Math.min(6, Math.floor(elapsed / 90))
      const heights = [1, 0, -1, -1, 0, 1, 0]
      return { ...base, dy: heights[index] ?? 0, feet: index >= 2 && index <= 4 ? 'tuck' : 'stand', eyes: 'happy', mouth: 'open' }
    }
    case 'stretch':
      return { ...base, dy: cycle(elapsed, 900, 2) === 0 ? -1 : 0, arms: 'up', eyes: 'happy', mouth: 'small' }
    case 'wave':
      return { ...base, arms: cycle(elapsed, 220, 2) === 0 ? 'wave-a' : 'wave-b', eyes: 'happy', mouth: 'small' }
    case 'windup':
      return { ...base, dy: -1, hammer: 'up', mouth: 'pout' }
    case 'strike':
      return { ...base, dy: 1, hammer: 'down', eyes: 'closed', mouth: 'open' }
    case 'recoil':
      return { ...base, dy: -1, hammer: 'side', eyes: 'happy', mouth: 'open' }
    case 'proud':
      return { ...base, hammer: 'side', eyes: 'happy', mouth: 'small' }
    case 'breathe-in':
      return { ...base, dy: -1, eyes: 'closed', mouth: 'small' }
    case 'breathe-out':
      return { ...base, dy: 1, eyes: 'closed', mouth: 'flat' }
    case 'cower':
      return { ...base, dy: 1, eyes: 'closed', mouth: 'wavy', shakeX: cycle(elapsed, 60, 2) === 0 ? -1 : 1 }
    case 'full':
      return { ...base, dy: 2, feet: 'tuck', eyes: 'happy', mouth: 'small' }
    case 'dance': {
      const index = cycle(elapsed, 250, 4)
      return { ...base, dy: index % 2 === 0 ? 0 : -1, feet: index < 2 ? 'stepA' : 'stepB', eyes: 'happy', mouth: 'open', arms: index < 2 ? 'wave-a' : 'wave-b' }
    }
    default:
      return base
  }
}

const drawFace = (canvas: Canvas, scene: Scene, frame: Frame, x: number, y: number, scale: number, isBlinking: boolean): void => {
  const mood = MOOD_FACE[scene.look.mood]
  const art = SPECIES_ART[scene.look.bones.species]
  const face = art.face
  const eyeShape = isBlinking && (frame.eyes ?? mood.eyes) === 'open' ? 'closed' : (frame.eyes ?? mood.eyes)
  const [left, right] = eyeGrids(art.eyes, eyeShape)
  const options: DrawOptions = { scale }
  drawGrid(canvas, left, x + face.leftEye[0] * scale, y + face.leftEye[1] * scale, scene.palette, options)
  drawGrid(canvas, right, x + face.rightEye[0] * scale, y + face.rightEye[1] * scale, scene.palette, options)
  const blush = scene.palette.get('p') ?? 0
  const eyeColor = scene.palette.get('e') ?? 0
  for (const [bx, by] of [face.leftBlush, face.rightBlush]) {
    fillBlock(canvas, x + bx * scale, y + by * scale, scale, blush)
  }
  if (mood.hasBrows && frame.eyes === undefined) {
    fillBlock(canvas, x + (face.leftEye[0] + 1) * scale, y + (face.leftEye[1] - 1) * scale, scale, eyeColor)
    fillBlock(canvas, x + face.rightEye[0] * scale, y + (face.rightEye[1] - 1) * scale, scale, eyeColor)
  }
  const mouth = MOUTHS[frame.mouth ?? mood.mouth]
  for (const [mx, my, key] of mouth) {
    fillBlock(canvas, x + (face.mouth[0] + mx) * scale, y + (face.mouth[1] + my) * scale, scale, scene.palette.get(key) ?? 0)
  }
}

const fillBlock = (canvas: Canvas, x: number, y: number, scale: number, color: number): void => {
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) {
      setPixel(canvas, x + dx, y + dy, color)
    }
  }
}

const drawArms = (canvas: Canvas, scene: Scene, arms: Frame['arms'], x: number, y: number, scale: number): void => {
  if (arms === undefined) {
    return
  }
  const body = scene.palette.get('b') ?? 0
  const outline = scene.palette.get('o') ?? 0
  const spots: readonly (readonly [number, number, number])[] =
    arms === 'up'
      ? [[-1, 3, outline], [-1, 4, body], [-1, 5, outline], [16, 3, outline], [16, 4, body], [16, 5, outline]]
      : arms === 'wave-a'
        ? [[16, 4, outline], [16, 5, body], [17, 4, outline]]
        : [[16, 7, outline], [16, 8, body], [17, 8, outline]]
  for (const [ax, ay, color] of spots) {
    fillBlock(canvas, x + ax * scale, y + ay * scale, scale, color)
  }
}

const drawHammer = (canvas: Canvas, scene: Scene, hammer: Frame['hammer'], x: number, y: number, scale: number): void => {
  if (hammer === undefined) {
    return
  }
  const options: DrawOptions = { scale, overrides: scene.hammerPalette, isFlipped: scene.dir < 0 && hammer === 'side' }
  const front = scene.dir > 0 ? x + 14 * scale : x - 5 * scale
  if (hammer === 'up') {
    drawGrid(canvas, HAMMER_UP, scene.dir > 0 ? x - 4 * scale : x + 15 * scale, y - 1 * scale, scene.palette, options)
  } else if (hammer === 'down') {
    drawGrid(canvas, HAMMER_DOWN, front, y + 6 * scale, scene.palette, options)
  } else {
    drawGrid(canvas, HAMMER_SIDE, scene.dir > 0 ? x + 14 * scale : x - 7 * scale, y + 7 * scale, scene.palette, options)
  }
}

const drawMark = (canvas: Canvas, scene: Scene, mark: Mark, x: number, y: number, scale: number, isFlipped: boolean): void => {
  const width = mark.grid.reduce((max, row) => Math.max(max, row.length), 0)
  const dx = isFlipped ? PET_WIDTH - mark.dx - width : mark.dx
  drawGrid(canvas, mark.grid, x + dx * scale, y + mark.dy * scale, scene.palette, { scale, isFlipped })
}

export const paintPet = (canvas: Canvas, scene: Scene, pose: Pose, elapsed: number, x: number, baseY: number, scale: number): void => {
  const look = scene.look
  if (pose === 'hidden') {
    return
  }
  if (look.stage === 'egg' || pose === 'egg' || pose === 'egg-wobble' || pose === 'egg-crack') {
    const wobble = pose === 'egg-wobble' ? (cycle(elapsed, 120, 4) % 2 === 0 ? -1 : 1) : 0
    const grid = pose === 'egg-crack' ? EGG_CRACK : EGG
    drawGrid(canvas, grid, x + (3 + wobble) * scale, baseY + 4 * scale, scene.palette, { scale })
    return
  }
  const frame = frameOf(pose, elapsed)
  const px = x + frame.shakeX * scale
  const py = baseY + frame.dy * scale
  const isFlipped = scene.dir < 0
  const art = SPECIES_ART[look.bones.species]
  if (look.stage === 'adult' && art.adult !== undefined) {
    drawMark(canvas, scene, art.adult, px, py, scale, isFlipped)
  }
  if ((look.stage === 'child' || look.stage === 'adult') && art.child !== undefined) {
    drawMark(canvas, scene, art.child, px, py, scale, isFlipped)
  }
  drawGrid(canvas, art.body, px, py, scene.palette, { scale })
  if (art.isFloating !== true) {
    const feetY = frame.feet === 'tuck' ? py : baseY
    drawGrid(canvas, [FEET[frame.feet]], px, feetY + 14 * scale, scene.palette, { scale, isFlipped })
  }
  drawFace(canvas, scene, frame, px, py, scale, scene.clock < scene.blinkUntil)
  const hat = look.hat === undefined ? undefined : HATS[look.hat]
  if (hat !== undefined) {
    drawGrid(canvas, hat.grid, px + hat.dx * scale, py + (hat.dy + art.hatDy) * scale, scene.palette, { scale })
  }
  const neck = look.neck === undefined ? undefined : NECKS[look.neck]
  if (neck !== undefined) {
    drawGrid(canvas, neck.grid, px + neck.dx * scale, py + neck.dy * scale - 3 * scale, scene.palette, { scale })
  }
  drawArms(canvas, scene, frame.arms, px, py, scale)
  drawHammer(canvas, scene, frame.hammer, px, py, scale)
}

const critterGrid = (critter: { stand: Grid; step: Grid; fur: string }, pose: Pose, isMoving: boolean, clock: number): Grid => {
  if (pose === 'sleep') {
    return critter.stand.slice(0, -1).map(row => row.replaceAll('e', critter.fur))
  }
  if (isMoving) {
    return cycle(clock, 140, 2) === 0 ? critter.stand : critter.step
  }
  return pose === 'sit' || pose === 'full' ? critter.stand.slice(0, -1) : critter.stand
}

const paintCritter = (canvas: Canvas, scene: Scene, pose: Pose, x: number, groundY: number, dir: 1 | -1, isMoving: boolean, scale: number): void => {
  const critter = scene.look.critter === undefined ? undefined : CRITTERS[scene.look.critter]
  if (critter === undefined) {
    return
  }
  const grid = critterGrid(critter, pose, isMoving, scene.clock)
  drawGrid(canvas, grid, x, groundY - grid.length * scale, scene.palette, { scale, isFlipped: dir < 0 })
}

const EFFECT_GRIDS: Readonly<Record<EffectKind, (age: number) => Grid>> = {
  z: () => ZZZ,
  heart: () => HEART,
  star: () => STAR,
  coin: () => COIN,
  sparkle: () => SPARKLE,
  note: () => NOTE,
  crumb: () => CRUMB,
  leaf: age => LEAF[cycle(age, 400, 2)] ?? CRUMB,
  bubble: () => BUBBLE,
  drop: () => DROP,
  'shooting-star': () => SHOOTING_STAR,
  firefly: age => FIREFLY[cycle(age, 300, 2)] ?? CRUMB,
  butterfly: age => BUTTERFLY[cycle(age, 180, 2)] ?? CRUMB,
}

const PROP_GRIDS: Readonly<Record<PropKind, (age: number) => Grid>> = {
  doll: () => DOLL,
  'doll-squashed': () => DOLL_SQUASHED,
  gift: () => GIFT,
  'gift-open': () => GIFT_OPEN,
  cup: () => CUP,
  umbrella: () => UMBRELLA,
  cloud: () => CLOUD,
  sprout: age => SPROUT[Math.min(SPROUT.length - 1, Math.floor(age / 2500))] ?? CRUMB,
  can: () => WATERING_CAN,
  bug: age => BUG[cycle(age, 200, 2)] ?? CRUMB,
}

const SHADOW_TINT = hex('#888899')

const drawVisitor = (canvas: Canvas, scene: Scene, visitor: Visitor): void => {
  const isPaused = visitor.pauseAt !== null && Math.abs(visitor.x - visitor.pauseAt) < 1
  const frame = frameOf(isPaused ? 'wave' : 'walk', scene.clock)
  const species = visitor.species === 'shadow' ? scene.look.bones.species : visitor.species
  const art = SPECIES_ART[species]
  const palette = visitor.species === 'shadow' ? scene.palette : paletteOf(species)
  const options: DrawOptions = visitor.species === 'shadow' ? { tint: SHADOW_TINT, isFlipped: visitor.dir < 0 } : { isFlipped: visitor.dir < 0 }
  const y = 1 + frame.dy
  drawGrid(canvas, art.body, visitor.x, y, palette, options)
  if (art.isFloating !== true) {
    drawGrid(canvas, [FEET[frame.feet]], visitor.x, 15, palette, options)
  }
  if (visitor.species !== 'shadow') {
    drawGrid(canvas, ['we', 'ee'], visitor.x + art.face.leftEye[0], y + art.face.leftEye[1], palette)
    drawGrid(canvas, ['we', 'ee'], visitor.x + art.face.rightEye[0], y + art.face.rightEye[1], palette)
    drawGrid(canvas, ['mm'], visitor.x + art.face.mouth[0], y + art.face.mouth[1], palette)
  }
}

export const paint = (scene: Scene, canvas: Canvas): void => {
  clear(canvas)
  for (const prop of scene.props) {
    drawGrid(canvas, PROP_GRIDS[prop.kind](scene.clock - prop.born), prop.x, prop.y, scene.palette)
  }
  for (const visitor of scene.visitors) {
    drawVisitor(canvas, scene, visitor)
  }
  const pose = scene.current?.pose ?? 'idle'
  paintCritter(canvas, scene, pose, Math.round(scene.follower.x), canvas.height, scene.follower.dir, scene.follower.isMoving, 1)
  paintPet(canvas, scene, pose, scene.clock - scene.stepAt, Math.round(scene.x), 1, 1)
  for (const effect of scene.effects) {
    drawGrid(canvas, EFFECT_GRIDS[effect.kind](scene.clock - effect.born), effect.x, effect.y, scene.palette)
  }
}

export const paintRoom = (scene: Scene, canvas: Canvas, items: readonly string[]): void => {
  clear(canvas)
  const floor = canvas.height - 3
  const floorColor = hex('#CCBBAA')
  for (let x = 0; x < canvas.width; x += 1) {
    setPixel(canvas, x, floor + 2, floorColor)
  }
  if (items.includes('rug')) {
    drawGrid(canvas, ROOM_PROPS.rug ?? [], Math.round(canvas.width / 2 - 18), floor, scene.palette, { scale: 2 })
  }
  if (items.includes('plant')) {
    drawGrid(canvas, ROOM_PROPS.plant ?? [], 3, floor - 8, scene.palette, { scale: 2 })
  }
  if (items.includes('lamp')) {
    drawGrid(canvas, ROOM_PROPS.lamp ?? [], canvas.width - 14, floor - 10, scene.palette, { scale: 2 })
  }
  const pose = scene.current?.pose === 'sleep' ? 'sleep' : scene.look.mood === 'excited' ? 'dance' : 'idle'
  const petX = Math.round(canvas.width / 2 - PET_WIDTH)
  paintPet(canvas, scene, pose, scene.clock, petX, floor - 30, 2)
  paintCritter(canvas, scene, pose === 'sleep' ? 'sleep' : 'sit', petX + PET_WIDTH * 2 + 4, floor + 2, -1, false, 2)
}
