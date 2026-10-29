import type { TokoCounts, TokoStats, TokoTally } from '../../types'

export const STATS_DAYS = 7
export const MAX_NOTES = 12

export type StatKey =
  | 'break'
  | 'stretch'
  | 'eye-rest'
  | 'water'
  | 'breathe'
  | 'bug'
  | 'fed'
  | 'played'
  | 'gift'
  | 'cheer'
  | 'commit'
  | 'push'
  | 'pr'
  | 'merge'
  | 'test-pass'
  | 'test-fail'
  | 'comeback'
  | 'turn'
  | 'added'
  | 'removed'
  | 'focus'
  | 'wrapup'
  | 'quest-day'
  | 'encounter'
  | 'shiny'
  | 'memo'

export const emptyTally = (day: string): TokoTally => ({ day, counts: {}, notes: [], costUsd: 0 })

export const emptyStats = (): TokoStats => ({ total: {}, days: [] })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const asCounts = (value: unknown): TokoCounts =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))) : {}

export const asTally = (value: unknown): TokoTally | null =>
  isRecord(value) && typeof value.day === 'string'
    ? {
        day: value.day,
        counts: asCounts(value.counts),
        notes: Array.isArray(value.notes) ? value.notes.filter((note): note is string => typeof note === 'string').slice(-MAX_NOTES) : [],
        costUsd: typeof value.costUsd === 'number' && Number.isFinite(value.costUsd) ? value.costUsd : 0,
      }
    : null

export const asStats = (value: unknown): TokoStats =>
  isRecord(value) ? { total: asCounts(value.total), days: (Array.isArray(value.days) ? value.days : []).map(asTally).filter((tally): tally is TokoTally => tally !== null) } : emptyStats()

export const addCounts = (base: TokoCounts, more: TokoCounts): TokoCounts => {
  const sum: Record<string, number> = { ...base }
  for (const [key, value] of Object.entries(more)) {
    sum[key] = (sum[key] ?? 0) + value
  }
  return sum
}

export const bump = (tally: TokoTally, key: StatKey, amount = 1): TokoTally => (amount > 0 ? { ...tally, counts: addCounts(tally.counts, { [key]: amount }) } : tally)

export const addNote = (tally: TokoTally, text: string): TokoTally => ({ ...tally, notes: [...tally.notes, text].slice(-MAX_NOTES) })

export const mergeDay = (day: string, tallies: readonly TokoTally[]): TokoTally =>
  tallies
    .filter(tally => tally.day === day)
    .reduce(
      (sum, tally) => ({ day, counts: addCounts(sum.counts, tally.counts), notes: [...sum.notes, ...tally.notes].slice(-MAX_NOTES), costUsd: sum.costUsd + tally.costUsd }),
      emptyTally(day),
    )

export const foldTally = (stats: TokoStats, tally: TokoTally): TokoStats => ({
  total: addCounts(stats.total, tally.counts),
  days: [...stats.days.filter(entry => entry.day !== tally.day), mergeDay(tally.day, [...stats.days, tally])].sort((a, b) => a.day.localeCompare(b.day)).slice(-STATS_DAYS),
})

export const todayOf = (stats: TokoStats, live: readonly TokoTally[], day: string): TokoTally => mergeDay(day, [...stats.days, ...live])

export const totalOf = (stats: TokoStats, live: readonly TokoTally[]): TokoCounts => live.reduce((sum, tally) => addCounts(sum, tally.counts), stats.total)

export const countOf = (counts: TokoCounts, key: string): number => counts[key] ?? 0
