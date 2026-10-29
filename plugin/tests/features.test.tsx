import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PET = {
  bones: { seed: 7, color: 'mint', pattern: 'spots', eyes: 'round', rarity: 'rare' },
  soul: { name: '말랑', personality: '느긋하고 다정한 아이', quirk: '"말랑~"', traits: { energetic: 0.5, chatty: 0.7, worried: 0.6, playful: 0.5 }, hatchedAt: '2026-10-01T00:00:00.000Z', isFallback: false, isNamed: true },
  growth: { stage: 'baby', daysTogether: 2, breaksAccepted: 1, lastDay: '2026-10-29' },
}

const START = Date.UTC(2026, 9, 29, 5, 0, 0)

const BAND = {
  plugin: 'toko',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const ROOM = {
  plugin: 'toko',
  component: 'Pane',
  requestId: 'toko-room',
  props: { title: '말랑의 방', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

type World = { filled: string[]; copied: string[]; saved: Record<string, unknown>; deleted: string[]; memory: Map<string, unknown> }

const engine = (on: On, store: Record<string, unknown>): World => {
  const memory = new Map(Object.entries(store))
  const world: World = { filled: [], copied: [], saved: {}, deleted: [], memory }
  on('store.get', (_, e) => ({ value: memory.get(e.key) }))
  on('store.set', (_, e) => {
    memory.set(e.key, JSON.parse(JSON.stringify(e.value)))
    world.saved[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    memory.delete(e.key)
    world.deleted.push(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...memory.keys()] }))
  mock.env(on, { TERM: 'xterm-256color' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__toko__${e.name}` } }))
  on('ui.blit', () => ({ value: {} }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.copy', (_, e) => {
    world.copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('model.complete', () => ({ value: { isAnswered: true, text: '{"intent":"stay_quiet"}', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.fill', (_, e) => {
    world.filled.push(e.text)
    return { isFilled: true }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId ?? 't' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return world
}

const wait = async (clock: { advance: (ms: number) => Promise<void> }, ms: number) => {
  for (let left = ms; left > 0; left -= 5 * 60_000) {
    await clock.advance(Math.min(left, 5 * 60_000))
  }
}

const begin = async ($: Engine) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

const end = async ($: Engine) => $.session.end({ reason: 'other', sessionId: 'session-1', resume: {} } as never)

const runTurn = async ($: Engine, clock: { advance: (ms: number) => Promise<void> }, durationMs = 20_000) => {
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await clock.advance(durationMs)
  await $.turn.complete({
    answer: 'done',
    durationMs,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: { input_tokens: 2000, output_tokens: 1500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' },
  })
}

type Shell = { isError: boolean; text: string; gitOperation?: unknown; result?: unknown }

const shell = (on: On, outcome: Shell): Shell => {
  on('tool.call', () => ({ result: outcome.result ?? { stdout: outcome.text, stderr: '', gitOperation: outcome.gitOperation }, isError: outcome.isError, text: outcome.text }) as never)
  return outcome
}

const bash = async ($: Engine, command: string) => $.tool.call({ tool: 'Bash', command } as never)

test('a session keeps its day in a tally of its own, and the next session folds old days into the record', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, {
    'toko:pet': PET,
    'toko:stats': { total: { commit: 5 }, days: [] },
    'toko:tally:yesterday': { day: '2026-10-28', counts: { commit: 2 }, notes: [], costUsd: 1 },
    'toko:tally:other': { day: '2026-10-29', counts: { commit: 1 }, notes: [], costUsd: 0 },
  })
  await begin($)
  expect((world.saved['toko:stats'] as { total: { commit: number } }).total.commit).toBe(7)
  expect(world.deleted).toContain('toko:tally:yesterday')
  expect(world.deleted).not.toContain('toko:tally:other')
  await runTurn($, clock)
  await end($)
  expect((world.saved['toko:tally:session-1'] as { counts: { turn: number } }).counts.turn).toBe(1)
})

test('a test that failed three times and then passes unlocks 역전승, pays coins and shows on the card and in the room', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  const outcome = shell(on, { isError: true, text: 'FAIL src/login.test.ts ✕ logs in' })
  await begin($)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await bash($, 'npm test')
  }
  outcome.isError = false
  await bash($, 'npm test')
  await clock.advance(2500)
  expect((world.saved['toko:badges'] as Record<string, number>).comeback).toBeDefined()
  expect((await $.command.run({ command: 'toko', args: 'badges' } as never)).text).toContain('✓ 역전승')
  expect((await $.command.run({ command: 'toko', args: 'card' } as never)).text).toMatch(/업적 1\/\d+ · 최근: 역전승/)
  const room = await $.ui.mount({ ...ROOM, surface: 'terminal' })
  expect(await room.find({ type: 'Text', text: /✓ 역전승/ })).toBeDefined()
  await room.unmount()
  await end($)
  expect((world.saved['toko:earn:session-1'] as { health: number }).health).toBe(20)
})

const DEX_DONE = Object.fromEntries(['butterfly', 'leaves', 'crumb', 'bubbles', 'shooting-star', 'rain', 'sprout', 'firefly'].map(kind => [kind, { seen: 1, shiny: 1, firstAt: START }]))

const QUESTS_PAID = { day: '2026-10-29', ids: ['stretch', 'eye-rest', 'water', 'test-pass', 'commit', 'focus', 'fed', 'played', 'cheer', 'all'] }

test('a badge another terminal already unlocked is not paid twice', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:quests': QUESTS_PAID })
  await begin($)
  await $.command.run({ command: 'toko', args: 'event water' } as never)
  world.memory.set('toko:badges', { 'first-break': START })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'choice-accept' })
  await clock.advance(2500)
  await ui.unmount()
  await end($)
  expect((world.saved['toko:earn:session-1'] as { health: number }).health).toBe(5)
})

test('today’s quests show on the band, and finishing all three pays out once with a gift', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 50, items: [], worn: [] } })
  shell(on, { isError: false, text: 'ok', gitOperation: { commit: { sha: 'abc1234def', kind: 'committed', branch: 'main' } } })
  on('http.fetch', () => ({ value: { status: 202, ok: true, headers: {}, text: '{}' } }))
  await begin($)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /퀘스트 0\/3/ })).toBeDefined()
  await band.unmount()
  const listed = (await $.command.run({ command: 'toko', args: 'quests' } as never)).text ?? ''
  const takeBreak = async (kind: string, ms: number) => {
    await $.command.run({ command: 'toko', args: `event ${kind}` } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await ui.press({ key: 'choice-accept' })
    await ui.unmount()
    await clock.advance(ms)
  }
  for (const label of listed.split('\n').slice(1).map(line => line.slice(2).replace(/ \d+\/\d+$/, ''))) {
    if (label === '기지개 켜기') await takeBreak('stretch', 32_000)
    if (label === '먼 곳 보기') {
      await takeBreak('eye-rest', 22_000)
      await takeBreak('eye-rest', 22_000)
    }
    if (label === '물 한 모금') await takeBreak('water', 500)
    if (label === '테스트 통과') await bash($, 'npm test')
    if (label === '커밋하기') await bash($, 'git commit -m done')
    if (label === '집중 타이머 끝내기') {
      await $.command.run({ command: 'toko', args: 'focus 5' } as never)
      await wait(clock, 5 * 60_000 + 2500)
    }
    if (label === '토코 밥 주기') await $.command.run({ command: 'feed', args: '' } as never)
    if (label === '같이 놀기') await $.command.run({ command: 'play', args: '' } as never)
    if (label === '광장 친구에게 손짓') await $.command.run({ command: 'toko', args: 'plaza wave all' } as never)
  }
  await clock.advance(2500)
  expect((await $.command.run({ command: 'toko', args: 'quests' } as never)).text).toContain('오늘의 퀘스트 3/3')
  expect((world.saved['toko:quests'] as { ids: string[] }).ids).toContain('all')
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /퀘스트 3\/3/ })).toBeDefined()
  await after.unmount()
  await clock.advance(70_000)
  await end($)
  const tally = world.saved['toko:tally:session-1'] as { counts: Record<string, number> }
  expect(tally.counts['quest-day']).toBe(1)
  expect((world.saved['toko:wallet'] as { items: string[] }).items.length > 0).toBe(true)
})

test('/toko focus hushes the pet until the timer ends, then offers a stretch at the next gap', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:quests': QUESTS_PAID, 'toko:dex': DEX_DONE, 'toko:badges': { 'dex-8': START, shiny: START } })
  shell(on, { isError: false, text: 'ok' })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'focus 5' } as never)).text).toContain('5분')
  expect((await $.command.run({ command: 'toko', args: 'focus' } as never)).text).toContain('남았어요')
  await bash($, 'npm test')
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /집중 5분 남음/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /통과|해냈다/ })).toBeUndefined()
  await band.unmount()
  await wait(clock, 5 * 60_000 + 2500)
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /5분 집중 끝/ })).toBeDefined()
  await after.press({ key: 'choice-accept' })
  await after.unmount()
  await clock.advance(32_000)
  await end($)
  const tally = world.saved['toko:tally:session-1'] as { counts: Record<string, number> }
  expect(tally.counts.focus).toBe(1)
  expect(tally.counts.stretch).toBe(1)
  expect((world.saved['toko:earn:session-1'] as { health: number }).health).toBe(10 + 15 + 10)
})

test('stopping a focus early pays nothing and the room offers to start one again', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:quests': QUESTS_PAID })
  await begin($)
  await $.command.run({ command: 'toko', args: '' } as never)
  const room = await $.ui.mount({ ...ROOM, surface: 'terminal' })
  await room.press({ key: 'focus-start' })
  await clock.advance(100)
  expect(await room.find({ type: 'Text', text: /집중 중 · 25분 남음/ })).toBeDefined()
  await room.press({ key: 'focus-stop' })
  await clock.advance(100)
  expect(await room.find({ type: 'Button', key: 'focus-start' })).toBeDefined()
  await room.unmount()
  await $.command.run({ command: 'toko', args: 'focus 5' } as never)
  expect((await $.command.run({ command: 'toko', args: 'focus off' } as never)).text).toContain('멈췄어요')
  await wait(clock, 6 * 60_000)
  expect((await $.command.run({ command: 'toko', args: 'focus 3' } as never)).text).toContain('5~120')
  await end($)
  expect((world.saved['toko:tally:session-1'] as { counts: Record<string, number> }).counts.focus).toBeUndefined()
})

test('a scene seen for the first time joins the dex with coins, and a shiny one sparkles', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:quests': QUESTS_PAID })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'event butterfly' } as never)).text).toContain('나비')
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /도감에 새로 올렸어: 나비 \(1\/8\)/ })).toBeDefined()
  await band.unmount()
  await clock.advance(6000)
  await $.command.run({ command: 'toko', args: 'event butterfly shiny' } as never)
  await $.command.run({ command: 'toko', args: 'event butterfly' } as never)
  await clock.advance(2500)
  expect((await $.command.run({ command: 'toko', args: 'dex' } as never)).text).toContain('✓ 나비 3번 ✦')
  expect((await $.command.run({ command: 'toko', args: 'badges' } as never)).text).toContain('✓ 행운의 목격자')
  await $.command.run({ command: 'toko', args: '' } as never)
  const room = await $.ui.mount({ ...ROOM, surface: 'terminal' })
  expect(await room.find({ type: 'Text', text: /도감 1\/8 · 반짝 1/ })).toBeDefined()
  await room.unmount()
  await end($)
  expect((world.saved['toko:dex'] as Record<string, { seen: number }>).butterfly?.seen).toBe(3)
  expect((world.saved['toko:earn:session-1'] as { health: number }).health).toBe(5 + 15 + 30)
})

test('the band carries a context, cost and limit meter that turns yellow as it fills, and /toko meter off hides it', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  on('session.usage', () => ({ value: { startedAt: START, context: { window: 200_000 }, rateLimits: [], cost: { usd: 0.24 } } }))
  await begin($)
  await $.session.measure({
    context: { window: 200_000, tokens: 150_000, percent: 75 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 82, resetsAt: '2026-10-29T08:30:00Z' }],
    cost: { usd: 1.24 },
    changed: ['context', 'rateLimits', 'cost'],
  } as never)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const gauge = await band.find({ type: 'Text', text: /컨텍스트 75% · \$1\.24 · 5시간 82% \(\d\d:\d\d 리셋\)/ })
  expect(gauge?.props.color).toBe('yellow')
  await band.unmount()
  expect((await $.command.run({ command: 'toko', args: 'meter off' } as never)).text).toContain('껐어요')
  const hidden = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await hidden.find({ type: 'Text', text: /컨텍스트/ })).toBeUndefined()
  await hidden.unmount()
  await end($)
  expect((world.saved['toko:tally:session-1'] as { costUsd: number }).costUsd).toBe(1)
})

test('with the band hidden, the prompt hint still carries the context percent', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>{String((e.props as { tail?: string }).tail ?? '')}</Text>
  })
  await begin($)
  await $.session.measure({ context: { window: 200_000, percent: 64 }, rateLimits: [], changed: ['context'] } as never)
  await $.command.run({ command: 'toko', args: 'hide' } as never)
  const hint = await $.ui.mount({ plugin: 'toko', component: 'PromptHint', requestId: 'hint', surface: 'terminal', props: {} } as never)
  expect(await hint.find({ type: 'Text', text: /말랑 .* 0c · 64%/ })).toBeDefined()
  await hint.unmount()
})

test('/memo parked during a turn comes back once the turn ends and goes into the prompt box', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  await begin($)
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  expect((await $.command.run({ command: 'memo', args: '로그 포맷도 바꾸기' } as never)).text).toContain('맡아 뒀어요(1개)')
  await clock.advance(10_000)
  await $.turn.complete({ answer: 'done', durationMs: 10_000, isAborted: false, turnId: 't1', reason: 'answer', usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' } })
  await clock.advance(2500)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /아까 맡긴 메모: 로그 포맷도 바꾸기/ })).toBeDefined()
  await band.press({ key: 'choice-accept' })
  await band.unmount()
  expect(world.filled).toEqual(['로그 포맷도 바꾸기'])
  expect(world.saved['toko:memos']).toEqual([])
})

test('/toko memo lists memos, the room puts one in the prompt or drops it, and clear empties the lot', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  await $.command.run({ command: 'toko', args: 'memo 첫 번째 생각' } as never)
  await $.command.run({ command: 'memo', args: '두 번째 생각' } as never)
  const listed = (await $.command.run({ command: 'toko', args: 'memo' } as never)).text
  expect(listed).toContain('1. 첫 번째 생각')
  expect(listed).toContain('2. 두 번째 생각')
  await $.command.run({ command: 'toko', args: '' } as never)
  const room = await $.ui.mount({ ...ROOM, surface: 'terminal' })
  expect(await room.find({ type: 'Text', text: /메모 2개/ })).toBeDefined()
  const fills = (await room.findAll({ type: 'Button' })).map(button => button.key ?? '').filter(key => key.startsWith('memo-fill-'))
  await room.press({ key: fills[0] ?? '' })
  expect(world.filled).toEqual(['첫 번째 생각'])
  expect(await room.find({ type: 'Text', text: /메모 1개/ })).toBeDefined()
  await room.unmount()
  expect((await $.command.run({ command: 'toko', args: 'memo clear' } as never)).text).toContain('모두 지웠어요')
  expect(world.saved['toko:memos']).toEqual([])
})

test('/toko today sums up every terminal’s day and copies it, and the room button copies it too', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:tally:other': { day: '2026-10-29', counts: { commit: 2 }, notes: ['PR #7 merged'], costUsd: 0.5 } })
  on('session.usage', () => ({ value: { startedAt: START, context: { window: 1 }, rateLimits: [], cost: { usd: 0 } } }))
  const outcome = shell(on, { isError: false, text: 'ok', gitOperation: { commit: { sha: 'abc1234def', kind: 'committed', branch: 'main' } } })
  await begin($)
  await bash($, 'git commit -m one')
  outcome.gitOperation = undefined
  await bash($, 'npm test')
  outcome.result = { structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: ['+a', '+b', '-c'] }] }
  await $.tool.call({ tool: 'Edit', file_path: '/work/a.ts', old_string: 'c', new_string: 'a\nb' } as never)
  await runTurn($, clock)
  await $.session.measure({ context: { window: 1 }, rateLimits: [], cost: { usd: 1.25 }, changed: ['cost'] } as never)
  const text = (await $.command.run({ command: 'toko', args: 'today' } as never)).text ?? ''
  expect(text).toContain('- 커밋 3번')
  expect(text).toContain('- PR #7 merged')
  expect(text).toContain('- 테스트 통과 1번')
  expect(text).toContain('- 코드 +2 / -1줄')
  expect(text).toContain('- Claude 턴 1번 · 비용 $1.75')
  expect(text).toContain('클립보드에 복사했어요')
  expect(world.copied).toEqual([text.split('\n\n')[0]])
  await $.command.run({ command: 'toko', args: '' } as never)
  const room = await $.ui.mount({ ...ROOM, surface: 'terminal' })
  await room.press({ key: 'today-copy' })
  await room.unmount()
  expect(world.copied.length).toBe(2)
})
