import type { TokoMemoryEvent, TokoMood, TokoNeeds, TokoTraits } from '../../types'

import { MINUTE } from './time'

export type NeedKey = 'energy' | 'fun' | 'hunger' | 'social'

export const fullNeeds = (now: number): TokoNeeds => ({ energy: 80, fun: 70, hunger: 70, social: 70, updatedAt: now })

const DECAY_PER_MINUTE: Readonly<Record<NeedKey, number>> = { energy: 0.25, fun: 0.4, hunger: 0.35, social: 0.3 }

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value * 10) / 10))

export const decayNeeds = (needs: TokoNeeds, now: number, isPresent: boolean): TokoNeeds => {
  const minutes = Math.max(0, (now - needs.updatedAt) / MINUTE)
  if (!isPresent || minutes === 0) {
    return { ...needs, updatedAt: now }
  }
  const step = Math.min(minutes, 30)
  return {
    energy: clamp(needs.energy - DECAY_PER_MINUTE.energy * step),
    fun: clamp(needs.fun - DECAY_PER_MINUTE.fun * step),
    hunger: clamp(needs.hunger - DECAY_PER_MINUTE.hunger * step),
    social: clamp(needs.social - DECAY_PER_MINUTE.social * step),
    updatedAt: now,
  }
}

export const restore = (needs: TokoNeeds, change: Partial<Record<NeedKey, number>>): TokoNeeds => ({
  energy: clamp(needs.energy + (change.energy ?? 0)),
  fun: clamp(needs.fun + (change.fun ?? 0)),
  hunger: clamp(needs.hunger + (change.hunger ?? 0)),
  social: clamp(needs.social + (change.social ?? 0)),
  updatedAt: needs.updatedAt,
})

const HAPPY_KINDS = new Set(['test-pass', 'commit', 'push', 'pr', 'gift', 'apologize', 'fed', 'played', 'break-done', 'friend-wave', 'badge'])

const isRecentFailure = (event: TokoMemoryEvent, now: number): boolean =>
  event.kind === 'test-fail' && now - event.at <= 10 * MINUTE

export const moodOf = (needs: TokoNeeds, events: readonly TokoMemoryEvent[], now: number, hour: number, bonksToday: number): TokoMood => {
  const recent = events.filter(event => now - event.at <= 3 * MINUTE)
  if (recent.some(event => HAPPY_KINDS.has(event.kind))) {
    return 'excited'
  }
  if (events.filter(event => isRecentFailure(event, now)).length >= 2 || bonksToday >= 3) {
    return 'worried'
  }
  if (needs.energy < 30 || (hour >= 1 && hour < 6)) {
    return 'sleepy'
  }
  if (needs.social < 20) {
    return 'sulky'
  }
  return 'calm'
}

export type OfferKind =
  | 'stretch'
  | 'eye-rest'
  | 'water'
  | 'nap'
  | 'briefing'
  | 'unstick'
  | 'wrapup'
  | 'gift'
  | 'bugs'
  | 'chat'
  | 'calm-down'
  | 'plaza-stretch'
  | 'focus-break'

export const OFFER_KINDS: readonly OfferKind[] = ['stretch', 'eye-rest', 'water', 'nap', 'briefing', 'unstick', 'wrapup', 'gift', 'bugs', 'chat', 'calm-down', 'plaza-stretch', 'focus-break']

export const BREAK_KINDS: ReadonlySet<string> = new Set(['stretch', 'eye-rest', 'water', 'nap', 'unstick', 'calm-down', 'plaza-stretch', 'focus-break'])

export type SimContext = {
  now: number
  hour: number
  needs: TokoNeeds
  traits: TokoTraits
  breakMinutes: number
  workingMinutes: number
  minutesSinceEyeRest: number
  minutesSinceWater: number
  minutesSinceChat: number
  waterToday: number
  giftsToday: number
  giftQuota: number
  failStreak: number
  minutesSincePassAfterFail: number | null
  bonksToday: number
  hasCalmedToday: boolean
  awayMinutes: number
  hasWorkMemory: boolean
  offWorkHour: number | null
  hasWrappedToday: boolean
  rateLimitPercent: number
  friendsOnline: number
  kindScale: Readonly<Record<string, number>>
  luck: number
}

