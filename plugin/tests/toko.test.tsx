import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PET = {
  bones: { seed: 7, color: 'mint', pattern: 'spots', eyes: 'round', rarity: 'rare' },
  soul: { name: '말랑', personality: '느긋하고 다정한 아이', quirk: '"말랑~"', traits: { energetic: 0.5, chatty: 0.7, worried: 0.6, playful: 0.5 }, hatchedAt: '2026-10-01T00:00:00.000Z', isFallback: false },
  growth: { stage: 'baby', daysTogether: 2, breaksAccepted: 1, lastDay: '2026-10-29' },
}

const START = Date.UTC(2026, 9, 29, 5, 0, 0)

const BAND = {
  plugin: 'toko',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

type World = { submitted: string[]; filled: string[]; blits: number; models: string[]; saved: Record<string, unknown> }

const engine = (on: On, store: Record<string, unknown>, modelText = '{"intent":"stay_quiet"}'): World => {
  const world: World = { submitted: [], filled: [], blits: 0, models: [], saved: {} }
  const memory = new Map(Object.entries(store))
  on('store.get', (_, e) => ({ value: memory.get(e.key) }))
  on('store.set', (_, e) => {
    memory.set(e.key, JSON.parse(JSON.stringify(e.value)))
    world.saved[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    memory.delete(e.key)
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
  on('ui.blit', () => {
    world.blits += 1
    return { value: {} }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }))
  on('ui.log', () => ({ value: undefined }))
  on('model.complete', (_, e) => {
    world.models.push(e.prompt)
    return { value: { isAnswered: true, text: modelText, usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  on('prompt.submit', (_, e) => {
    world.submitted.push(e.text)
    return { text: e.text }
  })
  on('prompt.fill', (_, e) => {
    world.filled.push(e.text)
    return { isFilled: true }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId ?? 't' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return world
}

const drawEngine = (on: On): void => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    const props = e.props as { message?: string | null; word?: string }
    return <Text>{props.message ?? props.word ?? 'engine'}</Text>
  })
}

const begin = async ($: Engine) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

const runTurn = async ($: Engine, clock: { advance: (ms: number) => Promise<void> }, outputTokens: number, durationMs = 20_000) => {
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await clock.advance(durationMs)
  await $.turn.complete({
    answer: 'done',
    durationMs,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: { input_tokens: 2000, output_tokens: outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' },
  })
}

test('a first session lays an egg, hatches it and names the pet', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const store: Record<string, unknown> = {}
  const world = engine(on, store, '{"name":"콩떡","personality":"조용히 곁을 지키는 아이","quirk":"\\"음…\\"","traits":{"energetic":0.4,"chatty":0.6,"worried":0.5,"playful":0.7}}')
  await begin($)
  await clock.advance(9000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /콩떡/ })).toBeDefined()
  expect(world.models.some(prompt => prompt.includes('영혼'))).toBe(true)
  await ui.unmount()
})

test('the band draws a pixel scene and repaints it by blit, not by redraw', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /말랑/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'feed' })).toBeDefined()
  await clock.advance(3000)
  expect(world.blits > 0).toBe(true)
  await ui.unmount()
})

test('a narrow band and the desktop fall back to one line of text', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  for (const [surface, columns] of [
    ['terminal', 40],
    ['desktop', 120],
  ] as const) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: columns } })
    expect(await ui.find({ type: 'Text', text: /말랑/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a finished turn pays coins on a log scale and the turn line shows them', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  drawEngine(on)
  await begin($)
  await runTurn($, clock, 1500)
  const ui = await $.ui.mount({
    plugin: 'toko',
    component: 'TurnDuration',
    requestId: 'm1',
    surface: 'terminal',
    props: { word: 'Baked', durationMs: 20_000 },
  } as never)
  expect(await ui.find({ type: 'Text', text: /\+6 코인/ })).toBeDefined()
  await ui.unmount()
  await $.session.end({ reason: 'other', sessionId: 'session-1', resume: {} } as never)
  const earn = world.saved['toko:earn:session-1'] as { earned: number }
  expect(earn.earned).toBe(6)
})

test('/bonk while idle runs the show, then sends Claude a message and offers a calm finish', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const result = await $.command.run({ command: 'bonk', args: '테스트 지우지 말랬잖아' } as never)
  expect(result.text).toContain('뿅망치')
  await clock.advance(4000)
  expect(world.submitted.some(text => text.includes('테스트 지우지 말랬잖아') && text.includes('mcp__toko__apologize'))).toBe(true)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'choice-breathe' })).toBeDefined()
  await ui.press({ key: 'choice-tell' })
  await clock.advance(200)
  expect(world.filled.length).toBe(1)
  await ui.unmount()
})

