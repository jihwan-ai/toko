import type { EngineInterface } from 'claude-code'

import type { TokoChoice, TokoSettings } from '../types'

import { answerOffer, apologize, balance, catchInGame, createBrain, ensureScene, feed, greet, hush, load, moveInGame, offerLine, onAttention, onGit, onMeasure, onSubagents, onTest, onTurnComplete, onTyping, openOffer, play, pollPlaza, purchase, reflect, remember, resetDayIfNeeded, save, sendPlaza, startBonk, startHatch, sync, think, toggleWear } from './brain'
import type { Brain } from './brain'
import { SHOP, shopItem } from './lib/economy'
import { readGitEvents, readTestOutcome } from './lib/perceive'
import type { GitOperation } from './lib/perceive'
import { COLOR_LABEL, RARITY_LABEL, STAGE_LABEL } from './lib/pet'
import { findFriend } from './lib/plaza'
import type { PlazaAction } from './lib/plaza'
import { hashText } from './lib/random'
import type { Canvas } from './lib/raster'
import { createCanvas, encodeCells } from './lib/raster'
import { BAND_ROWS, paint, paintRoom, tick } from './lib/scene'
import type { TurnUsage } from './lib/economy'

type $ = EngineInterface

export const TICK_MS = 100
export const THINK_EVERY = 20
export const SAVE_EVERY = 300
export const BLIT_DENY_LIMIT = 6
export const ROOM_ID = 'toko-room'
export const ROOM_ROWS = 20
export const SCENE_KEY = 'toko-scene'
export const ROOM_KEY = 'toko-room-scene'

export type Site = { requestId: string; columns: number; canvas: Canvas; lastCells: string; denies: number }

export type Ctx = {
  brain: Brain
  band: Site | null
  room: Site | null
  ticks: number
  loop: { cancel: () => void } | null
  isTicking: boolean
}

export const createCtx = (serverUrl: string): Ctx => ({
  brain: createBrain(hashText(`${Date.now()}-${Math.random()}`), serverUrl),
  band: null,
  room: null,
  ticks: 0,
  loop: null,
  isTicking: false,
})

export async function now($: $, ctx: Ctx): Promise<number> {
  ctx.brain.now = await $.clock.now()
  return ctx.brain.now
}

export const siteFor = (site: Site | null, requestId: string, columns: number, rows: number): Site =>
  site !== null && site.columns === columns && site.requestId === requestId ? site : { requestId, columns, canvas: createCanvas(columns, rows), lastCells: '', denies: 0 }

async function blitSite($: $, site: Site, key: string, rows: number): Promise<void> {
  const cells = encodeCells(site.canvas)
  if (cells === site.lastCells) {
    return
  }
  site.lastCells = cells
  const result = await $.ui.blit({ requestId: site.requestId, key, cells, columns: site.columns, rows })
  if (result.deny === undefined) {
    site.denies = 0
    return
  }
  site.denies += 1
  if (site.denies >= BLIT_DENY_LIMIT) {
    site.denies = 0
    $.ui.invalidate('ui.render')
  }
}

export async function frame($: $, ctx: Ctx): Promise<void> {
  if (ctx.isTicking) {
    return
  }
  ctx.isTicking = true
  const brain = ctx.brain
  try {
    ctx.ticks += 1
    brain.now += TICK_MS
    const scene = brain.scene
    if (scene !== null && !brain.isReducedMotion) {
      tick(scene, TICK_MS, brain.random)
      if (ctx.band !== null && !brain.isLineMode) {
        paint(scene, ctx.band.canvas)
        await blitSite($, ctx.band, SCENE_KEY, BAND_ROWS)
      }
      if (ctx.room !== null && ctx.ticks % 3 === 0) {
        paintRoom(scene, ctx.room.canvas, brain.wallet.items)
        await blitSite($, ctx.room, ROOM_KEY, ROOM_ROWS)
      }
    }
    if (ctx.ticks % THINK_EVERY === 0) {
      await now($, ctx)
      await resetDayIfNeeded($, brain)
      await think($, brain)
      await pollPlaza($, brain)
      await sync($, brain)
    }
    if (ctx.ticks % SAVE_EVERY === 0 && brain.isDirty) {
      await save($, brain)
    }
  } finally {
    ctx.isTicking = false
  }
}

