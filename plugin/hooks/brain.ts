import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type {
  TokoBudget,
  TokoChoice,
  TokoEarn,
  TokoEarning,
  TokoFriend,
  TokoGame,
  TokoMemory,
  TokoMood,
  TokoNeeds,
  TokoOffer,
  TokoPet,
  TokoSettings,
  TokoSoul,
  TokoWallet,
} from '../types'


import * as direct from './lib/director'
import { PRIORITY } from './lib/director'
import { HEALTH_REWARD, SPEND, balanceOf, buy, earnBalance, capTokenIncome, earnedTokenToday, emptyEarn, shopItem, takeSnack, turnIncome, wear, wornOf } from './lib/economy'
import type { TurnUsage } from './lib/economy'
import { OFFER_TIMEOUT_MS, canAnimateQuietly, canNotify, canSpeak, emptyBudget, gateCandidates, isGap, isQuietNow, learnAnswer, recordBubble, rollBudget } from './lib/gate'
import type { Answer } from './lib/gate'
import { advanceDay, clampName, createFallbackSoul, createPet, nextStage } from './lib/pet'
import * as persona from './lib/persona'
import { DAILY_AI_CALLS, OFFER_FALLBACK, REACTION_FALLBACK, fallbackLine } from './lib/persona'
import { FRIEND_TTL_MS, PLAZA_POLL_MS, eventText, isForMe, parseSnapshot, plazaEndpoint } from './lib/plaza'
import type { PlazaAction, PlazaEvent, PlazaStatus } from './lib/plaza'
import type { Random } from './lib/random'
import { createRandom, pick, pickWeighted } from './lib/random'
import type { Look, Scene, Step } from './lib/scene'
import { PET_WIDTH, createScene, isBusy, perform, placeProp, removeProp, setLook } from './lib/scene'
import type { Candidate, OfferKind } from './lib/sim'
import { BREAK_KINDS, ENCOUNTER_LINES, candidatesOf, decayNeeds, encounterOf, fullNeeds, idleWeights, moodOf, restore } from './lib/sim'
import { HOUR, MINUTE, clockText, dayKey, hourOf } from './lib/time'

const petAtom = atom({ plugin: 'toko', key: 'pet' } as const, null)
const needsAtom = atom({ plugin: 'toko', key: 'needs' } as const, null)
const moodAtom = atom({ plugin: 'toko', key: 'mood' } as const, 'calm')
const walletAtom = atom({ plugin: 'toko', key: 'wallet' } as const, null)
const settingsAtom = atom({ plugin: 'toko', key: 'settings' } as const, null)
const bubbleAtom = atom({ plugin: 'toko', key: 'bubble' } as const, null)
const offerAtom = atom({ plugin: 'toko', key: 'offer' } as const, null)
const ouchAtom = atom({ plugin: 'toko', key: 'ouch' } as const, false)
const earningsAtom = atom({ plugin: 'toko', key: 'earnings' } as const, [])
const gameAtom = atom({ plugin: 'toko', key: 'game' } as const, null)
const countdownAtom = atom({ plugin: 'toko', key: 'countdown' } as const, null)
const plazaAtom = atom({ plugin: 'toko', key: 'plaza' } as const, null)
const lessonsAtom = atom({ plugin: 'toko', key: 'lessons' } as const, [])

type $ = EngineInterface

export const KEY = {
  pet: 'toko:pet',
  needs: 'toko:needs',
  memory: 'toko:memory',
  wallet: 'toko:wallet',
  budget: 'toko:budget',
  settings: 'toko:settings',
  plazaId: 'toko:plaza-id',
  marks: 'toko:marks',
  earnPrefix: 'toko:earn:',
} as const

export const DEFAULT_SETTINGS: TokoSettings = {
  isMuted: false,
  isHidden: false,
  quiet: null,
  breakMinutes: 50,
  offWorkHour: null,
  isAiOn: true,
  isNotifyOn: false,
  isMoodSensing: false,
  isPlazaOn: true,
}

const emptyMemory = (): TokoMemory => ({
  events: [],
  lessons: [],
  answersByHour: Array.from({ length: 24 }, () => ({ accepted: 0, declined: 0 })),
  declineStreak: {},
  kindScale: {},
  reflectedDay: '',
})

type Marks = { wrappedDay: string; calmedDay: string; firstCommitDay: string; lastEyeRestAt: number; lastWaterAt: number; lastChatAt: number }

type Countdown = { kind: string; label: string; endsAt: number; reward: number; then: 'praise' | 'unstick' | 'quiet' }

type Bonk = { reason: string; isTurnRunning: boolean; hasApology: boolean; isSubmitted: boolean }

export type Brain = {
  random: Random
  now: number
  pet: TokoPet | null
  needs: TokoNeeds
  memory: TokoMemory
  wallet: TokoWallet
  settings: TokoSettings
  budget: TokoBudget
  marks: Marks
  sessionId: string
  earn: TokoEarn
  otherEarns: readonly TokoEarn[]
  mood: TokoMood
  isLoaded: boolean
  isTurnRunning: boolean
  turnStartedAt: number
  typedDuringTurn: boolean
  longTurnStage: number
  lastTypingAt: number
  lastInputAt: number
  lastTurnEndAt: number
  workingSince: number
  returnedAway: { minutes: number; at: number } | null
  lastEncounterAt: number
  lastPassAfterFailAt: number | null
  rateLimitPercent: number
  isFullShown: boolean
  isThinking: boolean
  isHatching: boolean
  offer: TokoOffer | null
  countdown: Countdown | null
  bonk: Bonk | null
  game: TokoGame | null
  gameSpawnAt: number
  earnings: readonly TokoEarning[]
  scene: Scene | null
  isReducedMotion: boolean
  isLineMode: boolean
  serverUrl: string
  plazaId: string
  friends: readonly TokoFriend[]
  feed: readonly { at: number; text: string }[]
  lastPollAt: number
  seenEvents: readonly string[]
  isDirty: boolean
}

