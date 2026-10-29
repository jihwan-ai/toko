export type TokoColor = 'honey' | 'mint' | 'peach' | 'lavender'
export type TokoPattern = 'plain' | 'spots' | 'stripe'
export type TokoEyes = 'round' | 'dot' | 'sparkle'
export type TokoRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type TokoStage = 'egg' | 'baby' | 'child' | 'adult'
export type TokoMood = 'excited' | 'calm' | 'sleepy' | 'worried' | 'sulky'

export type TokoBones = {
  seed: number
  color: TokoColor
  pattern: TokoPattern
  eyes: TokoEyes
  rarity: TokoRarity
}

export type TokoTraits = { energetic: number; chatty: number; worried: number; playful: number }

export type TokoSoul = {
  name: string
  personality: string
  quirk: string
  traits: TokoTraits
  hatchedAt: string
  isFallback: boolean
  isNamed: boolean
}

export type TokoGrowth = { stage: TokoStage; daysTogether: number; breaksAccepted: number; lastDay: string }

export type TokoPet = { bones: TokoBones; soul: TokoSoul | null; growth: TokoGrowth }

export type TokoNeeds = { energy: number; fun: number; hunger: number; social: number; updatedAt: number }

export type TokoMemoryEvent = { at: number; kind: string; detail: string; weight: number }

export type TokoHourAnswers = { accepted: number; declined: number }

export type TokoMemory = {
  events: readonly TokoMemoryEvent[]
  lessons: readonly string[]
  answersByHour: readonly TokoHourAnswers[]
  declineStreak: Readonly<Record<string, number>>
  kindScale: Readonly<Record<string, number>>
  reflectedDay: string
}

export type TokoWallet = { coins: number; items: readonly string[]; worn: readonly string[] }

export type TokoEarn = { day: string; earned: number; health: number; spent: number }

export type TokoCounts = Readonly<Record<string, number>>

export type TokoTally = { day: string; counts: TokoCounts; notes: readonly string[]; costUsd: number }

export type TokoStats = { total: TokoCounts; days: readonly TokoTally[] }

export type TokoBudget = {
  day: string
  aiCalls: number
  forkCalls: number
  notifications: number
  bonks: number
  bubbles: readonly number[]
  gifts: number
  water: number
  stoppedToday: boolean
  lastBreakOfferAt: number
}

export type TokoSettings = {
  isMuted: boolean
  isHidden: boolean
  quiet: readonly [number, number] | null
  breakMinutes: number
  offWorkHour: number | null
  isAiOn: boolean
  isNotifyOn: boolean
  isMoodSensing: boolean
  isPlazaOn: boolean
}

export type TokoChoice = { key: string; label: string; hotkey: string }

export type TokoBubble = { text: string; at: number; tone: 'say' | 'think' | 'quiet' }

export type TokoOffer = {
  id: string
  kind: string
  line: string
  choices: readonly TokoChoice[]
  at: number
  expiresAt: number
}

export type TokoEarning = { durationMs: number; coins: number; at: number }

export type TokoGame = { endsAt: number; caught: number; missed: number }

export type TokoCountdown = { label: string; endsAt: number }

export type TokoFriend = { id: string; name: string; color: TokoColor; mood: TokoMood; status: string; lastSeen: number }

export type TokoPlazaView = {
  isOnline: boolean
  friends: readonly TokoFriend[]
  feed: readonly { at: number; text: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    toko: {
      pet: TokoPet | null
      needs: TokoNeeds | null
      mood: TokoMood
      wallet: TokoWallet | null
      settings: TokoSettings | null
      bubble: TokoBubble | null
      offer: TokoOffer | null
      ouch: boolean
      earnings: readonly TokoEarning[]
      game: TokoGame | null
      countdown: TokoCountdown | null
      plaza: TokoPlazaView | null
      lessons: readonly string[]
    }
  }
}
