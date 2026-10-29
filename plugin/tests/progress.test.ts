import { expect, test } from 'claude-code/testing'

import { BADGES, badgeViews, closestBadges, newBadges } from '../hooks/lib/badges'
import { DEX_KINDS, asDex, dexText, dexViews, kindsSeen, mergeDex, recordSighting } from '../hooks/lib/dex'
import { addMemo, deferMemo, dropMemo, dueMemo } from '../hooks/lib/memo'
import { meterLevel, meterOf, meterText } from '../hooks/lib/meter'
import { readEditLines } from '../hooks/lib/perceive'
import { ALL_DONE, questViews, questsDue, questsFor } from '../hooks/lib/quests'
import { addNote, asStats, asTally, bump, emptyStats, emptyTally, foldTally, todayOf, totalOf } from '../hooks/lib/stats'
import { todayText } from '../hooks/lib/today'

test('a tally folds into the record by day and into the lifetime total', async () => {
  const monday = bump(bump(emptyTally('2026-10-26'), 'commit', 2), 'break')
  const again = addNote(bump(emptyTally('2026-10-26'), 'commit'), 'PR #3 merged')
  const stats = foldTally(foldTally(emptyStats(), monday), again)
  expect(stats.total).toEqual({ commit: 3, break: 1 })
  expect(stats.days.length).toBe(1)
  expect(stats.days[0]?.counts).toEqual({ commit: 3, break: 1 })
  expect(stats.days[0]?.notes).toEqual(['PR #3 merged'])
})

test('today adds what the record holds to every live session, and keeps a week at most', async () => {
  let stats = emptyStats()
  for (let day = 1; day <= 9; day += 1) {
    stats = foldTally(stats, bump(emptyTally(`2026-10-0${day}`), 'turn'))
  }
  expect(stats.days.length).toBe(7)
  expect(stats.total.turn).toBe(9)
  const mine = { ...bump(emptyTally('2026-10-09'), 'commit'), costUsd: 1.5 }
  const other = { ...bump(emptyTally('2026-10-09'), 'commit'), costUsd: 0.25 }
  const todays = todayOf(stats, [mine, other], '2026-10-09')
  expect(todays.counts).toEqual({ turn: 1, commit: 2 })
  expect(todays.costUsd).toBe(1.75)
  expect(totalOf(stats, [mine, other]).commit).toBe(2)
})

test('stored records are read defensively', async () => {
  expect(asTally(null)).toBe(null)
  expect(asTally({ day: '2026-10-29', counts: { turn: 2, bad: 'x' }, notes: [1, 'ok'] })).toEqual({ day: '2026-10-29', counts: { turn: 2 }, notes: ['ok'], costUsd: 0 })
  expect(asStats('nope')).toEqual(emptyStats())
  expect(asStats({ total: { turn: 1 }, days: [{ day: 'x', counts: {} }, 7] }).days.length).toBe(1)
})

test('edits count the lines a patch adds and removes, and a new file counts as added', async () => {
  const patch = { structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [' a', '-b', '+c', '+d'] }] }
  expect(readEditLines('Edit', patch)).toEqual({ added: 2, removed: 1 })
  expect(readEditLines('Write', { type: 'create', content: 'a\nb\nc', structuredPatch: [] })).toEqual({ added: 3, removed: 0 })
  expect(readEditLines('Bash', patch)).toBe(null)
  expect(readEditLines('Edit', 'oops')).toBe(null)
})

test('badges unlock once a lifetime count reaches the goal, and never twice', async () => {
  expect(newBadges({ break: 1 }, {}).map(badge => badge.id)).toEqual(['first-break'])
  expect(newBadges({ break: 12, comeback: 1 }, { 'first-break': 1 }).map(badge => badge.id)).toEqual(['break-10', 'comeback'])
  expect(newBadges({ break: 12 }, { 'first-break': 1, 'break-10': 2 })).toEqual([])
  expect(BADGES.every(badge => badge.reward > 0 && badge.goal > 0)).toBe(true)
})

test('the closest locked badges come first', async () => {
  const views = badgeViews({ break: 9, commit: 10, bug: 29 }, { 'first-break': 1 })
  expect(views.find(view => view.id === 'first-break')?.at).toBe(1)
  expect(closestBadges(views, 2).map(view => view.id)).toEqual(['bug-30', 'break-10'])
})

test('the day and the pet pick the same three quests in every terminal, one of each kind', async () => {
  const quests = questsFor('2026-10-29', 7, true)
  expect(questsFor('2026-10-29', 7, true)).toEqual(quests)
  expect(quests.map(quest => quest.group)).toEqual(['rest', 'work', 'care'])
  for (let seed = 0; seed < 40; seed += 1) {
    expect(questsFor('2026-10-29', seed, false).some(quest => quest.needsPlaza === true)).toBe(false)
  }
  const days = new Set(Array.from({ length: 10 }, (_, day) => questsFor(`2026-11-${String(day + 1).padStart(2, '0')}`, 7, true).map(quest => quest.id).join()))
  expect(days.size > 1).toBe(true)
})