export const createBrain = (seed: number, serverUrl: string): Brain => ({
  random: createRandom(seed),
  now: 0,
  pet: null,
  needs: fullNeeds(0),
  memory: emptyMemory(),
  wallet: { coins: 0, items: [], worn: [] },
  settings: DEFAULT_SETTINGS,
  budget: emptyBudget(''),
  marks: { wrappedDay: '', calmedDay: '', firstCommitDay: '', lastEyeRestAt: 0, lastWaterAt: 0, lastChatAt: 0 },
  sessionId: 'local',
  earn: emptyEarn(''),
  otherEarns: [],
  mood: 'calm',
  isLoaded: false,
  isTurnRunning: false,
  turnStartedAt: 0,
  typedDuringTurn: false,
  longTurnStage: 0,
  lastTypingAt: 0,
  lastInputAt: 0,
  lastTurnEndAt: 0,
  workingSince: 0,
  returnedAway: null,
  lastEncounterAt: 0,
  lastPassAfterFailAt: null,
  rateLimitPercent: 0,
  isFullShown: false,
  isThinking: false,
  isHatching: false,
  offer: null,
  countdown: null,
  bonk: null,
  game: null,
  gameSpawnAt: 0,
  earnings: [],
  scene: null,
  isReducedMotion: false,
  isLineMode: false,
  serverUrl,
  plazaId: '',
  friends: [],
  feed: [],
  lastPollAt: 0,
  seenEvents: [],
  isDirty: false,
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const merge = <T extends object>(base: T, stored: unknown): T => (isRecord(stored) ? { ...base, ...(stored as Partial<T>) } : base)

const isPet = (value: unknown): value is TokoPet => isRecord(value) && isRecord(value.bones) && isRecord(value.growth)

const isEarn = (value: unknown): value is TokoEarn => isRecord(value) && typeof value.day === 'string' && typeof value.earned === 'number'

export const today = (brain: Brain): string => dayKey(brain.now)

export async function load($: $, brain: Brain): Promise<void> {
  const now = brain.now
  const day = dayKey(now)
  const [pet, needs, memory, wallet, budget, settings, marks, plazaId, keys] = await Promise.all([
    $.store.get(KEY.pet),
    $.store.get(KEY.needs),
    $.store.get(KEY.memory),
    $.store.get(KEY.wallet),
    $.store.get(KEY.budget),
    $.store.get(KEY.settings),
    $.store.get(KEY.marks),
    $.store.get(KEY.plazaId),
    $.store.keys(),
  ])
  brain.pet = isPet(pet) ? { ...pet, growth: advanceDay(pet.growth, day) } : null
  brain.needs = merge(fullNeeds(now), needs)
  brain.memory = merge(emptyMemory(), memory)
  brain.wallet = merge(brain.wallet, wallet)
  brain.settings = merge(DEFAULT_SETTINGS, settings)
  brain.marks = merge(brain.marks, marks)
  brain.budget = rollBudget(isRecord(budget) ? merge(emptyBudget(day), budget) : null, day)
  brain.plazaId = typeof plazaId === 'string' && plazaId.length > 0 ? plazaId : `p${Math.floor(brain.random() * 2 ** 32).toString(36)}${Math.floor(now % 1e6).toString(36)}`
  const earnKeys = keys.filter(key => key.startsWith(KEY.earnPrefix))
  const earns = await Promise.all(earnKeys.map(async key => ({ key, value: await $.store.get(key) })))
  await settleEarnings($, brain, earns, day)
  brain.earn = emptyEarn(day)
  brain.workingSince = now
  brain.lastInputAt = now
  brain.mood = moodOf(brain.needs, brain.memory.events, now, hourOf(now), brain.budget.bonks)
  brain.isLoaded = true
}

async function settleEarnings($: $, brain: Brain, earns: readonly { key: string; value: unknown }[], day: string): Promise<void> {
  const stale = earns.filter(entry => !isEarn(entry.value) || entry.value.day !== day || entry.key === `${KEY.earnPrefix}${brain.sessionId}`)
  const settled = stale.map(entry => entry.value).filter(isEarn)
  brain.wallet = { ...brain.wallet, coins: brain.wallet.coins + settled.reduce((sum, earn) => sum + earn.earned + earn.health - earn.spent, 0) }
  brain.otherEarns = earns.filter(entry => !stale.includes(entry)).map(entry => entry.value).filter(isEarn)
  for (const entry of stale) {
    await $.store.delete(entry.key)
  }
  if (stale.length > 0) {
    await $.store.set(KEY.wallet, brain.wallet)
  }
}

export async function save($: $, brain: Brain): Promise<void> {
  if (!brain.isLoaded) {
    return
  }
  await Promise.all([
    $.store.set(KEY.pet, brain.pet),
    $.store.set(KEY.needs, brain.needs),
    $.store.set(KEY.memory, brain.memory),
    $.store.set(KEY.wallet, brain.wallet),
    $.store.set(KEY.budget, brain.budget),
    $.store.set(KEY.settings, brain.settings),
    $.store.set(KEY.marks, brain.marks),
    $.store.set(KEY.plazaId, brain.plazaId),
    $.store.set(`${KEY.earnPrefix}${brain.sessionId}`, brain.earn),
  ])
  brain.isDirty = false
}

export const balance = (brain: Brain): number => balanceOf(brain.wallet, [...brain.otherEarns, brain.earn])

export async function sync($: $, brain: Brain): Promise<void> {
  await Promise.all([
    update($, petAtom, () => brain.pet),
    update($, needsAtom, () => brain.needs),
    update($, moodAtom, () => brain.mood),
    update($, walletAtom, () => ({ ...brain.wallet, coins: balance(brain) })),
    update($, settingsAtom, () => brain.settings),
    update($, offerAtom, () => brain.offer),
    update($, earningsAtom, () => brain.earnings),
    update($, gameAtom, () => brain.game),
    update($, countdownAtom, () => (brain.countdown === null ? null : { label: brain.countdown.label, endsAt: brain.countdown.endsAt })),
    update($, plazaAtom, () => ({ isOnline: brain.serverUrl.length > 0 && brain.settings.isPlazaOn, friends: brain.friends, feed: brain.feed })),
    update($, lessonsAtom, () => brain.memory.lessons),
  ])
}

export const remember = (brain: Brain, kind: string, detail = '', weight = 1): void => {
  brain.memory = { ...brain.memory, events: [...brain.memory.events, { at: brain.now, kind, detail: detail.slice(0, 140), weight }].slice(-50) }
  brain.isDirty = true
}

export async function say($: $, brain: Brain, text: string, tone: 'say' | 'think' | 'quiet' = 'say'): Promise<void> {
  await update($, bubbleAtom, () => ({ text, at: brain.now, tone }))
  $.clock.after(5500, () => {
    void update($, bubbleAtom, current => (current !== null && current.text === text ? null : current))
  })
}

export async function hush($: $): Promise<void> {
  await update($, bubbleAtom, () => null)
}

export const lookOf = (brain: Brain): Look => ({
  bones: brain.pet?.bones ?? { seed: 0, color: 'honey', pattern: 'plain', eyes: 'round', rarity: 'common' },
  stage: brain.pet?.growth.stage ?? 'egg',
  mood: brain.mood,
  hat: wornOf(brain.wallet, 'hat'),
  neck: wornOf(brain.wallet, 'neck'),
  hammer: wornOf(brain.wallet, 'hammer') ?? 'toy',
})

export const ensureScene = (brain: Brain, width: number): Scene => {
  if (brain.scene === null) {
    brain.scene = createScene(width, lookOf(brain), scene => direct.idlePlan(scene, brain.random, idleWeights(brain.needs, brain.pet?.soul?.traits ?? { energetic: 0.5, chatty: 0.5, worried: 0.5, playful: 0.5 }, brain.mood)))
  }
  setLook(brain.scene, lookOf(brain))
  return brain.scene
}

const act = (brain: Brain, steps: readonly Step[], priority: number): void => {
  if (brain.scene !== null && !brain.isReducedMotion) {
    perform(brain.scene, steps, priority)
  }
}

export const canTalk = (brain: Brain): boolean =>
  canSpeak(presenceOf(brain), brain.settings, hourOf(brain.now)) && brain.budget.bubbles.filter(at => brain.now - at < HOUR).length < 4

const presenceOf = (brain: Brain) => ({
  now: brain.now,
  isTurnRunning: brain.isTurnRunning,
  lastTypingAt: brain.lastTypingAt,
  lastInputAt: brain.lastInputAt,
  lastTurnEndAt: brain.lastTurnEndAt,
})

async function ask($: $, brain: Brain, prompt: string, maxTokens: number, timeoutMs = 4000): Promise<string | null> {
  if (!brain.settings.isAiOn || brain.budget.aiCalls >= DAILY_AI_CALLS || brain.pet?.soul === null || brain.pet === null) {
    return null
  }
  brain.budget = { ...brain.budget, aiCalls: brain.budget.aiCalls + 1 }
  brain.isDirty = true
  try {
    const reply = await $.model.complete({ model: 'haiku', prompt, system: persona.soulSystem(brain.pet.soul), maxTokens, effort: 'low', timeoutMs })
    return reply.isAnswered ? reply.text : null
  } catch {
    return null
  }
}

export async function reactLine($: $, brain: Brain, key: string): Promise<void> {
  if (canTalk(brain)) {
    brain.budget = recordBubble(brain.budget, brain.now)
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, key))
  }
}