test('/bonk mid-turn turns the spinner into "아야…" and rides the turn as hidden context', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  drawEngine(on)
  await begin($)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  const result = await $.command.run({ command: 'bonk', args: '왜 그래' } as never)
  expect(result.context?.[0]).toContain('아야')
  await clock.advance(2000)
  const spinner = await $.ui.mount({ plugin: 'toko', component: 'Spinner', requestId: 'agent', surface: 'terminal', props: { word: 'Baking', message: null, suffix: '…', mode: 'responding' } } as never)
  expect(await spinner.find({ type: 'Text', text: /아야…/ })).toBeDefined()
  await spinner.unmount()
})

test('Claude’s apology tool lifts the pet’s mood', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  const answer = await $.tool.call({ tool: 'mcp__toko__apologize', words: '미안해' } as never)
  expect(String(answer.result)).toContain('사과를 받아 줬어요')
  const status = await $.tool.call({ tool: 'mcp__toko__pet_status' } as never)
  expect(String(status.result)).toContain('"mood":"excited"')
})

test('three failures of one test end in a gentle "step away" offer at the next gap', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET }, 'not json')
  on('tool.call', (_, e) => ({ result: { stdout: 'FAIL', stderr: '' }, isError: true, text: 'FAIL src/login.test.ts ✕ logs in' }) as never)
  await begin($)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  }
  await runTurn($, clock, 400, 5000)
  await clock.advance(4000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'choice-accept' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /막혔|일어났다|떨어져/ })).toBeDefined()
  await ui.press({ key: 'choice-accept' })
  expect(await ui.find({ type: 'Text', text: /잠깐 일어났다 오기/ })).toBeDefined()
  await ui.unmount()
})

test('/toko mute keeps the pet quiet, and settings survive in the store', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const muted = await $.command.run({ command: 'toko', args: 'mute' } as never)
  expect(muted.text).toContain('조용히')
  expect((world.saved['toko:settings'] as { isMuted: boolean }).isMuted).toBe(true)
  const card = await $.command.run({ command: 'toko', args: 'card' } as never)
  expect(card.text).toContain('말랑')
  const help = await $.command.run({ command: 'toko', args: 'help' } as never)
  expect(help.text).toContain('/bonk')
})

test('feeding without snacks buys a cookie when coins allow', async ($, on) => {
  mock.clock(on, { now: START })
  const store: Record<string, unknown> = { 'toko:pet': PET, 'toko:wallet': { coins: 7, items: [], worn: [] } }
  engine(on, store)
  await begin($)
  const fed = await $.command.run({ command: 'feed', args: '' } as never)
  expect(fed.text).toContain('토큰 쿠키')
  const poor = await $.command.run({ command: 'feed', args: '' } as never)
  expect(poor.text).toContain('모자라요')
})

test('the room pane draws the pet card, the shop and the plaza', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 90, items: ['beanie'], worn: [] } })
  await begin($)
  await $.command.run({ command: 'toko', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'toko',
      component: 'Pane',
      requestId: 'toko-room',
      surface,
      props: { title: '말랑의 방', isFocused: true, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })
    expect(await ui.find({ type: 'Text', text: /상점/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'wear-beanie' })).toBeDefined()
    await ui.press({ key: 'buy-crown' })
    await ui.unmount()
  }
})

test('the plaza polls the server and a friend’s wave reaches the pet', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  const calls: string[] = []
  on('http.fetch', (_, e) => {
    calls.push(e.url)
    const body = JSON.stringify({
      now: START,
      friends: [{ id: 'f1', name: '콩떡', color: 'peach', mood: 'calm', status: 'working', lastSeen: START }],
      events: [{ id: 'e1', at: START, kind: 'wave', from: { id: 'f1', name: '콩떡', color: 'peach' }, to: 'me', line: '같이 쉬자!' }],
    })
    return { value: { status: 200, ok: true, headers: {}, text: body } }
  })
  await begin($)
  await clock.advance(25_000)
  expect(calls.some(url => url === 'http://plaza.test/v1/poll')).toBe(true)
  const status = await $.command.run({ command: 'toko', args: 'plaza' } as never)
  expect(status.text).toContain('콩떡')
  const sent = await $.command.run({ command: 'toko', args: 'plaza heart 콩떡' } as never)
  expect(sent.text).toContain('보냈어요')
})