export type Candidate = { kind: OfferKind; score: number; description: string }

type Rule = {
  kind: OfferKind
  description: string
  isEligible: (context: SimContext) => boolean
  adverts: Partial<Record<NeedKey, number>>
  situation: (context: SimContext) => number
  trait: keyof TokoTraits | null
}

const RULES: readonly Rule[] = [
  {
    kind: 'stretch',
    description: '오래 앉아 있었으니 같이 기지개',
    isEligible: c => c.workingMinutes >= c.breakMinutes,
    adverts: { energy: 30, fun: 10 },
    situation: c => 1 + (c.workingMinutes - c.breakMinutes) / 30,
    trait: 'worried',
  },
  {
    kind: 'eye-rest',
    description: '20초 동안 먼 곳 보기',
    isEligible: c => c.minutesSinceEyeRest >= 20,
    adverts: { energy: 15 },
    situation: () => 0.8,
    trait: 'worried',
  },
  {
    kind: 'water',
    description: '물 한 모금',
    isEligible: c => c.waterToday < 3 && c.minutesSinceWater >= 90,
    adverts: { energy: 10, hunger: 5 },
    situation: () => 0.9,
    trait: 'worried',
  },
  {
    kind: 'nap',
    description: '오늘은 많이 썼으니 일찍 쉬기',
    isEligible: c => c.rateLimitPercent >= 80 || c.hour >= 23 || c.hour < 5,
    adverts: { energy: 40 },
    situation: () => 1.2,
    trait: null,
  },
  {
    kind: 'briefing',
    description: '자리 비운 사이 하던 일 한 줄로 짚기',
    isEligible: c => c.awayMinutes >= 10 && c.hasWorkMemory,
    adverts: { social: 25 },
    situation: () => 2,
    trait: 'chatty',
  },
  {
    kind: 'unstick',
    description: '같은 테스트에서 막혔으니 잠깐 일어났다 오기',
    isEligible: c => c.failStreak >= 3,
    adverts: { energy: 20, fun: 10 },
    situation: c => 1.5 + c.failStreak / 2,
    trait: 'worried',
  },
  {
    kind: 'wrapup',
    description: '오늘 한 일 세 줄 정리',
    isEligible: c => c.offWorkHour !== null && c.hour >= c.offWorkHour && !c.hasWrappedToday,
    adverts: { social: 20, energy: 20 },
    situation: () => 2,
    trait: 'chatty',
  },
  {
    kind: 'gift',
    description: '깜짝 선물 상자',
    isEligible: c => c.giftsToday < c.giftQuota && c.luck < 0.15,
    adverts: { fun: 20, social: 10 },
    situation: () => 1,
    trait: 'playful',
  },
  {
    kind: 'bugs',
    description: '테스트 통과 기념 벌레 잡기 30초',
    isEligible: c => c.minutesSincePassAfterFail !== null && c.minutesSincePassAfterFail <= 3,
    adverts: { fun: 40 },
    situation: () => 2,
    trait: 'playful',
  },
  {
    kind: 'chat',
    description: '오늘 있었던 일에 한마디',
    isEligible: c => c.minutesSinceChat >= 45 && c.needs.social < 55,
    adverts: { social: 30 },
    situation: () => 1,
    trait: 'chatty',
  },
  {
    kind: 'calm-down',
    description: 'Claude랑 많이 싸웠으니 물 한 잔과 숨 고르기',
    isEligible: c => c.bonksToday >= 3 && !c.hasCalmedToday,
    adverts: { energy: 20, social: 20 },
    situation: () => 3,
    trait: 'worried',
  },
  {
    kind: 'plaza-stretch',
    description: '광장 친구들과 다 같이 기지개',
    isEligible: c => c.friendsOnline >= 1 && c.workingMinutes >= c.breakMinutes * 0.6,
    adverts: { social: 30, energy: 20 },
    situation: () => 1.5,
    trait: 'energetic',
  },
]