async function quietLine($: $, brain: Brain, key: string): Promise<void> {
  if (!isQuietNow(brain.settings, hourOf(brain.now))) {
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, key), 'quiet')
  }
}

export async function startHatch($: $, brain: Brain): Promise<void> {
  if (brain.pet === null) {
    const seed = Math.floor(brain.random() * 2 ** 31)
    brain.pet = createPet(seed, today(brain))
    brain.isDirty = true
  }
  if (brain.pet.growth.stage !== 'egg' || brain.isHatching) {
    return
  }
  brain.isHatching = true
  const pet = brain.pet
  const fallback = createFallbackSoul(pet.bones.seed, new Date(brain.now).toISOString())
  const soulPromise = brain.settings.isAiOn ? hatchSoul($, brain, pet.bones, fallback) : Promise.resolve(fallback)
  const finish = async (): Promise<void> => {
    const soul = await soulPromise
    brain.pet = { ...pet, soul, growth: { ...pet.growth, stage: 'baby' } }
    brain.isHatching = false
    brain.isDirty = true
    remember(brain, 'hatch', soul.name, 3)
    if (brain.scene !== null) {
      setLook(brain.scene, lookOf(brain))
    }
    await sync($, brain)
    await say($, brain, `안녕! 나는 ${soul.name}. ${soul.quirk.includes('"') ? '' : '잘 부탁해'}`.trim())
    await save($, brain)
  }
  if (brain.isReducedMotion || brain.scene === null) {
    await finish()
    return
  }
  act(brain, direct.hatch(() => void finish()), PRIORITY.show)
}

async function hatchSoul($: $, brain: Brain, bones: TokoPet['bones'], fallback: TokoSoul): Promise<TokoSoul> {
  try {
    brain.budget = { ...brain.budget, aiCalls: brain.budget.aiCalls + 1 }
    const reply = await $.model.complete({ model: 'haiku', prompt: persona.soulPrompt(bones), system: persona.VOICE_RULES, maxTokens: 300, effort: 'low', timeoutMs: 8000 })
    return (reply.isAnswered ? persona.parseSoul(reply.text, fallback, clampName) : null) ?? fallback
  } catch {
    return fallback
  }
}

export async function greet($: $, brain: Brain): Promise<void> {
  act(brain, direct.greet(), PRIORITY.reaction)
  await reactLine($, brain, 'hello')
}

const CHOICES: readonly TokoChoice[] = [
  { key: 'accept', label: '좋아', hotkey: '1' },
  { key: 'later', label: '나중에', hotkey: '2' },
  { key: 'stop', label: '오늘은 그만', hotkey: '3' },
]

const choicesFor = (kind: string): readonly TokoChoice[] => {
  if (kind === 'gift') {
    return [{ key: 'accept', label: '열기', hotkey: 'o' }, ...CHOICES.slice(1)]
  }
  if (kind === 'bonk-end') {
    return [
      { key: 'breathe', label: '숨 고르기', hotkey: '1' },
      { key: 'tell', label: '전하기', hotkey: '2' },
      { key: 'later', label: '괜찮아', hotkey: '3' },
    ]
  }
  return CHOICES
}

export async function openOffer($: $, brain: Brain, kind: string, line: string): Promise<void> {
  brain.offer = { id: `${kind}-${brain.now}`, kind, line, choices: choicesFor(kind), at: brain.now, expiresAt: brain.now + OFFER_TIMEOUT_MS }
  if (kind !== 'bonk-end') {
    brain.budget = recordBubble(brain.budget, brain.now)
  }
  if (BREAK_KINDS.has(kind)) {
    brain.budget = { ...brain.budget, lastBreakOfferAt: brain.now }
  }
  if (brain.scene !== null && kind !== 'bonk-end') {
    const pre = kind === 'gift' ? direct.giftDrop() : direct.greet()
    act(brain, direct.enter(brain.scene, pre), PRIORITY.event)
  }
  brain.isDirty = true
  await update($, offerAtom, () => brain.offer)
  await say($, brain, line)
}

async function closeOffer($: $, brain: Brain): Promise<void> {
  brain.offer = null
  await update($, offerAtom, () => null)
}

const healthReward = (brain: Brain, amount: number): void => {
  brain.earn = { ...brain.earn, health: brain.earn.health + amount }
  brain.isDirty = true
}

async function startCountdown($: $, brain: Brain, countdown: Countdown): Promise<void> {
  brain.countdown = countdown
  await update($, countdownAtom, () => ({ label: countdown.label, endsAt: countdown.endsAt }))
}

const workMemoryFacts = (brain: Brain): readonly string[] =>
  brain.memory.events
    .filter(event => ['test-fail', 'test-pass', 'commit', 'push', 'pr', 'turn'].includes(event.kind))
    .slice(-6)
    .map(event => `${event.kind}${event.detail ? ` ${event.detail}` : ''}`)

const ruleBriefing = (brain: Brain): string => {
  const facts = brain.memory.events.filter(event => event.kind === 'test-fail' || event.kind === 'commit' || event.kind === 'turn').slice(-3)
  const failing = facts.filter(event => event.kind === 'test-fail').length
  const last = facts.at(-1)
  if (last === undefined) {
    return '하던 거 천천히 이어 가자'
  }
  if (failing > 0) {
    return `아까 테스트 고치던 중이었어. 실패가 ${failing}번 남아 있었어`
  }
  return last.kind === 'commit' ? `마지막으로 커밋(${last.detail})까지 했어. 다음 단계부터 가자` : 'Claude랑 하던 작업이 있었어. 마지막 답부터 다시 보자'
}

