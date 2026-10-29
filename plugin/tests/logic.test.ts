import { expect, test } from 'claude-code/testing'

import { DAILY_TOKEN_CAP, SHOP, balanceOf, buy, capTokenIncome, emptyEarn, turnIncome, wear, wornOf } from '../hooks/lib/economy'
import { BUBBLES_PER_HOUR, canSpeak, emptyBudget, gateCandidates, learnAnswer, recordBubble } from '../hooks/lib/gate'
import { failureStreak, readGitEvents, readTestOutcome } from '../hooks/lib/perceive'
import { bonkMessage, parseIntent, parseSoul, sanitizeLine } from '../hooks/lib/persona'
import { freshSignal, signalLabel, signalText } from '../hooks/lib/peers'
import { SPECIES, SPECIES_IDS, clampName, createFallbackSoul, nextStage, rollSpecies } from '../hooks/lib/pet'
import { parseSnapshot, plazaEndpoint } from '../hooks/lib/plaza'
import type { Canvas } from '../hooks/lib/raster'
import { createRandom } from '../hooks/lib/random'
import { createCanvas, decodeGlyphs, encodeCells, setPixel, toBase64 } from '../hooks/lib/raster'
import type { Look, Step } from '../hooks/lib/scene'
import { BAND_ROWS, createScene, paint, paintRoom, tick } from '../hooks/lib/scene'
import { hex } from '../hooks/lib/sprites'
import { candidatesOf, decayNeeds, encounterOf, fullNeeds, moodOf } from '../hooks/lib/sim'
import { SPECIES_ART } from '../hooks/lib/sprites'

const usage = (output: number, cacheRead = 0) => ({ input_tokens: 1000, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: 0 })

const SETTINGS = { isMuted: false, isHidden: false, quiet: null, breakMinutes: 50, offWorkHour: null, isAiOn: true, isNotifyOn: false, isMoodSensing: false, isPlazaOn: true, isPeersOn: true, isMeterOn: true } as const

test('turn income grows on a log scale, so heavy token use pays less per token', async () => {
  expect(turnIncome(usage(0))).toBe(0)
  expect(turnIncome(usage(500))).toBe(3)
  expect(turnIncome(usage(1500))).toBe(6)
  expect(turnIncome(usage(7500))).toBe(12)
  const perTokenSmall = turnIncome(usage(500)) / 500
  const perTokenLarge = turnIncome(usage(50_000)) / 50_000
  expect(perTokenLarge < perTokenSmall / 10).toBe(true)
})

test('a cache-heavy turn earns the efficiency bonus', async () => {
  expect(turnIncome(usage(1500, 9000))).toBe(Math.round(3 * Math.log2(4) * 1.2))
})

test('token income stops at the daily cap, health rewards do not', async () => {
  expect(capTokenIncome(10, DAILY_TOKEN_CAP - 4)).toBe(4)
  expect(capTokenIncome(10, DAILY_TOKEN_CAP)).toBe(0)
  const wallet = { coins: 10, items: [], worn: [] }
  expect(balanceOf(wallet, [{ ...emptyEarn('d'), earned: 120, health: 35, spent: 5 }])).toBe(160)
})

test('the shop sells, refuses a second hat and swaps worn hats', async () => {
  const wallet = { coins: 0, items: [] as string[], worn: [] as string[] }
  const short = buy(wallet, 10, 'beanie')
  expect('reason' in short).toBe(true)
  const bought = buy(wallet, 100, 'beanie')
  if ('reason' in bought) {
    throw new Error(bought.reason)
  }
  expect(bought.spent).toBe(40)
  expect('reason' in buy(bought.wallet, 100, 'beanie')).toBe(true)
  const withCrown = { ...bought.wallet, items: [...bought.wallet.items, 'crown'] }
  const worn = wear(wear(withCrown, 'beanie'), 'crown')
  expect(worn.worn).toEqual(['crown'])
})

test('the shop sells pets, and only one comes along at a time', async () => {
  expect(SHOP.filter(item => item.kind === 'pet').map(item => item.id)).toEqual(['chick', 'hamster', 'kitten'])
  const wallet = { coins: 0, items: ['beanie', 'chick', 'kitten'], worn: ['beanie'] }
  const swapped = wear(wear(wallet, 'chick'), 'kitten')
  expect(swapped.worn).toEqual(['beanie', 'kitten'])
  expect(wornOf(swapped, 'pet')).toBe('kitten')
})

