import type { TokoBones, TokoGrowth, TokoPet, TokoRarity, TokoSoul, TokoSpecies, TokoStage, TokoTraits } from '../../types'

import type { Random } from './random'
import { createRandom, pick, pickWeighted } from './random'

export const RARITY_WEIGHTS: readonly { item: TokoRarity; weight: number }[] = [
  { item: 'normal', weight: 90 },
  { item: 'rare', weight: 10 },
]

export const RARITY_LABEL: Readonly<Record<TokoRarity, string>> = {
  normal: '노말',
  rare: '레어',
}

export const STAGE_LABEL: Readonly<Record<TokoStage, string>> = {
  egg: '알',
  baby: '아기',
  child: '어린이',
  adult: '어른',
}

export const SPECIES: Readonly<Record<TokoSpecies, { label: string; rarity: TokoRarity }>> = {
  cat: { label: '고양이', rarity: 'normal' },
  bear: { label: '곰', rarity: 'normal' },
  chick: { label: '병아리', rarity: 'normal' },
  bunny: { label: '토끼', rarity: 'normal' },
  frog: { label: '개구리', rarity: 'normal' },
  penguin: { label: '펭귄', rarity: 'normal' },
  fox: { label: '여우', rarity: 'normal' },
  dragon: { label: '용', rarity: 'normal' },
  unicorn: { label: '유니콘', rarity: 'rare' },
  ghost: { label: '유령', rarity: 'rare' },
  phoenix: { label: '불사조', rarity: 'rare' },
  robot: { label: '로봇', rarity: 'rare' },
  axolotl: { label: '우파루파', rarity: 'rare' },
}

export const UNNAMED = '이름 없음'

export const SPECIES_IDS = Object.keys(SPECIES) as TokoSpecies[]

export const isSpecies = (value: unknown): value is TokoSpecies => typeof value === 'string' && value in SPECIES

export const rarityOf = (bones: TokoBones): TokoRarity => SPECIES[bones.species].rarity

export const rollSpecies = (random: Random): TokoSpecies => {
  const rarity = pickWeighted(random, RARITY_WEIGHTS) ?? 'normal'
  return pick(random, SPECIES_IDS.filter(species => SPECIES[species].rarity === rarity))
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

export const createPet = (seed: number, day: string, species: TokoSpecies = 'cat'): TokoPet => ({
  id: `pet-${seed.toString(36)}`,
  bones: { seed, species },
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

export const upgradePet = (pet: TokoPet): TokoPet => ({
  ...pet,
  id: typeof pet.id === 'string' ? pet.id : `pet-${pet.bones.seed.toString(36)}`,
  bones: { seed: pet.bones.seed, species: isSpecies(pet.bones.species) ? pet.bones.species : 'cat' },
})
