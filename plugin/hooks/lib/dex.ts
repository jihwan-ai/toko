import type { TokoDexEntry } from '../../types'

import type { EncounterKind } from './sim'

export const SHINY_CHANCE = 1 / 16

export const DEX_REWARD = { first: 5, shiny: 15 } as const

export const DEX_NAMES: Readonly<Record<EncounterKind, string>> = {
  butterfly: '나비',
  leaves: '떨어지는 잎',
  crumb: '토큰 부스러기',
  bubbles: '비눗방울',
  'shooting-star': '별똥별',
  rain: '비구름',
  sprout: '새싹',
  firefly: '반딧불이',
}

export const DEX_KINDS = Object.keys(DEX_NAMES) as readonly EncounterKind[]

export const isEncounterKind = (value: string): value is EncounterKind => (DEX_KINDS as readonly string[]).includes(value)

export type DexRecord = { seen: number; shiny: number; firstAt: number }

export type Dex = Readonly<Record<string, DexRecord>>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

export const asDex = (value: unknown): Dex =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([kind, raw]) => (isEncounterKind(kind) && isRecord(raw) && count(raw.seen) > 0 ? [[kind, { seen: count(raw.seen), shiny: count(raw.shiny), firstAt: count(raw.firstAt) }]] : [])),
      )
    : {}

export const mergeDex = (a: Dex, b: Dex): Dex =>
  Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map(kind => {
      const left = a[kind]
      const right = b[kind]
      return [kind, { seen: Math.max(left?.seen ?? 0, right?.seen ?? 0), shiny: Math.max(left?.shiny ?? 0, right?.shiny ?? 0), firstAt: Math.min(left?.firstAt ?? Infinity, right?.firstAt ?? Infinity) }]
    }),
  )

export type Sighting = { dex: Dex; isNew: boolean; isNewShiny: boolean }

export const recordSighting = (dex: Dex, kind: EncounterKind, isShiny: boolean, at: number): Sighting => {
  const entry = dex[kind]
  return {
    dex: { ...dex, [kind]: { seen: (entry?.seen ?? 0) + 1, shiny: (entry?.shiny ?? 0) + (isShiny ? 1 : 0), firstAt: entry?.firstAt ?? at } },
    isNew: entry === undefined,
    isNewShiny: isShiny && (entry?.shiny ?? 0) === 0,
  }
}

export const sightingLine = (kind: EncounterKind, sighting: Sighting, seen: number, reward: number): string =>
  sighting.isNewShiny ? `반짝이는 ${DEX_NAMES[kind]} 발견! 도감에 ✦ 표시해 둘게 +${reward} 코인` : `도감에 새로 올렸어: ${DEX_NAMES[kind]} (${seen}/${DEX_KINDS.length}) +${reward} 코인`

export const kindsSeen = (dex: Dex): number => DEX_KINDS.filter(kind => (dex[kind]?.seen ?? 0) > 0).length

export const dexViews = (dex: Dex): readonly TokoDexEntry[] => DEX_KINDS.map(kind => ({ kind, name: DEX_NAMES[kind], seen: dex[kind]?.seen ?? 0, shiny: dex[kind]?.shiny ?? 0 }))

export const dexText = (views: readonly TokoDexEntry[]): string =>
  [
    `도감 ${views.filter(view => view.seen > 0).length}/${views.length} · 반짝 ${views.filter(view => view.shiny > 0).length}`,
    ...views.map(view => (view.seen > 0 ? `✓ ${view.name} ${view.seen}번${view.shiny > 0 ? ' ✦' : ''}` : '· ???')),
    '나비는 낮에만, 별똥별과 반딧불이는 저녁과 밤에만 나와요.',
  ].join('\n')
