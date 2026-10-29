import type { TokoMemo } from '../../types'

export const MAX_MEMOS = 20
export const MEMO_LENGTH = 200
export const MEMO_SETTLE_MS = 60_000
export const MEMO_RESHOW_MS = 30 * 60_000

const isMemo = (value: unknown): value is TokoMemo => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return typeof raw.id === 'string' && typeof raw.text === 'string' && typeof raw.at === 'number' && typeof raw.shownAt === 'number'
}

export const asMemos = (value: unknown): readonly TokoMemo[] => (Array.isArray(value) ? value.filter(isMemo).slice(-MAX_MEMOS) : [])

export const clipMemo = (text: string, length = MEMO_LENGTH): string => {
  const chars = [...text.replace(/\s+/g, ' ').trim()]
  return chars.length > length ? `${chars.slice(0, length - 1).join('')}…` : chars.join('')
}

export const addMemo = (memos: readonly TokoMemo[], id: string, text: string, at: number): readonly TokoMemo[] => [...memos, { id, text: clipMemo(text), at, shownAt: 0 }].slice(-MAX_MEMOS)

export const dropMemo = (memos: readonly TokoMemo[], id: string): readonly TokoMemo[] => memos.filter(memo => memo.id !== id)

export const deferMemo = (memos: readonly TokoMemo[], id: string, at: number): readonly TokoMemo[] => memos.map(memo => (memo.id === id ? { ...memo, shownAt: at } : memo))

export const dueMemo = (memos: readonly TokoMemo[], now: number, lastTurnEndAt: number): TokoMemo | undefined =>
  memos.find(memo => (memo.at < lastTurnEndAt || now - memo.at >= MEMO_SETTLE_MS) && (memo.shownAt === 0 || now - memo.shownAt >= MEMO_RESHOW_MS))

export const memoText = (memos: readonly TokoMemo[]): string =>
  memos.length === 0
    ? '맡긴 메모가 없어요. Claude가 일하는 중에도 /memo <내용> 으로 맡길 수 있어요.'
    : [`메모 ${memos.length}개 (/toko memo clear 로 모두 지우기)`, ...memos.map((memo, index) => `${index + 1}. ${memo.text}`)].join('\n')