export async function registerSurfaces($: $): Promise<void> {
  await $.command.register({ name: 'toko', description: 'Open Toko’s room, or change how Toko behaves (/toko help)', argumentHint: '[help|mute|hide|quiet|break|ai|shop|card|plaza|…]' })
  await $.command.register({ name: 'bonk', description: 'Ask Toko to bonk Claude with a squeaky hammer', argumentHint: '<reason>', immediate: true })
  await $.command.register({ name: 'feed', description: 'Give Toko a snack' })
  await $.command.register({ name: 'play', description: 'Play with Toko for a moment' })
  await $.tool.register({
    name: 'pet_status',
    description: "Read the user's Toko companion pet: its name, mood, needs and coins. Use only when the user asks about their pet.",
    inputSchema: { type: 'object', properties: {} },
  })
  await $.tool.register({
    name: 'apologize',
    description: "Apologize to the user's Toko pet after it bonked you. Call once, right after a message that says Toko bonked you.",
    inputSchema: { type: 'object', properties: { words: { type: 'string', description: 'A short apology in the user’s language' } } },
    isDeferred: false,
  })
}

async function readEnvironment($: $, brain: Brain): Promise<void> {
  const [noColor, forceColor, term, settings] = await Promise.all([
    $.env.get('NO_COLOR'),
    $.env.get('FORCE_COLOR'),
    $.env.get('TERM'),
    $.settings.read().catch(() => ({})),
  ])
  brain.isLineMode = (noColor !== undefined && noColor !== '') || forceColor === '0' || term === 'dumb'
  brain.isReducedMotion = (settings as Record<string, unknown>).prefersReducedMotion === true
}

export async function start($: $, ctx: Ctx): Promise<void> {
  const brain = ctx.brain
  await now($, ctx)
  brain.sessionId = await $.session.id()
  await readEnvironment($, brain)
  await load($, brain)
  await reflect($, brain)
  await registerSurfaces($)
  ensureScene(brain, 80)
  await sync($, brain)
  ctx.loop?.cancel()
  ctx.loop = $.clock.every(TICK_MS, () => void frame($, ctx))
  if (brain.pet === null || brain.pet.growth.stage === 'egg') {
    $.clock.after(1500, () => void startHatch($, brain))
    return
  }
  await greet($, brain)
}

export async function stop($: $, ctx: Ctx, reason: string): Promise<void> {
  await now($, ctx)
  await save($, ctx.brain)
  if (reason !== 'clear') {
    ctx.loop?.cancel()
    ctx.loop = null
  }
}

export async function typing($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await onTyping($, ctx.brain)
}

export async function submitted($: $, ctx: Ctx, text: string, isPersonTyped: boolean): Promise<void> {
  const brain = ctx.brain
  await now($, ctx)
  brain.lastInputAt = brain.now
  brain.lastTypingAt = brain.now
  if (isPersonTyped && brain.settings.isMoodSensing && brain.settings.isAiOn && text.length > 0) {
    void $.model
      .classify(text.slice(0, 600), ['calm', 'annoyed', 'stuck'])
      .then(label => (label === 'annoyed' ? remember(brain, 'annoyed', '', 1) : undefined))
      .catch(() => undefined)
  }
}

export async function turnStarted($: $, ctx: Ctx): Promise<void> {
  const brain = ctx.brain
  await now($, ctx)
  brain.isTurnRunning = true
  brain.turnStartedAt = brain.now
  brain.typedDuringTurn = false
  brain.longTurnStage = 0
  if (brain.offer !== null && brain.offer.kind !== 'bonk-end') {
    await answerOffer($, brain, 'ignored')
  }
}

export async function turnEnded($: $, ctx: Ctx, durationMs: number, reason: string, usage: TurnUsage | undefined): Promise<void> {
  await now($, ctx)
  await onTurnComplete($, ctx.brain, durationMs, reason, usage)
  $.clock.after(1500, () => void thinkLater($, ctx))
}

async function thinkLater($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await think($, ctx.brain)
  await sync($, ctx.brain)
}