test('finished quests come due once, and the full set adds the bonus', async () => {
  const quests = questsFor('2026-10-29', 7, false)
  const keys = Object.fromEntries(quests.map(quest => [quest.key, quest.goal]))
  const half = questViews(quests, { [quests[0]?.key ?? '']: quests[0]?.goal ?? 1 })
  expect(questsDue(half, [])).toEqual([quests[0]?.id])
  const all = questViews(quests, keys)
  expect(questsDue(all, [])).toEqual([...quests.map(quest => quest.id), ALL_DONE])
  expect(questsDue(all, [...quests.map(quest => quest.id), ALL_DONE])).toEqual([])
})

test('the dex counts first sightings and first shiny ones, and merges across terminals', async () => {
  const first = recordSighting({}, 'butterfly', false, 10)
  expect(first.isNew).toBe(true)
  const shiny = recordSighting(first.dex, 'butterfly', true, 20)
  expect(shiny.isNew).toBe(false)
  expect(shiny.isNewShiny).toBe(true)
  expect(recordSighting(shiny.dex, 'butterfly', true, 30).isNewShiny).toBe(false)
  const merged = mergeDex(shiny.dex, { firefly: { seen: 2, shiny: 0, firstAt: 5 } })
  expect(kindsSeen(merged)).toBe(2)
  expect(merged.butterfly).toEqual({ seen: 2, shiny: 1, firstAt: 10 })
  expect(asDex({ butterfly: { seen: 1 }, dragon: { seen: 9 }, rain: 'x' })).toEqual({ butterfly: { seen: 1, shiny: 0, firstAt: 0 } })
  expect(dexText(dexViews(merged))).toContain(`도감 2/${DEX_KINDS.length} · 반짝 1`)
})

test('the meter shows context, cost and the busiest limit, and warns as they fill', async () => {
  const calm = meterOf(42, 1.236, [{ kind: 'five_hour', percentUsed: 30 }, { kind: 'seven_day', percentUsed: 12 }])
  expect(meterText(calm)).toBe('컨텍스트 42% · $1.24 · 5시간 30%')
  expect(meterLevel(calm)).toBe('normal')
  expect(meterLevel(meterOf(72, 0, []))).toBe('warn')
  expect(meterLevel(meterOf(10, 0, [{ kind: 'seven_day', percentUsed: 91 }]))).toBe('alert')
  expect(meterText(meterOf(undefined, undefined, [{ kind: 'seven_day', percentUsed: 85, resetsAt: '2026-10-29T08:30:00Z' }]))).toMatch(/^7일 85% \(\d\d:\d\d 리셋\)$/)
  expect(meterText(meterOf(undefined, undefined, []))).toBe('')
})

test('memos are tidied and capped, and come back after the turn they were parked in', async () => {
  expect(addMemo([], 'a', '  로그   포맷도\n바꾸기 ', 0)[0]?.text).toBe('로그 포맷도 바꾸기')
  expect([...(addMemo([], 'b', 'x'.repeat(300), 0)[0]?.text ?? '')].length).toBe(200)
  let memos = addMemo([], 'first', 'x', 0)
  for (let index = 0; index < 25; index += 1) {
    memos = addMemo(memos, `m${index}`, 'x', index)
  }
  expect(memos.length).toBe(20)
  const one = addMemo([], 'a', '생각', 1000)
  expect(dueMemo(one, 2000, 0)).toBeUndefined()
  expect(dueMemo(one, 2000, 1500)?.id).toBe('a')
  expect(dueMemo(one, 62_000, 0)?.id).toBe('a')
  const later = deferMemo(one, 'a', 70_000)
  expect(dueMemo(later, 130_000, 80_000)).toBeUndefined()
  expect(dueMemo(later, 70_000 + 30 * 60_000, 80_000)?.id).toBe('a')
  expect(dropMemo(one, 'a')).toEqual([])
})

test('the day sums up in a few lines, skipping what did not happen and keeping each PR once', async () => {
  const afternoon = new Date(2026, 9, 29, 14, 0).getTime()
  const tally = {
    day: '2026-10-29',
    counts: { commit: 5, push: 2, merge: 1, 'test-pass': 7, 'test-fail': 3, added: 420, removed: 133, turn: 34, break: 4, focus: 2 },
    notes: ['PR #12 created', 'PR #15 created', 'PR #12 merged'],
    costUsd: 4.123,
  }
  expect(todayText(tally, afternoon, 1).split('\n')).toEqual([
    '10월 29일 (목) 토코 기록',
    '- 커밋 5번 · 푸시 2번 · PR 머지 1번',
    '- PR #15 created, #12 merged',
    '- 테스트 통과 7번 · 실패 3번',
    '- 코드 +420 / -133줄',
    '- Claude 턴 34번 · 비용 $4.12',
    '- 휴식 4번 · 집중 2번',
    '- 남은 메모 1개',
  ])
  expect(todayText(emptyTally('2026-10-29'), afternoon, 0)).toBe('10월 29일 (목) 토코 기록\n- 아직 남은 기록이 없어요')
})
