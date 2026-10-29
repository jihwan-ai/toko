export type Random = () => number

export const createRandom = (seed: number): Random => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const hashText = (text: string): number => {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const pick = <T>(random: Random, items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length) % items.length]
  if (item === undefined) {
    throw new Error('pick from an empty list')
  }
  return item
}

export const pickWeighted = <T>(random: Random, items: readonly { item: T; weight: number }[]): T | null => {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
  if (total <= 0) {
    return null
  }
  let roll = random() * total
  for (const entry of items) {
    roll -= Math.max(0, entry.weight)
    if (roll <= 0) {
      return entry.item
    }
  }
  return items.at(-1)?.item ?? null
}
