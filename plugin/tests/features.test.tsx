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

type Shell = { isError: boolean; text: string; gitOperation?: unknown }

const shell = (on: On, outcome: Shell): Shell => {
  on('tool.call', () => ({ result: { stdout: outcome.text, stderr: '', gitOperation: outcome.gitOperation }, isError: outcome.isError, text: outcome.text }) as never)
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

const QUESTS_PAID = { day: '2026-10-29', ids: ['stretch', 'eye-rest', 'water', 'test-pass', 'commit', 'fed', 'played', 'cheer', 'all'] }

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
