import type { TokoCounts, TokoQuest } from '../../types'

import { createRandom, hashText, pick } from './random'

export type QuestGroup = 'rest' | 'work' | 'care'

export type QuestDef = { id: string; label: string; key: string; goal: number; group: QuestGroup; needsPlaza?: boolean }

export const QUESTS: readonly QuestDef[] = [
  { id: 'stretch', label: '기지개 켜기', key: 'stretch', goal: 1, group: 'rest' },
  { id: 'eye-rest', label: '먼 곳 보기', key: 'eye-rest', goal: 2, group: 'rest' },
  { id: 'water', label: '물 한 모금', key: 'water', goal: 1, group: 'rest' },
  { id: 'test-pass', label: '테스트 통과', key: 'test-pass', goal: 1, group: 'work' },
  { id: 'commit', label: '커밋하기', key: 'commit', goal: 1, group: 'work' },
  { id: 'focus', label: '집중 타이머 끝내기', key: 'focus', goal: 1, group: 'work' },
  { id: 'fed', label: '토코 밥 주기', key: 'fed', goal: 1, group: 'care' },
  { id: 'played', label: '같이 놀기', key: 'played', goal: 1, group: 'care' },
  { id: 'cheer', label: '광장 친구에게 손짓', key: 'cheer', goal: 1, group: 'care', needsPlaza: true },
]

export const QUEST_REWARD = 5
export const QUEST_BONUS = 10
export const ALL_DONE = 'all'

export const questsFor = (day: string, seed: number, hasPlaza: boolean): readonly QuestDef[] => {
  const random = createRandom(hashText(`${day}:${seed}`))
  return (['rest', 'work', 'care'] as const).map(group => pick(random, QUESTS.filter(quest => quest.group === group && (hasPlaza || quest.needsPlaza !== true))))
}

export const questViews = (quests: readonly QuestDef[], counts: TokoCounts): readonly TokoQuest[] =>
  quests.map(quest => ({ id: quest.id, label: quest.label, progress: Math.min(quest.goal, counts[quest.key] ?? 0), goal: quest.goal, isDone: (counts[quest.key] ?? 0) >= quest.goal }))

export type QuestsPaid = { day: string; ids: readonly string[] }

export const asPaid = (value: unknown, day: string): QuestsPaid => {
  const raw = typeof value === 'object' && value !== null ? (value as { day?: unknown; ids?: unknown }) : {}
  return raw.day === day && Array.isArray(raw.ids) ? { day, ids: raw.ids.filter((id): id is string => typeof id === 'string') } : { day, ids: [] }
}

export const questsDue = (views: readonly TokoQuest[], paid: readonly string[]): readonly string[] => {
  const done = views.filter(view => view.isDone).map(view => view.id)
  return [...done, ...(views.length > 0 && done.length === views.length ? [ALL_DONE] : [])].filter(id => !paid.includes(id))
}

export const questText = (views: readonly TokoQuest[]): string =>
  [
    `오늘의 퀘스트 ${views.filter(view => view.isDone).length}/${views.length} (하나에 ${QUEST_REWARD}코인, 다 하면 ${QUEST_BONUS}코인과 선물 상자)`,
    ...views.map(view => `${view.isDone ? '✓' : '·'} ${view.label} ${view.progress}/${view.goal}`),
  ].join('\n')