const ruleWrapup = (brain: Brain): string => {
  const todays = brain.memory.events.filter(event => dayKey(event.at) === today(brain))
  const commits = todays.filter(event => event.kind === 'commit').length
  const passes = todays.filter(event => event.kind === 'test-pass').length
  const breaks = todays.filter(event => event.kind === 'break-done').length
  return `오늘 커밋 ${commits}번, 테스트 통과 ${passes}번, 쉰 횟수 ${breaks}번. 남은 건 내일의 너에게 맡기자`
}

export async function answerOffer($: $, brain: Brain, choice: string): Promise<void> {
  const offer = brain.offer
  if (offer === null) {
    return
  }
  await closeOffer($, brain)
  if (offer.kind === 'bonk-end') {
    await finishBonk($, brain, choice)
    return
  }
  const answer: Answer = choice === 'accept' ? 'accept' : choice === 'stop' ? 'stop' : choice === 'ignored' ? 'ignored' : 'later'
  brain.memory = learnAnswer(brain.memory, offer.kind, answer, hourOf(brain.now))
  brain.isDirty = true
  if (answer === 'stop') {
    brain.budget = { ...brain.budget, stoppedToday: true }
    if (brain.scene !== null) {
      act(brain, [...direct.greet(), ...direct.exit(brain.scene)], PRIORITY.event)
    }
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'stop'))
    return
  }
  if (answer === 'later' || answer === 'ignored') {
    if (brain.scene !== null) {
      act(brain, answer === 'ignored' ? [{ pose: 'yawn', ms: 1200 }, ...direct.exit(brain.scene)] : direct.exit(brain.scene), PRIORITY.event)
      if (offer.kind === 'gift') {
        removeProp(brain.scene, 'gift')
      }
    }
    if (answer === 'later') {
      await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'later'))
    } else {
      await hush($)
    }
    return
  }
  await runAccepted($, brain, offer.kind as OfferKind)
}

async function runAccepted($: $, brain: Brain, kind: OfferKind): Promise<void> {
  const now = brain.now
  switch (kind) {
    case 'stretch':
    case 'plaza-stretch':
      act(brain, kind === 'stretch' ? direct.stretch() : direct.groupStretch(brain.friends.map(friend => friend.color)), PRIORITY.event)
      await startCountdown($, brain, { kind, label: '같이 기지개', endsAt: now + 30_000, reward: kind === 'stretch' ? HEALTH_REWARD.breakAccepted : HEALTH_REWARD.plazaStretch, then: 'praise' })
      await say($, brain, '쭉— 팔을 머리 위로. 30초만 같이 펴자')
      if (kind === 'plaza-stretch') {
        await sendPlaza($, brain, 'stretch-call', null)
      }
      return
    case 'eye-rest':
      act(brain, direct.eyeRest(20_000), PRIORITY.event)
      brain.marks = { ...brain.marks, lastEyeRestAt: now }
      await startCountdown($, brain, { kind, label: '먼 곳 보기', endsAt: now + 20_000, reward: HEALTH_REWARD.eyeRestDone, then: 'praise' })
      await say($, brain, '화면 말고 먼 곳을 봐. 내가 셀게')
      return
    case 'water':
      act(brain, direct.water(), PRIORITY.event)
      brain.budget = { ...brain.budget, water: brain.budget.water + 1 }
      brain.marks = { ...brain.marks, lastWaterAt: now }
      healthReward(brain, HEALTH_REWARD.eyeRestDone)
      remember(brain, 'break-done', 'water')
      await say($, brain, '홀짝. 시원하다!')
      return
    case 'nap':
      act(brain, direct.nap(), PRIORITY.event)
      await say($, brain, '나 먼저 잘게. 너도 오늘은 여기까지 해도 돼')
      return
    case 'briefing': {
      const line = persona.parseLine((await ask($, brain, persona.linePrompt('사용자가 자리를 비웠다 돌아왔다. 하던 일을 한 줄로 짚어 준다.', workMemoryFacts(brain)), 120)) ?? '') ?? ruleBriefing(brain)
      brain.needs = restore(brain.needs, { social: 15 })
      brain.returnedAway = null
      await say($, brain, line)
      return
    }
    case 'unstick':
      act(brain, direct.exit(brain.scene ?? ensureScene(brain, 80)), PRIORITY.event)
      await startCountdown($, brain, { kind, label: '잠깐 일어났다 오기', endsAt: now + 120_000, reward: HEALTH_REWARD.breakAccepted, then: 'unstick' })
      await say($, brain, '2분만 다녀와. 실패한 거 정리해 둘게')
      return
    case 'wrapup': {
      const reply = await ask($, brain, persona.linePrompt('퇴근 시각이 지났다. 오늘 한 일과 남은 일을 세 줄 이내로 정리한다. 줄은 " / "로 나눈다.', workMemoryFacts(brain)), 200)
      const summary = (reply === null ? null : persona.extractJson(reply)?.line) ?? ruleWrapup(brain)
      $.ui.log(`${brain.pet?.soul?.name ?? '토코'}의 오늘 정리 — ${String(summary)}`)
      brain.marks = { ...brain.marks, wrappedDay: today(brain) }
      healthReward(brain, HEALTH_REWARD.finishedOnTime)
      remember(brain, 'break-done', 'wrapup')
      await say($, brain, '오늘 정리해서 기록에 남겨 뒀어. 고생했어')
      return
    }
    case 'gift':
      await openGift($, brain)
      return
    case 'bugs':
      await startGame($, brain)
      return
    case 'chat': {
      const line = persona.parseLine((await ask($, brain, persona.linePrompt('오래 말이 없던 사용자에게 오늘 있었던 일에 대해 다정한 한마디를 건넨다.', workMemoryFacts(brain)), 120)) ?? '') ?? fallbackLine(brain.random, OFFER_FALLBACK, 'chat')
      brain.needs = restore(brain.needs, { social: 20 })
      brain.marks = { ...brain.marks, lastChatAt: now }
      await say($, brain, line)
      return
    }
    case 'calm-down':
      brain.marks = { ...brain.marks, calmedDay: today(brain) }
      await breathe($, brain, 2)
      return
  }
}

export async function breathe($: $, brain: Brain, rounds: number): Promise<void> {
  act(brain, direct.breathe(rounds), PRIORITY.event)
  await startCountdown($, brain, { kind: 'breathe', label: '숨 고르기 (4초 들이쉬고 6초 내쉬기)', endsAt: brain.now + rounds * 10_000, reward: HEALTH_REWARD.breathDone, then: 'praise' })
  await say($, brain, '들이쉬고… 2, 3, 4. 내쉬고… 2, 3, 4, 5, 6')
}

