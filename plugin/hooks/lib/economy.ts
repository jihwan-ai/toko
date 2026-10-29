import type { TokoEarn, TokoWallet } from '../../types'

export const DAILY_TOKEN_CAP = 120
export const CACHE_BONUS_RATIO = 0.5
export const CACHE_BONUS = 1.2

export const HEALTH_REWARD = { breakAccepted: 15, eyeRestDone: 5, finishedOnTime: 20, breathDone: 5, plazaStretch: 10, focusDone: 10 } as const

export const SPEND = { bonk: 3, bugTicket: 10, draw: 200 } as const

export type TurnUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export const cacheReadRatio = (usage: TurnUsage): number => {
  const total = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  return total === 0 ? 0 : usage.cache_read_input_tokens / total
}

export const turnIncome = (usage: TurnUsage): number => {
  const base = 3 * Math.log2(1 + usage.output_tokens / 500)
  const bonus = cacheReadRatio(usage) >= CACHE_BONUS_RATIO ? CACHE_BONUS : 1
  return Math.round(base * bonus)
}

export const capTokenIncome = (income: number, earnedToday: number): number =>
  Math.max(0, Math.min(income, DAILY_TOKEN_CAP - earnedToday))

export const emptyEarn = (day: string): TokoEarn => ({ day, earned: 0, health: 0, spent: 0 })

export const earnBalance = (earn: TokoEarn): number => earn.earned + earn.health - earn.spent

export const balanceOf = (wallet: TokoWallet, earns: readonly TokoEarn[]): number =>
  wallet.coins + earns.reduce((sum, earn) => sum + earnBalance(earn), 0)

export const earnedTokenToday = (earns: readonly TokoEarn[], day: string): number =>
  earns.filter(earn => earn.day === day).reduce((sum, earn) => sum + earn.earned, 0)

export type ShopKind = 'snack' | 'hat' | 'neck' | 'room' | 'hammer' | 'pet'

export type ShopItem = { id: string; name: string; kind: ShopKind; price: number; restores?: number }

export const SHOP: readonly ShopItem[] = [
  { id: 'cookie', name: '토큰 쿠키', kind: 'snack', price: 5, restores: 25 },
  { id: 'rice-cake', name: '꿀떡', kind: 'snack', price: 8, restores: 40 },
  { id: 'watermelon', name: '수박 한 조각', kind: 'snack', price: 10, restores: 55 },
  { id: 'beanie', name: '털모자', kind: 'hat', price: 40 },
  { id: 'ribbon', name: '리본', kind: 'hat', price: 50 },
  { id: 'crown', name: '작은 왕관', kind: 'hat', price: 80 },
  { id: 'scarf', name: '목도리', kind: 'neck', price: 60 },
  { id: 'plant', name: '화분', kind: 'room', price: 60 },
  { id: 'lamp', name: '무드등', kind: 'room', price: 90 },
  { id: 'rug', name: '폭신 러그', kind: 'room', price: 150 },
  { id: 'duck', name: '고무 오리 망치', kind: 'hammer', price: 100 },
  { id: 'pillow', name: '베개 망치', kind: 'hammer', price: 100 },
  { id: 'leek', name: '대파 망치', kind: 'hammer', price: 100 },
  { id: 'chick', name: '병아리', kind: 'pet', price: 60 },
  { id: 'hamster', name: '햄스터', kind: 'pet', price: 90 },
  { id: 'kitten', name: '아기 고양이', kind: 'pet', price: 120 },
]

export const shopItem = (id: string): ShopItem | undefined => SHOP.find(item => item.id === id)

export type Purchase = { wallet: TokoWallet; spent: number } | { reason: string }

export const buy = (wallet: TokoWallet, balance: number, id: string): Purchase => {
  const item = shopItem(id)
  if (item === undefined) {
    return { reason: '그런 물건은 없어' }
  }
  if (item.kind !== 'snack' && wallet.items.includes(id)) {
    return { reason: '이미 갖고 있어' }
  }
  if (balance < item.price) {
    return { reason: `코인이 ${item.price - balance}개 모자라` }
  }
  return { wallet: { ...wallet, items: [...wallet.items, id] }, spent: item.price }
}

export const wear = (wallet: TokoWallet, id: string): TokoWallet => {
  const item = shopItem(id)
  if (item === undefined || item.kind === 'snack' || !wallet.items.includes(id)) {
    return wallet
  }
  if (wallet.worn.includes(id)) {
    return { ...wallet, worn: wallet.worn.filter(worn => worn !== id) }
  }
  const others = wallet.worn.filter(worn => shopItem(worn)?.kind !== item.kind)
  return { ...wallet, worn: [...others, id] }
}

export const takeSnack = (wallet: TokoWallet): { wallet: TokoWallet; snack: ShopItem } | null => {
  const snackId = wallet.items.find(id => shopItem(id)?.kind === 'snack')
  const snack = snackId === undefined ? undefined : shopItem(snackId)
  if (snackId === undefined || snack === undefined) {
    return null
  }
  const index = wallet.items.indexOf(snackId)
  return { wallet: { ...wallet, items: wallet.items.filter((_, at) => at !== index) }, snack }
}

export const wornOf = (wallet: TokoWallet, kind: ShopKind): string | undefined =>
  wallet.worn.find(id => shopItem(id)?.kind === kind)
