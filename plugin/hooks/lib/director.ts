import type { TokoSpecies } from '../../types'

import type { Random } from './random'
import { pickWeighted } from './random'
import type { Scene, Step } from './scene'
import { PET_WIDTH, addVisitor, centerX, placeProp, removeProp, rightX, spawn } from './scene'
import type { EncounterKind, IdleAction } from './sim'

export const PRIORITY = { idle: 0, reaction: 1, encounter: 2, event: 3, show: 4 } as const

export const idlePlan = (scene: Scene, random: Random, weights: readonly { item: IdleAction; weight: number }[]): Step[] => {
  if (scene.look.stage === 'egg') {
    return [{ pose: 'egg', ms: 1500 }, { pose: 'egg-wobble', ms: 500 }]
  }
  const action = pickWeighted(random, weights) ?? 'walk'
  const span = Math.max(0, scene.width - PET_WIDTH)
  switch (action) {
    case 'walk':
      return [{ pose: 'walk', ms: 0, toX: Math.round(random() * span) }, { pose: 'idle', ms: 1500 + random() * 2500 }]
    case 'sit':
      return [{ pose: 'sit', ms: 3000 + random() * 4000 }]
    case 'yawn':
      return [{ pose: 'yawn', ms: 1200 }, { pose: 'idle', ms: 1500 }]
    case 'nap':
      return [{ pose: 'sleep', ms: 8000 + random() * 8000 }]
    case 'look':
      return [{ pose: 'look', ms: 2500, dir: 1 }]
    case 'hop':
      return [{ pose: 'jump', ms: 650 }, { pose: 'idle', ms: 1200 }]
  }
}

const spawnCoins = (scene: Scene, count: number): void => {
  for (let index = 0; index < count; index += 1) {
    spawn(scene, 'coin', scene.x + 6 + index * 2, 6, (index - count / 2) * 3, -14, 900, 30)
  }
}

export const hatch = (onDone: () => void): Step[] => [
  { pose: 'egg-wobble', ms: 1600 },
  { pose: 'egg', ms: 400 },
  { pose: 'egg-wobble', ms: 1200 },
  { pose: 'egg-crack', ms: 900 },
  { pose: 'egg-crack', ms: 300, enter: scene => spawn(scene, 'sparkle', scene.x + 6, 3, 0, 0, 600) },
  { pose: 'jump', ms: 650, enter: () => onDone() },
  { pose: 'wave', ms: 1600 },
]

export const earnCoins = (count: number): Step[] => [{ pose: 'jump', ms: 650, enter: scene => spawnCoins(scene, Math.min(5, Math.max(1, Math.round(count / 3)))) }]

export const enter = (scene: Scene, then: readonly Step[]): Step[] => {
  const target = centerX(scene)
  const startX = scene.x
  const isAway = startX <= -PET_WIDTH || startX >= scene.width
  const walkIn: Step[] = isAway ? [{ pose: 'run', ms: 0, toX: target }] : [{ pose: 'run', ms: 0, toX: target, speed: 18 }]
  return [...walkIn, { pose: 'idle', ms: 300 }, ...then]
}

export const exit = (scene: Scene): Step[] => {
  const toLeft = scene.x < scene.width / 2
  return [{ pose: 'walk', ms: 0, toX: toLeft ? -PET_WIDTH - 1 : scene.width + 1 }, { pose: 'hidden', ms: 4000 }, { pose: 'walk', ms: 0, toX: centerX(scene) }]
}

export const greet = (): Step[] => [{ pose: 'wave', ms: 1500 }, { pose: 'idle', ms: 800 }]

export const perk = (): Step[] => [{ pose: 'look', ms: 1200, dir: 1 }]

export const feed = (): Step[] => [
  { pose: 'look', ms: 300 },
  { pose: 'eat', ms: 1800, enter: scene => spawn(scene, 'crumb', scene.x + 8, 9, 2, -4, 700, 20) },
  { pose: 'jump', ms: 650 },
  { pose: 'idle', ms: 800 },
]

export const play = (): Step[] => [
  { pose: 'jump', ms: 650, enter: scene => spawn(scene, 'bubble', scene.x + 17, 3, 2, -2, 1400) },
  { pose: 'run', ms: 0, toX: 0 },
  { pose: 'jump', ms: 650 },
  { pose: 'dance', ms: 1800 },
  { pose: 'idle', ms: 600 },
]

export const celebrate = (): Step[] => [
  { pose: 'jump', ms: 650, enter: scene => spawn(scene, 'star', scene.x + 6, 0, 0, -3, 900) },
  { pose: 'jump', ms: 650 },
  { pose: 'dance', ms: 1500 },
]

