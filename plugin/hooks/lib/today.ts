import type { TokoTally } from '../../types'

import { countOf } from './stats'
import { weekdayOf } from './time'

const prLine = (notes: readonly string[]): string | null => {
  const latest = new Map<string, string>()
  for (const note of notes) {
    const match = /^PR (#\d+) (.+)$/.exec(note)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      latest.delete(match[1])
      latest.set(match[1], match[2])
    }
  }
  return latest.size === 0 ? null : `PR ${[...latest].map(([number, action]) => `${number} ${action}`).join(', ')}`
}

const joined = (parts: readonly (string | null)[]): string | null => {
  const kept = parts.filter((part): part is string => part !== null)
  return kept.length === 0 ? null : kept.join(' · ')
}

const times = (count: number, label: string, unit = '번'): string | null => (count > 0 ? `${label} ${count}${unit}` : null)

export const todayText = (tally: TokoTally, now: number, memos: number): string => {
  const count = (key: string): number => countOf(tally.counts, key)
  const date = new Date(now)
  const lines = [
    joined([times(count('commit'), '커밋'), times(count('push'), '푸시'), times(count('merge'), 'PR 머지')]),
    prLine(tally.notes),
    joined([times(count('test-pass'), '테스트 통과'), times(count('test-fail'), '실패')]),
    count('added') + count('removed') > 0 ? `코드 +${count('added')} / -${count('removed')}줄` : null,
    joined([times(count('turn'), 'Claude 턴'), tally.costUsd > 0 ? `비용 $${tally.costUsd.toFixed(2)}` : null]),
    joined([times(count('break'), '휴식'), times(count('focus'), '집중')]),
    memos > 0 ? `남은 메모 ${memos}개` : null,
  ].filter((line): line is string => line !== null)
  return [`${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdayOf(now)}) 토코 기록`, ...(lines.length === 0 ? ['아직 남은 기록이 없어요'] : lines).map(line => `- ${line}`)].join('\n')
}