export async function finishCountdown($: $, brain: Brain): Promise<void> {
  const countdown = brain.countdown
  if (countdown === null || brain.now < countdown.endsAt) {
    return
  }
  brain.countdown = null
  await update($, countdownAtom, () => null)
  if (countdown.then === 'quiet') {
    brain.marks = { ...brain.marks, lastEyeRestAt: brain.now }
    return
  }
  healthReward(brain, countdown.reward)
  remember(brain, 'break-done', countdown.kind)
  brain.workingSince = brain.now
  brain.needs = restore(brain.needs, { energy: 25 })
  if (brain.pet !== null && countdown.kind !== 'breathe') {
    brain.pet = { ...brain.pet, growth: { ...brain.pet.growth, breaksAccepted: brain.pet.growth.breaksAccepted + 1 } }
  }
  act(brain, direct.apologyAccepted().slice(1), PRIORITY.reaction)
  if (countdown.then === 'unstick') {
    const failures = brain.memory.events.filter(event => event.kind === 'test-fail').slice(-3)
    const summary = failures.at(-1)?.detail ?? ''
    await say($, brain, summary ? `잘 다녀왔어? 실패 요약: ${summary.slice(0, 44)}` : '잘 다녀왔어? 이제 한 번에 하나씩 보자')
  } else {
    await say($, brain, `${fallbackLine(brain.random, REACTION_FALLBACK, 'praise')} +${countdown.reward} 코인`)
  }
  await growIfReady($, brain)
}

async function growIfReady($: $, brain: Brain): Promise<void> {
  if (brain.pet === null) {
    return
  }
  const stage = nextStage(brain.pet.growth)
  if (stage !== brain.pet.growth.stage) {
    brain.pet = { ...brain.pet, growth: { ...brain.pet.growth, stage } }
    remember(brain, 'grow', stage, 3)
    act(brain, direct.celebrate(), PRIORITY.event)
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'grow'))
  }
}

const GIFT_POOL = ['cookie', 'cookie', 'rice-cake', 'watermelon', 'beanie', 'ribbon', 'plant']

export async function openGift($: $, brain: Brain): Promise<void> {
  const unowned = GIFT_POOL.filter(id => shopItem(id)?.kind === 'snack' || !brain.wallet.items.includes(id))
  const id = pick(brain.random, unowned.length > 0 ? unowned : ['cookie'])
  brain.wallet = { ...brain.wallet, items: [...brain.wallet.items, id] }
  brain.budget = { ...brain.budget, gifts: brain.budget.gifts + 1 }
  remember(brain, 'gift', id)
  act(brain, direct.giftOpen(), PRIORITY.event)
  await say($, brain, `${shopItem(id)?.name ?? id}! 소지품에 넣어 둘게`)
}

export async function startGame($: $, brain: Brain): Promise<void> {
  brain.game = { endsAt: brain.now + 30_000, caught: 0, missed: 0 }
  brain.gameSpawnAt = brain.now
  await update($, gameAtom, () => brain.game)
  await say($, brain, 'a·d로 움직이고 s로 잡아! 30초!')
}

export async function moveInGame($: $, brain: Brain, delta: number): Promise<void> {
  const scene = brain.scene
  if (brain.game === null || scene === null) {
    return
  }
  perform(scene, [{ pose: 'run', ms: 0, toX: Math.max(0, Math.min(scene.width - PET_WIDTH, Math.round(scene.x + delta))), speed: 60 }], PRIORITY.show)
}

export async function catchInGame($: $, brain: Brain): Promise<void> {
  const scene = brain.scene
  const game = brain.game
  if (game === null || scene === null) {
    return
  }
  const center = scene.x + PET_WIDTH / 2
  const hit = scene.props.find(prop => prop.kind === 'bug' && Math.abs(prop.x + 1 - center) <= 6)
  perform(scene, [{ pose: 'jump', ms: 650 }], PRIORITY.show)
  if (hit !== undefined) {
    removeProp(scene, hit.id)
    brain.game = { ...game, caught: game.caught + 1 }
  } else {
    brain.game = { ...game, missed: game.missed + 1 }
  }
  await update($, gameAtom, () => brain.game)
}

async function stepGame($: $, brain: Brain): Promise<void> {
  const game = brain.game
  const scene = brain.scene
  if (game === null) {
    return
  }
  if (brain.now >= game.endsAt) {
    const reward = Math.min(20, game.caught * 2)
    brain.game = null
    healthReward(brain, reward)
    remember(brain, 'played', `bugs ${game.caught}`)
    brain.needs = restore(brain.needs, { fun: 35 })
    if (scene !== null) {
      scene.props = scene.props.filter(prop => prop.kind !== 'bug')
    }
    await update($, gameAtom, () => null)
    await say($, brain, `벌레 ${game.caught}마리! +${reward} 코인. 이제 다시 일하러 가자`)
    return
  }
  if (scene !== null && brain.now - brain.gameSpawnAt >= 1400) {
    brain.gameSpawnAt = brain.now
    const fromLeft = brain.random() < 0.5
    placeProp(scene, `bug-${brain.now}`, 'bug', fromLeft ? -3 : scene.width, 13, 9000, (fromLeft ? 1 : -1) * (5 + brain.random() * 6))
  }
}

export async function feed($: $, brain: Brain): Promise<string> {
  let taken = takeSnack(brain.wallet)
  if (taken === null) {
    const bought = buy(brain.wallet, balance(brain), 'cookie')
    if ('reason' in bought) {
      await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'noSnack'))
      return '간식이 없고 코인도 모자라요. 쉬기를 받아들이면 코인이 생겨요.'
    }
    brain.wallet = bought.wallet
    brain.earn = { ...brain.earn, spent: brain.earn.spent + bought.spent }
    taken = takeSnack(brain.wallet)
  }
  if (taken === null) {
    return '간식을 꺼내지 못했어요.'
  }
  brain.wallet = taken.wallet
  brain.needs = restore(brain.needs, { hunger: taken.snack.restores ?? 25, social: 5 })
  remember(brain, 'fed', taken.snack.id)
  act(brain, direct.feed(), PRIORITY.reaction)
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'fed'))
  return `${taken.snack.name}을(를) 줬어요.`
}

export async function play($: $, brain: Brain): Promise<string> {
  brain.needs = restore(brain.needs, { fun: 30, energy: -5, social: 10 })
  remember(brain, 'played')
  act(brain, direct.play(), PRIORITY.reaction)
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'played'))
  return '같이 놀았어요.'
}

export async function purchase($: $, brain: Brain, id: string): Promise<string> {
  const result = buy(brain.wallet, balance(brain), id)
  if ('reason' in result) {
    await say($, brain, result.reason)
    return result.reason
  }
  brain.wallet = result.wallet
  brain.earn = { ...brain.earn, spent: brain.earn.spent + result.spent }
  const item = shopItem(id)
  if (item !== undefined && item.kind !== 'snack' && item.kind !== 'room') {
    brain.wallet = wear(brain.wallet, id)
    if (brain.scene !== null) {
      setLook(brain.scene, lookOf(brain))
    }
  }
  remember(brain, 'bought', id)
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await say($, brain, item?.kind === 'hat' || item?.kind === 'neck' ? '어때? 잘 어울려?' : `${item?.name ?? id} 샀다!`)
  await save($, brain)
  return `${item?.name ?? id}을(를) 샀어요.`
}

export async function toggleWear($: $, brain: Brain, id: string): Promise<void> {
  brain.wallet = wear(brain.wallet, id)
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  brain.isDirty = true
  await sync($, brain)
}