const LOOK: Look = { bones: { seed: 7, species: 'cat' }, stage: 'baby', mood: 'calm', hammer: 'toy' }
const CHICK = hex('#FFDD44')
const EYE = hex('#221122')

const colorsIn = (canvas: Canvas, fromX: number, toX: number): Set<number> => {
  const colors = new Set<number>()
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = Math.max(0, fromX); x < Math.min(canvas.width, toX); x += 1) {
      colors.add(canvas.pixels[y * canvas.width + x] ?? 0)
    }
  }
  return colors
}

const run = (look: Look, plan: readonly Step[], ms: number) => {
  const scene = createScene(100, look, () => [...plan])
  for (let at = 0; at < ms; at += 100) {
    tick(scene, 100, () => 0.5)
  }
  const canvas = createCanvas(100, BAND_ROWS)
  paint(scene, canvas)
  return { scene, canvas }
}

test('a pet from the shop trails behind toko on the ground, and naps when toko naps', async () => {
  const plan: Step[] = [{ pose: 'walk', ms: 0, toX: 70 }, { pose: 'sleep', ms: 60_000 }]
  expect(colorsIn(run(LOOK, plan, 2000).canvas, 0, 100).has(CHICK)).toBe(false)
  const walking = run({ ...LOOK, critter: 'chick' }, plan, 2000)
  const behind = Math.round(walking.scene.x)
  expect(colorsIn(walking.canvas, behind - 12, behind).has(CHICK)).toBe(true)
  expect(colorsIn(walking.canvas, behind - 12, behind).has(EYE)).toBe(true)
  expect(colorsIn(walking.canvas, behind + 16, 100).has(CHICK)).toBe(false)
  const napping = run({ ...LOOK, critter: 'chick' }, plan, 10_000)
  expect(napping.scene.current?.pose).toBe('sleep')
  expect(colorsIn(napping.canvas, 70 - 12, 70).has(CHICK)).toBe(true)
  expect(colorsIn(napping.canvas, 70 - 12, 70).has(EYE)).toBe(false)
})

test('the room shows the pet beside toko', async () => {
  const scene = createScene(100, { ...LOOK, critter: 'chick' }, () => [{ pose: 'idle', ms: 1000 }])
  const canvas = createCanvas(100, 18)
  paintRoom(scene, canvas, [])
  expect(colorsIn(canvas, 50 + 16, 100).has(CHICK)).toBe(true)
})

test('the gate holds its tongue while Claude works, while typing, and past the hourly cap', async () => {
  const presence = { now: 100_000, isTurnRunning: false, lastTypingAt: 0, lastInputAt: 0, lastTurnEndAt: 99_000 }
  expect(canSpeak(presence, SETTINGS, 14)).toBe(true)
  expect(canSpeak({ ...presence, isTurnRunning: true }, SETTINGS, 14)).toBe(false)
  expect(canSpeak({ ...presence, lastTypingAt: 95_000 }, SETTINGS, 14)).toBe(false)
  expect(canSpeak(presence, { ...SETTINGS, quiet: [22, 9] }, 23)).toBe(false)
  expect(canSpeak(presence, { ...SETTINGS, isMuted: true }, 14)).toBe(false)
  const busy = Array.from({ length: BUBBLES_PER_HOUR }, (_, index) => index * 1000).reduce((budget, at) => recordBubble(budget, at), emptyBudget('d'))
  const candidates = [{ kind: 'chat' as const, score: 20, description: '' }]
  expect(gateCandidates(candidates, busy, SETTINGS, 10_000)).toEqual([])
  expect(gateCandidates(candidates, emptyBudget('d'), SETTINGS, 10_000).length).toBe(1)
})

test('two declines in a row halve how often that kind comes back', async () => {
  const memory = { events: [], lessons: [], answersByHour: [], declineStreak: {}, kindScale: {}, reflectedDay: '' }
  const once = learnAnswer(memory, 'stretch', 'later', 15)
  expect(once.kindScale.stretch ?? 1).toBe(1)
  const twice = learnAnswer(once, 'stretch', 'later', 15)
  expect(twice.kindScale.stretch).toBe(0.5)
  expect(twice.answersByHour[15]?.declined).toBe(2)
  expect(learnAnswer(twice, 'stretch', 'ignored', 15)).toBe(twice)
})