export async function toolRan($: $, ctx: Ctx, tool: string, command: string | undefined, isError: boolean, text: string, result: unknown): Promise<void> {
  const brain = ctx.brain
  if (tool === 'Agent' || tool === 'Task') {
    onSubagents(brain, 1)
  }
  if (command === undefined) {
    return
  }
  await now($, ctx)
  const outcome = readTestOutcome(command, isError, text)
  if (outcome !== null) {
    await onTest($, brain, outcome.kind, outcome.key, outcome.summary)
  }
  const operation = isError ? undefined : (result as { gitOperation?: GitOperation } | undefined)?.gitOperation
  for (const event of readGitEvents(operation)) {
    await onGit($, brain, event.kind, event.detail)
  }
}

export async function petStatus($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  const pet = brain.pet
  const soul = pet?.soul
  if (pet === null || soul === null || soul === undefined) {
    return 'Toko is still an egg.'
  }
  return JSON.stringify({
    name: soul.name,
    stage: pet.growth.stage,
    mood: brain.mood,
    needs: { energy: Math.round(brain.needs.energy), fun: Math.round(brain.needs.fun), hunger: Math.round(brain.needs.hunger), social: Math.round(brain.needs.social) },
    coins: balance(brain),
  })
}

export async function apologized($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  return apologize($, ctx.brain)
}

export async function measured($: $, ctx: Ctx, contextPercent: number | undefined, limits: readonly { percentUsed: number }[]): Promise<void> {
  await now($, ctx)
  await onMeasure($, ctx.brain, contextPercent, limits.reduce((max, limit) => Math.max(max, limit.percentUsed), 0))
}

export async function attention($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await onAttention($, ctx.brain)
}

export const HELP = [
  '/toko — 토코의 방 열기 (상점 · 꾸미기 · 광장)',
  '/toko mute | unmute — 말 걸기 끄기/켜기',
  '/toko hide | show — 띠 숨기기/보이기',
  '/toko quiet 22-09 | quiet off — 방해 금지 시간',
  '/toko break 50 — 휴식 권유 간격(분)',
  '/toko off-work 19 | off-work off — 퇴근 시각',
  '/toko ai on | off — 작은 모델 쓰기',
  '/toko notify on | off — OS 알림(하루 3회)',
  '/toko mood-sense on | off — 짜증 감지(프롬프트를 모델에 보냄, 기본 꺼짐)',
  '/toko shop | buy <id> | wear <id> — 상점',
  '/toko card — 펫 카드',
  '/toko plaza on | off | wave <이름|all> | heart <이름> | snack <이름> | cheer <이름> | invite — 광장',
  '/toko event <종류> — 이벤트 바로 보기(시연용)',
  '/bonk <이유> — 뿅망치로 Claude 때리기',
  '/feed · /play — 먹이 · 놀기',
].join('\n')

const parseHours = (text: string): readonly [number, number] | null => {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(text.trim())
  if (match === null) {
    return null
  }
  const start = Number(match[1])
  const end = Number(match[2])
  return start < 24 && end < 24 ? [start, end] : null
}

const onOff = (value: string | undefined): boolean | null => (value === 'on' ? true : value === 'off' ? false : null)

async function changeSettings($: $, brain: Brain, change: Partial<TokoSettings>, reply: string): Promise<{ text: string }> {
  brain.settings = { ...brain.settings, ...change }
  brain.isDirty = true
  await save($, brain)
  await sync($, brain)
  return { text: reply }
}

export const card = (brain: Brain): string => {
  const pet = brain.pet
  const soul = pet?.soul
  if (pet === null || soul === null || soul === undefined) {
    return '아직 알이에요. 곧 깨어나요.'
  }
  const traits = soul.traits
  return [
    `**${soul.name}** · ${STAGE_LABEL[pet.growth.stage]} · ${COLOR_LABEL[pet.bones.color]} · ${RARITY_LABEL[pet.bones.rarity]}`,
    `성격: ${soul.personality}`,
    `말버릇: ${soul.quirk}`,
    `성향: 활발 ${traits.energetic} · 수다 ${traits.chatty} · 걱정 ${traits.worried} · 장난 ${traits.playful}`,
    `함께한 날 ${pet.growth.daysTogether}일 · 받아들인 휴식 ${pet.growth.breaksAccepted}번 · 코인 ${balance(brain)}`,
    ...(brain.memory.lessons.length > 0 ? [`배운 것: ${brain.memory.lessons.at(-1)}`] : []),
  ].join('\n')
}