const deficit = (value: number): number => 0.15 + ((100 - value) / 100) ** 2

export const traitScale = (traits: TokoTraits, trait: keyof TokoTraits | null): number =>
  trait === null ? 1 : 0.6 + traits[trait] * 0.8

const scoreOf = (rule: Rule, context: SimContext): number => {
  const need = (Object.entries(rule.adverts) as [NeedKey, number][]).reduce(
    (sum, [key, advert]) => sum + deficit(context.needs[key]) * advert,
    0,
  )
  const learned = context.kindScale[rule.kind] ?? 1
  return Math.round(need * rule.situation(context) * traitScale(context.traits, rule.trait) * learned * 10) / 10
}

export const candidatesOf = (context: SimContext): readonly Candidate[] =>
  RULES.filter(rule => rule.isEligible(context))
    .map(rule => ({ kind: rule.kind, score: scoreOf(rule, context), description: rule.description }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)

export type IdleAction = 'walk' | 'sit' | 'yawn' | 'nap' | 'look' | 'hop'

export const idleWeights = (needs: TokoNeeds, traits: TokoTraits, mood: TokoMood): readonly { item: IdleAction; weight: number }[] => [
  { item: 'walk', weight: 2 + traits.energetic * 4 + needs.energy / 50 },
  { item: 'sit', weight: 2 + (100 - needs.energy) / 30 },
  { item: 'yawn', weight: mood === 'sleepy' ? 3 : 0.6 },
  { item: 'nap', weight: mood === 'sleepy' ? 4 : needs.energy < 40 ? 1.5 : 0.2 },
  { item: 'look', weight: 1 + traits.worried * 3 },
  { item: 'hop', weight: mood === 'excited' ? 4 : traits.playful * 1.5 },
]

export type EncounterKind = 'butterfly' | 'leaves' | 'crumb' | 'bubbles' | 'shooting-star' | 'rain' | 'sprout' | 'firefly'

export const ENCOUNTER_LINES: Readonly<Record<EncounterKind, readonly string[]>> = {
  butterfly: ['나비다… 잠깐만 따라가 볼게', '팔랑팔랑'],
  leaves: ['잎이 떨어지네. 천천히 숨 한 번', '바스락'],
  crumb: ['토큰 부스러기 발견! 냠', '아껴 먹어야지'],
  bubbles: ['비눗방울 후— 하나, 둘, 셋', '퐁, 퐁'],
  'shooting-star': ['별똥별이다. 소원 하나 빌어', '반짝'],
  rain: ['비구름이 지나가. 우산 써야지', '토독토독'],
  sprout: ['새싹에 물 주는 중. 너도 물 한 모금 어때', '쑥쑥 자라라'],
  firefly: ['반딧불이야. 눈을 잠깐 쉬어 봐', '깜빡깜빡'],
}

export type EncounterContext = { hour: number; mood: TokoMood; isWorking: boolean; minutesSinceEncounter: number; luck: number }

export const encounterOf = (context: EncounterContext): readonly { item: EncounterKind; weight: number }[] => {
  if (context.minutesSinceEncounter < 6) {
    return []
  }
  const isNight = context.hour >= 19 || context.hour < 6
  return [
    { item: 'butterfly' as const, weight: isNight ? 0 : 3 },
    { item: 'leaves' as const, weight: 2 },
    { item: 'crumb' as const, weight: context.isWorking ? 2 : 1 },
    { item: 'bubbles' as const, weight: context.mood === 'worried' ? 3 : 1.5 },
    { item: 'shooting-star' as const, weight: isNight ? 2 : 0 },
    { item: 'rain' as const, weight: 1 },
    { item: 'sprout' as const, weight: context.isWorking ? 0.5 : 1.5 },
    { item: 'firefly' as const, weight: isNight ? 2.5 : 0 },
  ].filter(entry => entry.weight > 0)
}