test('three failures of the same test put "unstick" on the table', async () => {
  const context = {
    now: 0,
    hour: 14,
    needs: fullNeeds(0),
    traits: { energetic: 0.5, chatty: 0.5, worried: 0.5, playful: 0.5 },
    breakMinutes: 50,
    workingMinutes: 10,
    minutesSinceEyeRest: 5,
    minutesSinceWater: 5,
    minutesSinceChat: 5,
    waterToday: 0,
    giftsToday: 0,
    giftQuota: 1,
    failStreak: 3,
    minutesSincePassAfterFail: null,
    bonksToday: 0,
    hasCalmedToday: false,
    awayMinutes: 0,
    hasWorkMemory: true,
    offWorkHour: null,
    hasWrappedToday: false,
    rateLimitPercent: 0,
    friendsOnline: 0,
    kindScale: {},
    luck: 0.9,
  }
  expect(candidatesOf(context)[0]?.kind).toBe('unstick')
  expect(candidatesOf({ ...context, failStreak: 0 }).length).toBe(0)
  expect(candidatesOf({ ...context, failStreak: 0, workingMinutes: 70 }).map(candidate => candidate.kind)).toContain('stretch')
})

test('needs drop only while the person is at the desk, and mood follows', async () => {
  const needs = fullNeeds(0)
  expect(decayNeeds(needs, 10 * 60_000, false).energy).toBe(needs.energy)
  expect(decayNeeds(needs, 10 * 60_000, true).energy < needs.energy).toBe(true)
  expect(moodOf(needs, [{ at: 0, kind: 'test-pass', detail: '', weight: 1 }], 1000, 14, 0)).toBe('excited')
  expect(moodOf(needs, [], 1000, 14, 3)).toBe('worried')
  expect(moodOf({ ...needs, energy: 10 }, [], 1000, 14, 0)).toBe('sleepy')
})

test('random encounters wait six minutes and change with the hour', async () => {
  expect(encounterOf({ hour: 14, mood: 'calm', isWorking: true, minutesSinceEncounter: 2, luck: 0 })).toEqual([])
  const day = encounterOf({ hour: 14, mood: 'calm', isWorking: true, minutesSinceEncounter: 10, luck: 0 }).map(entry => entry.item)
  const night = encounterOf({ hour: 22, mood: 'calm', isWorking: true, minutesSinceEncounter: 10, luck: 0 }).map(entry => entry.item)
  expect(day).toContain('butterfly')
  expect(day).not.toContain('firefly')
  expect(night).toContain('shooting-star')
  expect(night).not.toContain('butterfly')
})

test('the perceiver reads tests and git from shell results', async () => {
  expect(readTestOutcome('npm test', true, 'FAIL src/a.test.ts\n  ✕ adds')?.kind).toBe('test-fail')
  expect(readTestOutcome('cd app && pnpm run test -- -u', false, '')?.kind).toBe('test-pass')
  expect(readTestOutcome('ls -la', true, '')).toBe(null)
  expect(readGitEvents({ commit: { sha: 'abcdef123', kind: 'committed', branch: 'main' }, push: { branch: 'main' } }).map(event => event.kind)).toEqual(['commit', 'push'])
  const events = [
    { kind: 'test-fail', detail: 'npm test :: x' },
    { kind: 'test-pass', detail: 'npm test' },
    { kind: 'test-fail', detail: 'npm test :: y' },
    { kind: 'test-fail', detail: 'npm test :: z' },
  ]
  expect(failureStreak(events, 'npm test')).toBe(2)
})

test('a draw lands on a known species, rare about one time in ten', async () => {
  const random = createRandom(42)
  const rolls = Array.from({ length: 4000 }, () => rollSpecies(random))
  expect(rolls.every(species => SPECIES_IDS.includes(species))).toBe(true)
  const rare = rolls.filter(species => SPECIES[species].rarity === 'rare').length / rolls.length
  expect(rare > 0.08 && rare < 0.12).toBe(true)
  expect(SPECIES_IDS.filter(species => SPECIES[species].rarity === 'rare').every(species => rolls.includes(species))).toBe(true)
  expect(clampName('  말랑이는 귀여워 ')).toBe('말랑이는')
  expect(nextStage({ stage: 'baby', daysTogether: 3, breaksAccepted: 3, lastDay: '' })).toBe('child')
  expect(nextStage({ stage: 'baby', daysTogether: 30, breaksAccepted: 0, lastDay: '' })).toBe('baby')
})