const shopText = (brain: Brain): string =>
  [
    '상점 (/toko buy <id>):',
    ...SHOP.map(item => `- ${item.id} · ${item.name} · ${item.price}코인${brain.wallet.items.includes(item.id) && item.kind !== 'snack' ? ' (보유)' : ''}`),
    `코인 ${balance(brain)}`,
  ].join('\n')

const PLAZA_WORDS: Readonly<Record<string, PlazaAction>> = { wave: 'wave', heart: 'heart', snack: 'snack', cheer: 'cheer', invite: 'stretch-call' }

async function plazaCommand($: $, brain: Brain, words: readonly string[]): Promise<{ text: string }> {
  const [sub, ...rest] = words
  const target = rest.join(' ')
  const toggle = onOff(sub)
  if (toggle !== null) {
    return changeSettings($, brain, { isPlazaOn: toggle }, toggle ? '광장에 나갈게요.' : '광장에서 나왔어요.')
  }
  const action = sub === undefined ? undefined : PLAZA_WORDS[sub]
  if (action === undefined) {
    const friends = brain.friends.map(friend => `- ${friend.name} (${COLOR_LABEL[friend.color]}, ${friend.status})`)
    const header = brain.serverUrl.length === 0 ? '광장 서버가 설정되지 않았어요(serverUrl).' : `광장: ${brain.settings.isPlazaOn ? '켜짐' : '꺼짐'} · 친구 ${brain.friends.length}명`
    return { text: [header, ...friends].join('\n') }
  }
  if (action === 'stretch-call' || target === 'all' || target === '') {
    return { text: await sendPlaza($, brain, action, null) }
  }
  const friend = findFriend(brain.friends, target)
  if (friend === undefined) {
    return { text: `광장에서 "${target}"을(를) 찾지 못했어요.` }
  }
  return { text: await sendPlaza($, brain, action, friend.id) }
}

export async function openRoom($: $, ctx: Ctx): Promise<string> {
  const opened = await $.ui.open({ id: ROOM_ID, title: `${ctx.brain.pet?.soul?.name ?? '토코'}의 방` })
  return opened.isPlaced ? '토코의 방을 열었어요.' : `방을 열 자리가 없어요: ${opened.reason}`
}