export async function startBonk($: $, brain: Brain, reason: string): Promise<string> {
  brain.budget = { ...brain.budget, bonks: brain.budget.bonks + 1 }
  if (balance(brain) >= SPEND.bonk) {
    brain.earn = { ...brain.earn, spent: brain.earn.spent + SPEND.bonk }
  }
  brain.bonk = { reason, isTurnRunning: brain.isTurnRunning, hasApology: false, isSubmitted: false }
  remember(brain, 'bonk', reason, 2)
  await closeOffer($, brain)
  const isRunning = brain.isTurnRunning
  const onHit = (): void => {
    void update($, ouchAtom, () => true)
    void say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'bonkHit'))
    $.clock.after(3000, () => void update($, ouchAtom, () => false))
  }
  if (brain.scene !== null && !brain.isReducedMotion) {
    perform(brain.scene, direct.bonk(brain.scene, isRunning, onHit), PRIORITY.show)
  } else {
    onHit()
  }
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'bonkStart'))
  $.clock.after(3200, () => void afterBonk($, brain))
  return reason
}

async function afterBonk($: $, brain: Brain): Promise<void> {
  const bonk = brain.bonk
  if (bonk === null) {
    return
  }
  if (!bonk.isTurnRunning && !brain.isTurnRunning) {
    await submitBonk($, brain)
  }
  await openOffer($, brain, 'bonk-end', fallbackLine(brain.random, REACTION_FALLBACK, 'bonkEnd'))
}

export async function submitBonk($: $, brain: Brain): Promise<void> {
  const bonk = brain.bonk
  if (bonk === null || bonk.isSubmitted || bonk.hasApology) {
    return
  }
  brain.bonk = { ...bonk, isSubmitted: true }
  await $.prompt.submit({ text: persona.bonkMessage(brain.pet?.soul?.name ?? '토코', bonk.reason) })
}

async function finishBonk($: $, brain: Brain, choice: string): Promise<void> {
  const reason = brain.bonk?.reason ?? ''
  if (choice === 'breathe') {
    await breathe($, brain, 1)
    return
  }
  if (choice === 'tell') {
    const reply = await ask($, brain, persona.correctionPrompt(reason), 120)
    const line = (reply === null ? null : persona.parseLine(reply)) ?? persona.fallbackCorrection(reason)
    const filled = await $.prompt.fill({ text: line, mode: 'replace' })
    await say($, brain, filled.isFilled ? '다음 프롬프트에 넣어 뒀어. 다듬어서 보내' : line)
    return
  }
  await say($, brain, '둘 다 고생했어')
}

export async function apologize($: $, brain: Brain): Promise<string> {
  if (brain.bonk !== null) {
    brain.bonk = { ...brain.bonk, hasApology: true }
  }
  brain.needs = restore(brain.needs, { social: 10 })
  remember(brain, 'apologize', '', 2)
  brain.mood = 'excited'
  act(brain, direct.apologyAccepted(), PRIORITY.event)
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'apology'))
  await sync($, brain)
  return `${brain.pet?.soul?.name ?? '토코'}(이)가 사과를 받아 줬어요. 하트를 띄웠어요.`
}

export async function onTurnComplete($: $, brain: Brain, durationMs: number, reason: string, usage: TurnUsage | undefined): Promise<void> {
  const wasTyping = brain.typedDuringTurn
  brain.isTurnRunning = false
  brain.lastTurnEndAt = brain.now
  brain.longTurnStage = 0
  if (brain.countdown?.then === 'quiet') {
    brain.countdown = null
    await update($, countdownAtom, () => null)
  }
  if (reason !== 'answer' || usage === undefined) {
    act(brain, direct.flinch(), PRIORITY.reaction)
    return
  }
  const income = capTokenIncome(turnIncome(usage), earnedTokenToday([...brain.otherEarns, brain.earn], today(brain)))
  brain.earn = { ...brain.earn, earned: brain.earn.earned + income }
  brain.earnings = [...brain.earnings, { durationMs, coins: income, at: brain.now }].slice(-20)
  remember(brain, 'turn', `${Math.round(durationMs / 1000)}s`, 0.5)
  if (income > 0) {
    act(brain, direct.earnCoins(income), PRIORITY.reaction)
  }
  if (durationMs >= 2 * MINUTE && !wasTyping) {
    act(brain, direct.greet(), PRIORITY.reaction)
    await quietLine($, brain, 'turnDone')
    await notifyOnce($, brain, 'Claude가 답을 마쳤어요')
  }
  if (brain.bonk !== null && brain.bonk.isTurnRunning && !brain.bonk.hasApology && !brain.bonk.isSubmitted) {
    $.clock.after(1500, () => void submitBonk($, brain))
  }
  await sync($, brain)
}

export async function notifyOnce($: $, brain: Brain, text: string): Promise<void> {
  if (!canNotify(brain.budget, brain.settings, hourOf(brain.now))) {
    return
  }
  brain.budget = { ...brain.budget, notifications: brain.budget.notifications + 1 }
  try {
    await $.ui.notify(text, { title: brain.pet?.soul?.name ?? 'Toko' })
  } catch {
    brain.isDirty = true
  }
}

export async function onTest($: $, brain: Brain, kind: 'test-fail' | 'test-pass', key: string, summary: string): Promise<void> {
  const hadFailure = brain.memory.events.some(event => event.kind === 'test-fail' && event.detail.startsWith(key))
  remember(brain, kind, kind === 'test-fail' ? `${key} :: ${summary}` : key)
  if (kind === 'test-fail') {
    act(brain, direct.worry(), PRIORITY.reaction)
    return
  }
  if (hadFailure) {
    brain.lastPassAfterFailAt = brain.now
    brain.memory = { ...brain.memory, events: brain.memory.events.filter(event => !(event.kind === 'test-fail' && event.detail.startsWith(key))) }
  }
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await quietLine($, brain, 'testPass')
}

export async function onGit($: $, brain: Brain, kind: string, detail: string): Promise<void> {
  remember(brain, kind, detail, 1.5)
  act(brain, direct.flag(), PRIORITY.reaction)
  if (kind === 'commit' && brain.marks.firstCommitDay !== today(brain)) {
    brain.marks = { ...brain.marks, firstCommitDay: today(brain) }
    brain.wallet = { ...brain.wallet, items: [...brain.wallet.items, 'cookie'] }
    await quietLine($, brain, 'firstCommit')
    return
  }
  await quietLine($, brain, 'commit')
}

export const onSubagents = (brain: Brain, count: number): void => {
  act(brain, direct.subagentShadows(count), PRIORITY.reaction)
}

export async function onMeasure($: $, brain: Brain, contextPercent: number | undefined, rateLimitPercent: number): Promise<void> {
  brain.rateLimitPercent = rateLimitPercent
  if (contextPercent !== undefined && contextPercent >= 85 && !brain.isFullShown) {
    brain.isFullShown = true
    act(brain, direct.full(), PRIORITY.reaction)
    await quietLine($, brain, 'full')
  }
  if (contextPercent !== undefined && contextPercent < 50) {
    brain.isFullShown = false
  }
}