test('model replies are parsed defensively', async () => {
  const fallback = createFallbackSoul(7, 'now')
  const soul = parseSoul('여기요 {"name":"콩떡","personality":"느긋해","quirk":"\\"음…\\"","traits":{"energetic":2,"chatty":0.3}}', fallback, clampName)
  expect(soul?.name).toBe('콩떡')
  expect(soul?.traits.energetic).toBe(1)
  expect(parseSoul('nope', fallback, clampName)).toBe(null)
  const candidates = [{ kind: 'stretch' as const, score: 10, description: '' }]
  expect(parseIntent('{"intent":"stretch","line":"쭉 펴자"}', candidates)?.intent).toBe('stretch')
  expect(parseIntent('{"intent":"launch-rockets","line":"가자"}', candidates)?.intent).toBe('stay_quiet')
  expect(parseIntent('잘 모르겠어요', candidates)).toBe(null)
  expect(sanitizeLine('바보야 쉬어')).toBe(null)
  expect(bonkMessage('말랑', '테스트 지우지 말랬잖아')).toContain('mcp__toko__apologize')
})

test('cells encode half blocks: top pixel is the foreground, transparent is the terminal default', async () => {
  const canvas = createCanvas(3, 1)
  setPixel(canvas, 0, 0, 0xff0000)
  setPixel(canvas, 1, 1, 0x00ff00)
  setPixel(canvas, 2, 0, 0x0000ff)
  setPixel(canvas, 2, 1, 0xffffff)
  const cells = encodeCells(canvas)
  expect(cells.length).toBe(Math.ceil((3 * 12) / 3) * 4)
  expect(decodeGlyphs(cells, 3)).toEqual(['▀▄▀'])
  expect(toBase64(Uint8Array.of(1, 2, 3, 4))).toBe('AQIDBA==')
})

test('every species body fits the 16 by 14 pet frame', async () => {
  for (const species of SPECIES_IDS) {
    const body = SPECIES_ART[species].body
    expect([species, body.length]).toEqual([species, 14])
    expect(body.filter(row => row.length !== 16)).toEqual([])
  }
})

test('plaza snapshots drop my own echo and anything malformed', async () => {
  const body = JSON.stringify({
    now: 5,
    friends: [
      { id: 'me', name: '나', color: 'mint', mood: 'calm', status: 'idle', lastSeen: 1 },
      { id: 'f1', name: '콩떡', color: 'peach', species: 'fox', mood: 'excited', status: 'working', lastSeen: 1 },
      { id: 'f3', name: '옛친구', color: 'mint', species: 'kraken', mood: 'calm', status: 'idle', lastSeen: 1 },
      { id: 'f2', name: '이상해', color: 'rainbow' },
    ],
    events: [{ id: 'e1', at: 1, kind: 'wave', from: { id: 'f1', name: '콩떡', color: 'peach' }, to: 'me', line: '안녕!' }],
  })
  const snapshot = parseSnapshot(body, 'me')
  expect(snapshot?.friends.map(friend => [friend.id, friend.species])).toEqual([
    ['f1', 'fox'],
    ['f3', 'cat'],
  ])
  expect(snapshot?.events[0]?.from.species).toBe('cat')
  expect(snapshot?.events[0]?.line).toBe('안녕!')
  expect(parseSnapshot('not json', 'me')).toBe(null)
  expect(plazaEndpoint('https://plaza.example/', '/v1/poll')).toBe('https://plaza.example/v1/poll')
  expect(plazaEndpoint('javascript:alert(1)', '/v1/poll')).toBe(null)
})

test('the freshest signal of another session is picked, own and seen ones are not', async () => {
  const done = { kind: 'done', at: 300, label: '배포' }
  const entries = [
    { key: 'toko:signal:me', value: { kind: 'done', at: 900, label: '나' } },
    { key: 'toko:signal:a', value: { kind: 'waiting', at: 100, label: '오래됨' } },
    { key: 'toko:signal:b', value: done },
    { key: 'toko:signal:c', value: { kind: 'done', at: 200, label: '덜 최근' } },
    { key: 'toko:signal:d', value: { kind: 'sleeping', at: 950, label: '모름' } },
  ]
  expect(freshSignal(entries, 'toko:signal:me', 150)).toEqual(done)
  expect(freshSignal(entries, 'toko:signal:me', 300)).toBe(null)
})

test('a signal reads as the prompt it answered, cut to 16 characters', async () => {
  expect(signalLabel('  배포   확인\n해 줘, 그리고 로그도 같이 봐 줘  ')).toBe('배포 확인 해 줘, 그리고 로')
  expect(signalText({ kind: 'done', at: 0, label: '배포 확인' })).toBe('「배포 확인」 세션이 답을 마쳤어요')
  expect(signalText({ kind: 'waiting', at: 0, label: '' })).toBe('다른 세션이 확인을 기다려요')
})
