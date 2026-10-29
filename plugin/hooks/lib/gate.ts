import type { TokoBudget, TokoHourAnswers, TokoMemory, TokoSettings } from '../../types'

import type { Candidate } from './sim'
import { BREAK_KINDS } from './sim'
import { HOUR, MINUTE, isWithinHours } from './time'

export const BUBBLES_PER_HOUR = 4
export const NOTIFICATIONS_PER_DAY = 3
export const TYPING_HOLD_MS = 20_000
export const IDLE_GAP_MS = 30_000
export const OFFER_TIMEOUT_MS = 30_000
export const MAX_CANDIDATES = 5

export type Presence = {
  now: number
  isTurnRunning: boolean
  lastTypingAt: number
  lastInputAt: number
  lastTurnEndAt: number
}

export const emptyBudget = (day: string): TokoBudget => ({
  day,
  aiCalls: 0,
  forkCalls: 0,
  notifications: 0,
  bonks: 0,
  bubbles: [],
  gifts: 0,
  water: 0,
  stoppedToday: false,
  lastBreakOfferAt: 0,
})

export const rollBudget = (budget: TokoBudget | null, day: string): TokoBudget =>
  budget === null || budget.day !== day ? emptyBudget(day) : budget

export const isQuietNow = (settings: TokoSettings, hour: number): boolean =>
  settings.isMuted || isWithinHours(hour, settings.quiet)

export const canSpeak = (presence: Presence, settings: TokoSettings, hour: number): boolean =>
  !presence.isTurnRunning && presence.now - presence.lastTypingAt >= TYPING_HOLD_MS && !isQuietNow(settings, hour)

export const isGap = (presence: Presence): boolean =>
  presence.now - presence.lastTurnEndAt <= 5_000 || presence.now - presence.lastInputAt >= IDLE_GAP_MS

export const canAnimateQuietly = (settings: TokoSettings, hour: number, isReducedMotion: boolean): boolean =>
  !isQuietNow(settings, hour) && !isReducedMotion

export const bubblesInLastHour = (budget: TokoBudget, now: number): number =>
  budget.bubbles.filter(at => now - at < HOUR).length

export const recordBubble = (budget: TokoBudget, now: number): TokoBudget => ({
  ...budget,
  bubbles: [...budget.bubbles.filter(at => now - at < HOUR), now],
})

export const isBreakDue = (budget: TokoBudget, settings: TokoSettings, now: number): boolean =>
  now - budget.lastBreakOfferAt >= settings.breakMinutes * MINUTE

export const gateCandidates = (candidates: readonly Candidate[], budget: TokoBudget, settings: TokoSettings, now: number): readonly Candidate[] => {
  if (budget.stoppedToday || bubblesInLastHour(budget, now) >= BUBBLES_PER_HOUR) {
    return []
  }
  const breakAllowed = isBreakDue(budget, settings, now)
  return candidates.filter(candidate => breakAllowed || !BREAK_KINDS.has(candidate.kind)).slice(0, MAX_CANDIDATES)
}

export const canNotify = (budget: TokoBudget, settings: TokoSettings, hour: number): boolean =>
  settings.isNotifyOn && budget.notifications < NOTIFICATIONS_PER_DAY && !isQuietNow(settings, hour)

export type Answer = 'accept' | 'later' | 'stop' | 'ignored'

const bumpHour = (answers: readonly TokoHourAnswers[], hour: number, isAccepted: boolean): readonly TokoHourAnswers[] =>
  Array.from({ length: 24 }, (_, index) => {
    const slot = answers[index] ?? { accepted: 0, declined: 0 }
    if (index !== hour) {
      return slot
    }
    return isAccepted ? { ...slot, accepted: slot.accepted + 1 } : { ...slot, declined: slot.declined + 1 }
  })

export const learnAnswer = (memory: TokoMemory, kind: string, answer: Answer, hour: number): TokoMemory => {
  if (answer === 'ignored') {
    return memory
  }
  const isAccepted = answer === 'accept'
  const streak = isAccepted ? 0 : (memory.declineStreak[kind] ?? 0) + 1
  const scale = memory.kindScale[kind] ?? 1
  const nextScale = isAccepted ? Math.min(1, scale * 1.25) : streak >= 2 ? Math.max(0.125, scale / 2) : scale
  return {
    ...memory,
    answersByHour: bumpHour(memory.answersByHour, hour, isAccepted),
    declineStreak: { ...memory.declineStreak, [kind]: streak >= 2 ? 0 : streak },
    kindScale: { ...memory.kindScale, [kind]: nextScale },
  }
}