export async function onAttention($: $, brain: Brain): Promise<void> {
  act(brain, direct.greet(), PRIORITY.reaction)
  await quietLine($, brain, 'permission')
  if (brain.now - brain.lastTypingAt > MINUTE) {
    await notifyOnce($, brain, 'Claude가 확인을 기다려요')
  }
}

export async function onTyping($: $, brain: Brain): Promise<void> {
  const awayMinutes = (brain.now - Math.max(brain.lastInputAt, brain.lastTypingAt)) / MINUTE
  brain.lastTypingAt = brain.now
  if (brain.isTurnRunning) {
    brain.typedDuringTurn = true
  }
  if (awayMinutes >= 10) {
    brain.returnedAway = { minutes: awayMinutes, at: brain.now }
    brain.workingSince = brain.now
    act(brain, direct.greet(), PRIORITY.reaction)
    await quietLine($, brain, 'welcomeBack')
  }
}

const hourFactor = (brain: Brain): number => {
  const slot = brain.memory.answersByHour[hourOf(brain.now)]
  return slot !== undefined && slot.declined >= 2 && slot.declined > slot.accepted * 2 ? 0.4 : 1
}

const contextOf = (brain: Brain) => {
  const now = brain.now
  const minutesSince = (at: number): number => (at === 0 ? 999 : (now - at) / MINUTE)
  const failKeys = brain.memory.events.filter(event => event.kind === 'test-fail').map(event => event.detail.split(' :: ')[0] ?? '')
  const failStreak = failKeys.length === 0 ? 0 : failKeys.filter(key => key === failKeys.at(-1)).length
  const factor = hourFactor(brain)
  const kindScale = Object.fromEntries([...BREAK_KINDS].map(kind => [kind, (brain.memory.kindScale[kind] ?? 1) * factor]))
  return {
    now,
    hour: hourOf(now),
    needs: brain.needs,
    traits: brain.pet?.soul?.traits ?? { energetic: 0.5, chatty: 0.5, worried: 0.5, playful: 0.5 },
    breakMinutes: brain.settings.breakMinutes,
    workingMinutes: (now - brain.workingSince) / MINUTE,
    minutesSinceEyeRest: minutesSince(brain.marks.lastEyeRestAt || brain.workingSince),
    minutesSinceWater: minutesSince(brain.marks.lastWaterAt || brain.workingSince),
    minutesSinceChat: minutesSince(brain.marks.lastChatAt || brain.workingSince),
    waterToday: brain.budget.water,
    giftsToday: brain.budget.gifts,
    giftQuota: 1 + ((brain.pet?.bones.seed ?? 0) + new Date(now).getDate()) % 2,
    failStreak,
    minutesSincePassAfterFail: brain.lastPassAfterFailAt === null ? null : minutesSince(brain.lastPassAfterFailAt),
    bonksToday: brain.budget.bonks,
    hasCalmedToday: brain.marks.calmedDay === today(brain),
    awayMinutes: brain.returnedAway !== null && now - brain.returnedAway.at < 5 * MINUTE ? brain.returnedAway.minutes : 0,
    hasWorkMemory: workMemoryFacts(brain).length > 0,
    offWorkHour: brain.settings.offWorkHour,
    hasWrappedToday: brain.marks.wrappedDay === today(brain),
    rateLimitPercent: brain.rateLimitPercent,
    friendsOnline: brain.friends.filter(friend => now - friend.lastSeen < FRIEND_TTL_MS).length,
    kindScale: { ...brain.memory.kindScale, ...kindScale },
    luck: brain.random(),
  }
}

export const MIN_SCORE = 6

export async function decide($: $, brain: Brain, candidates: readonly Candidate[]): Promise<{ kind: string; line: string } | null> {
  const top = candidates[0]
  if (top === undefined || top.score < MIN_SCORE) {
    return null
  }
  const soul = brain.pet?.soul
  const reply =
    soul === null || soul === undefined
      ? null
      : await ask($, brain, persona.intentPrompt({ soul, candidates, mood: brain.mood, needs: brain.needs, events: brain.memory.events, lessons: brain.memory.lessons, clock: clockText(brain.now) }), 120)
  if (reply === null) {
    return { kind: top.kind, line: fallbackLine(brain.random, OFFER_FALLBACK, top.kind) }
  }
  const intent = persona.parseIntent(reply, candidates)
  if (intent === null) {
    return { kind: top.kind, line: fallbackLine(brain.random, OFFER_FALLBACK, top.kind) }
  }
  if (intent.intent === 'stay_quiet') {
    return null
  }
  return { kind: intent.intent, line: intent.line ?? fallbackLine(brain.random, OFFER_FALLBACK, intent.intent) }
}

export async function think($: $, brain: Brain): Promise<void> {
  if (!brain.isLoaded || brain.pet === null || brain.pet.growth.stage === 'egg') {
    return
  }
  const now = brain.now
  const hour = hourOf(now)
  brain.needs = decayNeeds(brain.needs, now, now - Math.max(brain.lastInputAt, brain.lastTypingAt) < 10 * MINUTE)
  brain.mood = moodOf(brain.needs, brain.memory.events, now, hour, brain.budget.bonks)
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  if (brain.offer !== null && now >= brain.offer.expiresAt) {
    await answerOffer($, brain, 'ignored')
  }
  await finishCountdown($, brain)
  await stepGame($, brain)
  await watchLongTurn($, brain)
  await maybeEncounter($, brain)
  if (brain.isThinking || brain.offer !== null || brain.countdown !== null || brain.game !== null || brain.bonk !== null) {
    return
  }
  const presence = presenceOf(brain)
  if (!canSpeak(presence, brain.settings, hour) || !isGap(presence)) {
    return
  }
  const candidates = gateCandidates(candidatesOf(contextOf(brain)), brain.budget, brain.settings, now)
  if (candidates.length === 0) {
    return
  }
  brain.isThinking = true
  try {
    const decision = await decide($, brain, candidates)
    if (decision !== null && brain.offer === null && !brain.isTurnRunning) {
      await openOffer($, brain, decision.kind, decision.line)
    }
  } finally {
    brain.isThinking = false
  }
}

async function watchLongTurn($: $, brain: Brain): Promise<void> {
  if (!brain.isTurnRunning) {
    return
  }
  const elapsed = brain.now - brain.turnStartedAt
  if (elapsed >= MINUTE && brain.longTurnStage === 0) {
    brain.longTurnStage = 1
    if (canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion) && brain.countdown === null && brain.bonk === null) {
      act(brain, direct.eyeRest(20_000), PRIORITY.encounter)
      await startCountdown($, brain, { kind: 'quiet-eye', label: '기다리는 동안 먼 곳 보기', endsAt: brain.now + 20_000, reward: 0, then: 'quiet' })
    }
  }
  if (elapsed >= 2 * MINUTE && brain.longTurnStage === 1) {
    brain.longTurnStage = 2
    act(brain, [{ pose: 'yawn', ms: 1200 }], PRIORITY.reaction)
  }
}