export async function tokoCommand($: $, ctx: Ctx, args: string): Promise<{ text: string }> {
  await now($, ctx)
  const brain = ctx.brain
  const [sub, ...rest] = args
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
  const value = rest[0]
  switch (sub) {
    case undefined:
    case 'room':
      return { text: await openRoom($, ctx) }
    case 'help':
      return { text: HELP }
    case 'mute':
      await hush($)
      return changeSettings($, brain, { isMuted: true }, '조용히 있을게요. /toko unmute 로 다시 불러요.')
    case 'unmute':
      return changeSettings($, brain, { isMuted: false }, '다시 말 걸게요.')
    case 'hide':
      return changeSettings($, brain, { isHidden: true }, '띠를 숨겼어요. 쉬자고 할 때만 잠깐 나타나요.')
    case 'show':
      return changeSettings($, brain, { isHidden: false }, '띠를 다시 보여요.')
    case 'quiet': {
      if (value === 'off') {
        return changeSettings($, brain, { quiet: null }, '방해 금지 시간을 껐어요.')
      }
      const hours = parseHours(value ?? '')
      return hours === null ? { text: '형식: /toko quiet 22-09' } : changeSettings($, brain, { quiet: hours }, `${hours[0]}시부터 ${hours[1]}시까지 조용히 있을게요.`)
    }
    case 'break': {
      const minutes = Number(value)
      return Number.isInteger(minutes) && minutes >= 15 && minutes <= 240
        ? changeSettings($, brain, { breakMinutes: minutes }, `${minutes}분마다 쉬자고 할게요.`)
        : { text: '15~240 사이 분으로 알려 주세요. 예: /toko break 50' }
    }
    case 'off-work': {
      if (value === 'off') {
        return changeSettings($, brain, { offWorkHour: null }, '퇴근 시각을 지웠어요.')
      }
      const hour = Number(value)
      return Number.isInteger(hour) && hour >= 0 && hour < 24 ? changeSettings($, brain, { offWorkHour: hour }, `${hour}시가 지나면 마무리 정리를 권할게요.`) : { text: '예: /toko off-work 19' }
    }
    case 'ai': {
      const toggle = onOff(value)
      return toggle === null ? { text: '예: /toko ai off' } : changeSettings($, brain, { isAiOn: toggle }, toggle ? '작은 모델로 생각할게요.' : '규칙과 준비된 말로만 움직일게요.')
    }
    case 'notify': {
      const toggle = onOff(value)
      return toggle === null ? { text: '예: /toko notify on' } : changeSettings($, brain, { isNotifyOn: toggle }, toggle ? 'OS 알림을 하루 3번까지 보낼게요.' : 'OS 알림을 껐어요.')
    }
    case 'mood-sense': {
      const toggle = onOff(value)
      return toggle === null
        ? { text: '예: /toko mood-sense on' }
        : changeSettings($, brain, { isMoodSensing: toggle }, toggle ? '프롬프트 분위기를 살필게요(원문은 저장하지 않아요).' : '분위기 살피기를 껐어요.')
    }
    case 'shop':
      return { text: shopText(brain) }
    case 'buy':
      return { text: value === undefined ? shopText(brain) : await purchase($, brain, value) }
    case 'wear':
      if (value === undefined || shopItem(value) === undefined) {
        return { text: '예: /toko wear beanie' }
      }
      await toggleWear($, brain, value)
      return { text: `${shopItem(value)?.name} 착용을 바꿨어요.` }
    case 'card':
      return { text: card(brain) }
    case 'plaza':
      return plazaCommand($, brain, rest)
    case 'event': {
      const kind = value ?? 'stretch'
      await openOffer($, brain, kind, offerLine(brain, kind))
      return { text: `${kind} 이벤트를 띄웠어요.` }
    }
    default:
      return { text: HELP }
  }
}

export async function bonkCommand($: $, ctx: Ctx, args: string): Promise<{ text: string; context?: readonly string[] }> {
  await now($, ctx)
  const brain = ctx.brain
  const reason = args.trim()
  const wasRunning = brain.isTurnRunning
  await startBonk($, brain, reason)
  const name = brain.pet?.soul?.name ?? '토코'
  if (!wasRunning) {
    return { text: `${name}(이)가 뿅망치를 들었어요. 삑!` }
  }
  return {
    text: `${name}(이)가 뿅망치를 들었어요. 삑!`,
    context: [
      `(사용자의 펫이 방금 장난스럽게 뿅망치로 너를 때렸다. 이유: ${reason || '없음'}. 이 턴의 답 첫머리에 "아야…"를 짧게 붙이고, 이유에 맞게 바로잡을 게 있으면 바로잡아 줘. 그리고 mcp__toko__apologize 도구를 한 번 불러 줘.)`,
    ],
  }
}

export async function feedCommand($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const text = await feed($, ctx.brain)
  await sync($, ctx.brain)
  return text
}

export async function playCommand($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const text = await play($, ctx.brain)
  await sync($, ctx.brain)
  return text
}

export async function choose($: $, ctx: Ctx, choice: TokoChoice): Promise<void> {
  await now($, ctx)
  await answerOffer($, ctx.brain, choice.key)
  await sync($, ctx.brain)
}

export async function buyItem($: $, ctx: Ctx, id: string): Promise<void> {
  await now($, ctx)
  await purchase($, ctx.brain, id)
  await sync($, ctx.brain)
}

export async function wearItem($: $, ctx: Ctx, id: string): Promise<void> {
  await toggleWear($, ctx.brain, id)
}

export async function plazaAct($: $, ctx: Ctx, action: PlazaAction, to: string | null): Promise<void> {
  await now($, ctx)
  await sendPlaza($, ctx.brain, action, to)
}

export async function gameMove($: $, ctx: Ctx, delta: number): Promise<void> {
  await moveInGame($, ctx.brain, delta)
}

export async function gameCatch($: $, ctx: Ctx): Promise<void> {
  await catchInGame($, ctx.brain)
}

export async function roomOpenedFromBand($: $, ctx: Ctx): Promise<void> {
  await openRoom($, ctx)
}
