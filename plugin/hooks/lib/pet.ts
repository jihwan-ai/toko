import type { TokoBones, TokoGrowth, TokoPet, TokoRarity, TokoSoul, TokoStage, TokoTraits } from '../../types'

import { createRandom, pick, pickWeighted } from './random'

const RARITY_WEIGHTS: readonly { item: TokoRarity; weight: number }[] = [
  { item: 'common', weight: 60 },
  { item: 'uncommon', weight: 25 },
  { item: 'rare', weight: 10 },
  { item: 'epic', weight: 4 },
  { item: 'legendary', weight: 1 },
]

export const RARITY_LABEL: Readonly<Record<TokoRarity, string>> = {
  common: '보통',
  uncommon: '드묾',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
}

export const STAGE_LABEL: Readonly<Record<TokoStage, string>> = {
  egg: '알',
  baby: '아기',
  child: '어린이',
  adult: '어른',
}

export const COLOR_LABEL = { honey: '꿀', mint: '민트', peach: '복숭아', lavender: '라벤더' } as const

export const UNNAMED = '이름 없음'

export const createBones = (seed: number): TokoBones => {
  const random = createRandom(seed)
  return {
    seed,
    color: pick(random, ['honey', 'mint', 'peach', 'lavender'] as const),
    pattern: pick(random, ['plain', 'spots', 'stripe'] as const),
    eyes: pick(random, ['round', 'dot', 'sparkle'] as const),
    rarity: pickWeighted(random, RARITY_WEIGHTS) ?? 'common',
  }
}

const FALLBACK_SOULS: readonly Omit<TokoSoul, 'hatchedAt' | 'isFallback' | 'traits' | 'isNamed'>[] = [
  { name: '말랑', personality: '느긋하고 다정해서 같이 있으면 숨이 고르게 쉬어지는 아이', quirk: '말끝에 "말랑~"을 붙인다' },
  { name: '토실', personality: '먹는 걸 좋아하고 작은 일에도 크게 기뻐하는 아이', quirk: '기쁘면 "냠냠"이라고 한다' },
  { name: '콩떡', personality: '조용히 곁을 지키다 필요할 때 한마디 건네는 아이', quirk: '생각할 때 "음…"을 길게 뺀다' },
  { name: '보들', personality: '걱정이 조금 많지만 그만큼 세심하게 챙기는 아이', quirk: '"괜찮아?"를 자주 묻는다' },
  { name: '몽실', personality: '장난을 좋아하고 분위기를 가볍게 만드는 아이', quirk: '신나면 "몽!" 하고 튄다' },
]

export const createTraits = (seed: number): TokoTraits => {
  const random = createRandom(seed ^ 0x9e3779b9)
  const roll = () => Math.round((0.2 + random() * 0.6) * 100) / 100
  return { energetic: roll(), chatty: roll(), worried: roll(), playful: roll() }
}

export const createFallbackSoul = (seed: number, hatchedAt: string): TokoSoul => {
  const random = createRandom(seed ^ 0x51ed270b)
  return { ...pick(random, FALLBACK_SOULS), traits: createTraits(seed), hatchedAt, isFallback: true, isNamed: false }
}

export const isAwaitingName = (pet: TokoPet | null): boolean => pet?.soul?.isNamed === false

export const nameOf = (pet: TokoPet | null): string | null => {
  const soul = pet?.soul
  return soul === null || soul === undefined || soul.isNamed === false ? null : soul.name
}

export const createPet = (seed: number, day: string): TokoPet => ({
  bones: createBones(seed),
  soul: null,
  growth: { stage: 'egg', daysTogether: 0, breaksAccepted: 0, lastDay: day },
})

export const nextStage = (growth: TokoGrowth): TokoStage => {
  if (growth.stage === 'baby' && growth.daysTogether >= 3 && growth.breaksAccepted >= 3) {
    return 'child'
  }
  if (growth.stage === 'child' && growth.daysTogether >= 10 && growth.breaksAccepted >= 12) {
    return 'adult'
  }
  return growth.stage
}

export const advanceDay = (growth: TokoGrowth, day: string): TokoGrowth =>
  growth.lastDay === day ? growth : { ...growth, daysTogether: growth.daysTogether + 1, lastDay: day }

export const clampName = (name: string): string => {
  const word = name.trim().split(/\s+/)[0] ?? ''
  return [...word].slice(0, 12).join('')
}