async function maybeEncounter($: $, brain: Brain): Promise<void> {
  const scene = brain.scene
  if (scene === null || isBusy(scene) || brain.offer !== null || brain.game !== null || brain.bonk !== null) {
    return
  }
  if (!canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion)) {
    return
  }
  const isIdle = brain.now - Math.max(brain.lastTypingAt, brain.lastInputAt) >= 30_000
  if (!brain.isTurnRunning && !isIdle) {
    return
  }
  const options = encounterOf({
    hour: hourOf(brain.now),
    mood: brain.mood,
    isWorking: brain.isTurnRunning,
    minutesSinceEncounter: (brain.now - brain.lastEncounterAt) / MINUTE,
    luck: brain.random(),
  })
  if (options.length === 0 || brain.random() > 0.35) {
    return
  }
  const kind = pickWeighted(brain.random, options)
  if (kind === null) {
    return
  }
  brain.lastEncounterAt = brain.now
  remember(brain, 'encounter', kind, 0.3)
  act(brain, direct.encounter(scene, kind, brain.random), PRIORITY.encounter)
  if ((brain.pet?.soul?.traits.chatty ?? 0) >= 0.5 || kind === 'bubbles' || kind === 'firefly') {
    await say($, brain, pick(brain.random, ENCOUNTER_LINES[kind]), 'quiet')
  }
}

export const plazaStatus = (brain: Brain): PlazaStatus => {
  if (brain.countdown !== null && brain.countdown.then !== 'quiet') {
    return 'resting'
  }
  if (brain.now - Math.max(brain.lastInputAt, brain.lastTypingAt) >= 10 * MINUTE) {
    return 'away'
  }
  return brain.isTurnRunning ? 'working' : 'idle'
}

const plazaMe = (brain: Brain) => ({
  id: brain.plazaId,
  name: brain.pet?.soul?.name ?? '알',
  color: brain.pet?.bones.color ?? 'honey',
  mood: brain.mood,
  status: plazaStatus(brain),
})

export const isPlazaReady = (brain: Brain): boolean =>
  brain.settings.isPlazaOn && brain.serverUrl.length > 0 && brain.pet?.soul !== null && brain.pet !== null

export async function pollPlaza($: $, brain: Brain): Promise<void> {
  if (!isPlazaReady(brain) || brain.now - brain.lastPollAt < PLAZA_POLL_MS) {
    return
  }
  brain.lastPollAt = brain.now
  const url = plazaEndpoint(brain.serverUrl, '/v1/poll')
  if (url === null) {
    return
  }
  try {
    const response = await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ me: plazaMe(brain), since: brain.lastPollAt - PLAZA_POLL_MS * 2 }) })
    const snapshot = response.ok ? parseSnapshot(response.text, brain.plazaId) : null
    if (snapshot === null) {
      return
    }
    brain.friends = snapshot.friends
    const fresh = snapshot.events.filter(event => !brain.seenEvents.includes(event.id) && isForMe(event, brain.plazaId))
    brain.seenEvents = [...brain.seenEvents, ...fresh.map(event => event.id)].slice(-200)
    for (const event of fresh) {
      await receivePlaza($, brain, event)
    }
    await update($, plazaAtom, () => ({ isOnline: true, friends: brain.friends, feed: brain.feed }))
  } catch {
    await update($, plazaAtom, () => ({ isOnline: false, friends: [], feed: brain.feed }))
  }
}

async function receivePlaza($: $, brain: Brain, event: PlazaEvent): Promise<void> {
  brain.feed = [...brain.feed, { at: brain.now, text: eventText(event) }].slice(-12)
  if (event.kind === 'join' || event.kind === 'leave') {
    return
  }
  remember(brain, 'friend-wave', event.from.name, 1)
  brain.needs = restore(brain.needs, { social: 8, hunger: event.kind === 'snack' ? 15 : 0 })
  if (brain.scene !== null && !isBusy(brain.scene) && canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion)) {
    act(brain, event.kind === 'snack' ? direct.feed() : direct.friendVisit(event.from.id, event.from.color), PRIORITY.encounter)
  }
  if (!isQuietNow(brain.settings, hourOf(brain.now))) {
    await say($, brain, eventText(event).slice(0, 60), 'quiet')
  }
}

export async function sendPlaza($: $, brain: Brain, kind: PlazaAction, to: string | null): Promise<string> {
  if (!isPlazaReady(brain)) {
    return brain.serverUrl.length === 0 ? '광장 서버 주소가 설정되지 않았어요. /plugin 설정에서 serverUrl을 넣어 주세요.' : '광장이 꺼져 있어요. /toko plaza on'
  }
  const url = plazaEndpoint(brain.serverUrl, '/v1/act')
  if (url === null) {
    return '광장 서버 주소 형식이 올바르지 않아요.'
  }
  try {
    const response = await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ me: plazaMe(brain), kind, to }) })
    if (!response.ok) {
      return `광장 서버가 거절했어요 (${response.status}).`
    }
    remember(brain, 'plaza-sent', kind)
    act(brain, kind === 'stretch-call' ? direct.stretch() : direct.greet(), PRIORITY.reaction)
    return '광장에 보냈어요.'
  } catch {
    return '광장 서버에 닿지 못했어요.'
  }
}

export async function reflect($: $, brain: Brain): Promise<void> {
  const day = today(brain)
  if (brain.memory.reflectedDay === day) {
    return
  }
  const earlier = brain.memory.events.filter(event => dayKey(event.at) !== day)
  brain.memory = { ...brain.memory, reflectedDay: day }
  if (earlier.length === 0) {
    return
  }
  const reply = await ask($, brain, persona.reflectPrompt(earlier.slice(-30), brain.memory.answersByHour), 160)
  const lesson = (reply === null ? null : persona.parseLesson(reply)) ?? ruleLesson(brain)
  if (lesson !== null) {
    brain.memory = { ...brain.memory, lessons: [...brain.memory.lessons, lesson].slice(-5) }
  }
  brain.isDirty = true
}

const ruleLesson = (brain: Brain): string | null => {
  const busiest = brain.memory.answersByHour
    .map((slot, hour) => ({ hour, ...slot }))
    .filter(slot => slot.declined >= 2 && slot.declined > slot.accepted)
    .sort((a, b) => b.declined - a.declined)[0]
  return busiest === undefined ? null : `${busiest.hour}시엔 몰입하는 편이라 그 시간엔 권유를 줄인다`
}

export const offerLine = (brain: Brain, kind: string): string => fallbackLine(brain.random, OFFER_FALLBACK, kind)

export async function resetDayIfNeeded($: $, brain: Brain): Promise<void> {
  const day = today(brain)
  if (brain.budget.day === day) {
    return
  }
  brain.budget = rollBudget(brain.budget, day)
  brain.wallet = { ...brain.wallet, coins: brain.wallet.coins + earnBalance(brain.earn) }
  brain.otherEarns = []
  brain.earn = emptyEarn(day)
  if (brain.pet !== null) {
    brain.pet = { ...brain.pet, growth: advanceDay(brain.pet.growth, day) }
  }
  await save($, brain)
  await reflect($, brain)
}
