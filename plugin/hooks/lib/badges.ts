import type { TokoBadge, TokoCounts } from '../../types'

export type BadgeDef = { id: string; name: string; description: string; key: string; goal: number; reward: number }

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-break', name: '첫 쉼표', description: '권유받은 휴식을 처음 끝까지 하기', key: 'break', goal: 1, reward: 10 },
  { id: 'break-10', name: '쉼표 수집가', description: '휴식 10번', key: 'break', goal: 10, reward: 30 },
  { id: 'break-50', name: '쉼의 달인', description: '휴식 50번', key: 'break', goal: 50, reward: 80 },
  { id: 'eye-20', name: '먼 산 바라기', description: '먼 곳 보기 20번', key: 'eye-rest', goal: 20, reward: 30 },
  { id: 'water-20', name: '물 마시는 하마', description: '물 한 모금 20번', key: 'water', goal: 20, reward: 30 },
  { id: 'breathe-5', name: '깊은 숨', description: '숨 고르기 5번', key: 'breathe', goal: 5, reward: 20 },
  { id: 'comeback', name: '역전승', description: '세 번 이상 실패한 테스트를 끝내 통과시키기', key: 'comeback', goal: 1, reward: 20 },
  { id: 'comeback-10', name: '오뚝이', description: '역전승 10번', key: 'comeback', goal: 10, reward: 50 },
  { id: 'first-merge', name: '첫 머지', description: 'PR 머지 1번', key: 'merge', goal: 1, reward: 20 },
  { id: 'merge-10', name: '머지 장인', description: 'PR 머지 10번', key: 'merge', goal: 10, reward: 60 },
  { id: 'commit-100', name: '백 걸음', description: '커밋 100번', key: 'commit', goal: 100, reward: 50 },
  { id: 'focus-10', name: '몰입의 시간', description: '집중 타이머 10번 끝까지', key: 'focus', goal: 10, reward: 40 },
  { id: 'wrapup-5', name: '정시 퇴근', description: '마무리 정리 5번', key: 'wrapup', goal: 5, reward: 50 },
  { id: 'quest-7', name: '성실한 하루들', description: '오늘의 퀘스트를 다 한 날 7일', key: 'quest-day', goal: 7, reward: 60 },
  { id: 'dex-8', name: '도감 완성', description: '인카운터 8종을 모두 보기', key: 'dex', goal: 8, reward: 80 },
  { id: 'shiny', name: '행운의 목격자', description: '반짝이는 장면 보기', key: 'shiny', goal: 1, reward: 30 },
  { id: 'bug-30', name: '벌레 사냥꾼', description: '벌레 30마리 잡기', key: 'bug', goal: 30, reward: 30 },
  { id: 'bug-200', name: '벌레 박사', description: '벌레 200마리 잡기', key: 'bug', goal: 200, reward: 80 },
  { id: 'fed-20', name: '단골 요리사', description: '밥 20번 주기', key: 'fed', goal: 20, reward: 20 },
  { id: 'cheer-10', name: '다정한 이웃', description: '광장 친구에게 마음 10번 보내기', key: 'cheer', goal: 10, reward: 30 },
]

export type Unlocked = Readonly<Record<string, number>>

export const asUnlocked = (value: unknown): Unlocked =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'))
    : {}

export const newBadges = (counts: TokoCounts, unlocked: Unlocked): readonly BadgeDef[] =>
  BADGES.filter(badge => unlocked[badge.id] === undefined && (counts[badge.key] ?? 0) >= badge.goal)

export const badgeViews = (counts: TokoCounts, unlocked: Unlocked): readonly TokoBadge[] =>
  BADGES.map(badge => ({ id: badge.id, name: badge.name, description: badge.description, progress: Math.min(badge.goal, counts[badge.key] ?? 0), goal: badge.goal, at: unlocked[badge.id] ?? null }))

export const closestBadges = (views: readonly TokoBadge[], limit = 3): readonly TokoBadge[] =>
  views
    .filter(view => view.at === null)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal)
    .slice(0, limit)

export const badgeText = (views: readonly TokoBadge[]): string =>
  [
    `업적 ${views.filter(view => view.at !== null).length}/${views.length}`,
    ...views.map(view => (view.at === null ? `· ${view.name} ${view.progress}/${view.goal} (${view.description})` : `✓ ${view.name} (${view.description})`)),
  ].join('\n')