export const flag = (): Step[] => [{ pose: 'wave', ms: 2200, enter: scene => spawn(scene, 'star', scene.x + 17, 2, 0, -2, 1000) }, { pose: 'idle', ms: 600 }]

export const worry = (): Step[] => [{ pose: 'cower', ms: 900 }, { pose: 'look', ms: 1500, dir: 1 }]

export const flinch = (): Step[] => [{ pose: 'cower', ms: 600 }]

export const full = (): Step[] => [{ pose: 'full', ms: 5000 }]

export const stretch = (): Step[] => [{ pose: 'stretch', ms: 4000 }, { pose: 'jump', ms: 650 }]

export const eyeRest = (ms: number): Step[] => [{ pose: 'look', ms, dir: -1 }]

export const water = (): Step[] => [
  { pose: 'idle', ms: 200, enter: scene => placeProp(scene, 'cup', 'cup', scene.x + 16, 10, 4000) },
  { pose: 'eat', ms: 2500 },
  { pose: 'idle', ms: 800, enter: scene => removeProp(scene, 'cup') },
]

export const nap = (): Step[] => [{ pose: 'yawn', ms: 1200 }, { pose: 'sleep', ms: 6000 }]

export const breathe = (rounds: number): Step[] =>
  Array.from({ length: rounds }, () => [
    { pose: 'breathe-in' as const, ms: 4000 },
    { pose: 'breathe-out' as const, ms: 6000 },
  ]).flat()

export const giftDrop = (): Step[] => [
  { pose: 'look', ms: 600, enter: scene => placeProp(scene, 'gift', 'gift', scene.x + 18, 12, 120_000) },
  { pose: 'jump', ms: 650 },
]

export const giftOpen = (): Step[] => [
  { pose: 'idle', ms: 500, enter: scene => placeProp(scene, 'gift', 'gift-open', scene.x + 18, 12, 1500) },
  {
    pose: 'jump',
    ms: 650,
    enter: scene => {
      spawn(scene, 'sparkle', scene.x + 19, 6, -2, -3, 700)
      spawn(scene, 'sparkle', scene.x + 22, 7, 2, -3, 700)
    },
  },
  { pose: 'proud', ms: 1200 },
]

export const apologyAccepted = (): Step[] => [
  { pose: 'look', ms: 900, dir: -1 },
  {
    pose: 'idle',
    ms: 1500,
    dir: 1,
    enter: scene => {
      spawn(scene, 'heart', scene.x + 3, 2, -1, -3, 1500)
      spawn(scene, 'heart', scene.x + 7, 0, 0, -3, 1500)
      spawn(scene, 'heart', scene.x + 11, 2, 1, -3, 1500)
    },
  },
]

export const bonk = (scene: Scene, isTurnRunning: boolean, onHit: () => void): Step[] => {
  const dollX = scene.width - 10
  const target = isTurnRunning ? rightX(scene) + 6 : dollX - PET_WIDTH - 2
  return [
    {
      pose: 'run',
      ms: 0,
      toX: Math.max(0, target),
      speed: 30,
      enter: s => {
        if (!isTurnRunning) {
          placeProp(s, 'doll', 'doll', dollX, 9, 9000)
        }
      },
    },
    { pose: 'windup', ms: 400, dir: 1 },
    {
      pose: 'strike',
      ms: 200,
      enter: s => {
        onHit()
        if (!isTurnRunning) {
          placeProp(s, 'doll', 'doll-squashed', dollX, 9, 6000)
        }
        for (let index = 0; index < 3; index += 1) {
          spawn(s, 'star', dollX - 2 + index * 3, 3 - index, (index - 1) * 6, -6, 1100)
        }
      },
    },
    { pose: 'recoil', ms: 800 },
    { pose: 'proud', ms: 1500 },
  ]
}

export const ENCOUNTER_MS = 9000

