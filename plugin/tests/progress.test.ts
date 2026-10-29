import { expect, test } from 'claude-code/testing'

import { readEditLines } from '../hooks/lib/perceive'
import { addNote, asStats, asTally, bump, emptyStats, emptyTally, foldTally, todayOf, totalOf } from '../hooks/lib/stats'

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