export const encounter = (scene: Scene, kind: EncounterKind, random: Random): Step[] => {
  const width = scene.width
  switch (kind) {
    case 'butterfly':
      return [
        { pose: 'look', ms: 800, enter: s => spawn(s, 'butterfly', -5, 2, 9, 0.6, 9000) },
        { pose: 'walk', ms: 0, toX: Math.min(width - PET_WIDTH, Math.round(width * 0.6)) },
        { pose: 'jump', ms: 650 },
        { pose: 'idle', ms: 1200 },
      ]
    case 'leaves':
      return [
        {
          pose: 'look',
          ms: 600,
          enter: s => {
            for (let index = 0; index < 5; index += 1) {
              spawn(s, 'leaf', random() * width, -2 - index * 3, (random() - 0.5) * 4, 2.5, 7000)
            }
          },
        },
        { pose: 'sit', ms: 5500 },
      ]
    case 'crumb':
      return [
        { pose: 'look', ms: 500, enter: s => spawn(s, 'crumb', s.x + PET_WIDTH + 6, 0, 0, 0, 3000, 18) },
        { pose: 'walk', ms: 0, toX: Math.min(width - PET_WIDTH, scene.x + 8) },
        { pose: 'eat', ms: 1400 },
        { pose: 'jump', ms: 650 },
      ]
    case 'bubbles':
      return [
        {
          pose: 'breathe-in',
          ms: 1500,
        },
        {
          pose: 'breathe-out',
          ms: 3000,
          enter: s => {
            for (let index = 0; index < 4; index += 1) {
              spawn(s, 'bubble', s.x + 15, 8, 3 + index * 1.5, -1.5 - index * 0.4, 5000)
            }
          },
        },
        { pose: 'idle', ms: 1500 },
      ]
    case 'shooting-star':
      return [
        { pose: 'look', ms: 2500, dir: 1, enter: s => spawn(s, 'shooting-star', width * 0.2, 0, 14, 2.5, 2200) },
        { pose: 'breathe-in', ms: 1800 },
        { pose: 'idle', ms: 1000 },
      ]
    case 'rain':
      return [
        {
          pose: 'look',
          ms: 600,
          enter: s => {
            placeProp(s, 'cloud', 'cloud', -7, 0, 9000, 5)
            for (let index = 0; index < 10; index += 1) {
              spawn(s, 'drop', random() * width * 0.6, 3 + random() * 2, 3, 6, 1500 + index * 500)
            }
          },
        },
        { pose: 'idle', ms: 5000, enter: s => placeProp(s, 'umbrella', 'umbrella', s.x + 14, 0, 5500) },
        { pose: 'idle', ms: 800 },
      ]
    case 'sprout':
      return [
        { pose: 'walk', ms: 0, toX: Math.max(0, width - PET_WIDTH - 12), enter: s => placeProp(s, 'sprout', 'sprout', width - 9, 11, 12_000) },
        { pose: 'idle', ms: 5000, dir: 1, enter: s => placeProp(s, 'can', 'can', s.x + 14, 6, 5000) },
        { pose: 'jump', ms: 650 },
      ]
    case 'firefly':
      return [
        {
          pose: 'look',
          ms: 600,
          enter: s => {
            for (let index = 0; index < 3; index += 1) {
              spawn(s, 'firefly', random() * width, 2 + random() * 8, (random() - 0.5) * 3, (random() - 0.5) * 1.5, 8000)
            }
          },
        },
        { pose: 'sit', ms: 6000 },
      ]
  }
}

export const shimmer = (): Step[] => [
  {
    pose: 'look',
    ms: 700,
    enter: s => {
      for (let index = 0; index < 5; index += 1) {
        spawn(s, 'sparkle', Math.round((s.width / 6) * (index + 1)), 1 + (index % 3), 0, -0.5, 2200)
      }
    },
  },
]

export const friendVisit = (friendId: string, species: TokoSpecies): Step[] => [
  { pose: 'look', ms: 600, enter: s => addVisitor(s, friendId, species, 14_000, 2500) },
  { pose: 'idle', ms: 1800 },
  { pose: 'wave', ms: 2000 },
  { pose: 'jump', ms: 650, enter: s => spawn(s, 'heart', s.x + 7, 0, 0, -3, 1400) },
  { pose: 'idle', ms: 1500 },
]

export const subagentShadows = (count: number): Step[] => [
  {
    pose: 'look',
    ms: 600,
    enter: s => {
      for (let index = 0; index < Math.min(2, count); index += 1) {
        addVisitor(s, `shadow-${index}`, 'shadow', 9000)
      }
    },
  },
]

export const groupStretch = (species: readonly TokoSpecies[]): Step[] => [
  {
    pose: 'stretch',
    ms: 5000,
    enter: s => {
      for (const [index, kind] of species.slice(0, 2).entries()) {
        addVisitor(s, `stretch-${index}`, kind, 9000, 5000)
      }
    },
  },
  { pose: 'jump', ms: 650, enter: s => spawn(s, 'heart', s.x + 7, 0, 0, -3, 1200) },
]
