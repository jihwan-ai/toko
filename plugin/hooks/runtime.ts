import type { EngineInterface } from 'claude-code'

import type { TokoChoice, TokoPet, TokoSettings } from '../types'

import { FOCUS_MINUTES, answerOffer, apologize, askName, balance, catchInGame, createBrain, drawPet, ensureScene, feed, fillMemo, forgetMemo, forgetSignal, greet, hush, load, moveInGame, namePet, offerLine, onAttention, onEdit, onGit, onMeasure, onSubagents, onTest, onTurnComplete, onTyping, openOffer, parkMemo, play, pollPeers, pollPlaza, progressOf, purchase, reflect, refreshShared, remember, resetDayIfNeeded, runEncounter, save, say, sendPlaza, signalPeers, startBonk, startFocus, startHatch, stopFocus, switchPet, sync, tendVisitor, think, todayTally, toggleWear } from './brain'
import type { Brain } from './brain'
import { badgeText } from './lib/badges'
import { DEX_NAMES, dexText, isEncounterKind } from './lib/dex'
import { SHOP, SPEND, shopItem } from './lib/economy'
import { readEditLines, readGitEvents, readTestOutcome } from './lib/perceive'
import type { GitOperation } from './lib/perceive'
import { signalLabel } from './lib/peers'
import { nameProblem } from './lib/persona'
import { RARITY_LABEL, SPECIES, STAGE_LABEL, UNNAMED, isAwaitingName, nameOf, rarityOf } from './lib/pet'
import { memoText } from './lib/memo'
import type { Limit } from './lib/meter'
import { findFriend } from './lib/plaza'
import type { PlazaAction } from './lib/plaza'
import { questText } from './lib/quests'
import { hashText } from './lib/random'
import type { Canvas } from './lib/raster'
import { createCanvas, encodeCells } from './lib/raster'
import { BAND_ROWS, paint, paintRoom, tick } from './lib/scene'
import { MINUTE } from './lib/time'
import { todayText } from './lib/today'
import type { ShopItem, TurnUsage } from './lib/economy'

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
      await refreshShared($, brain)
      await think($, brain)
      await pollPlaza($, brain)
      await pollPeers($, brain)
      await tendVisitor($, brain, TICK_MS * THINK_EVERY)
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
  await $.command.register({ name: 'toko', description: 'Open Toko’s room, or change how Toko behaves (/toko help)', argumentHint: '[help|mute|hide|quiet|break|ai|shop|card|plaza|peers|…]' })
  await $.command.register({ name: 'bonk', description: 'Ask Toko to bonk Claude with a squeaky hammer', argumentHint: '<reason>', immediate: true })
  await $.command.register({ name: 'feed', description: 'Give Toko a snack' })
  await $.command.register({ name: 'play', description: 'Play with Toko for a moment' })
  await $.command.register({ name: 'memo', description: 'Park a stray thought with Toko; it comes back after the turn', argumentHint: '<내용>', immediate: true })
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
  brain.costBase = await $.session
    .usage()
    .then(usage => usage.cost?.usd ?? 0)
    .catch(() => 0)
  brain.lastCostUsd = brain.costBase
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
  if (isAwaitingName(brain.pet)) {
    await askName($, brain)
    return
  }
  await greet($, brain)
}

export async function stop($: $, ctx: Ctx, reason: string): Promise<void> {
  await now($, ctx)
  await save($, ctx.brain)
  await forgetSignal($, ctx.brain)
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
  if (isPersonTyped) {
    brain.promptLabel = signalLabel(text)
  }
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
  if (brain.offer !== null && brain.offer.kind !== 'bonk-end' && brain.offer.kind !== 'name') {
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
  const edited = isError ? null : readEditLines(tool, result)
  if (edited !== null) {
    onEdit(brain, edited.added, edited.removed)
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
    name: nameOf(pet),
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

export async function measured($: $, ctx: Ctx, contextPercent: number | undefined, limits: readonly Limit[], costUsd: number | undefined): Promise<void> {
  await now($, ctx)
  await onMeasure($, ctx.brain, contextPercent, limits, costUsd)
}

export async function attention($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await onAttention($, ctx.brain)
}

export async function permissionAsked($: $, ctx: Ctx): Promise<void> {
  await attention($, ctx)
  await signalPeers($, ctx.brain, 'waiting')
}

export const HELP = [
  '/toko — 토코의 방 열기 (상점 · 꾸미기 · 펫 뽑기 · 광장)',
  '/toko mute | unmute — 말 걸기 끄기/켜기',
  '/toko hide | show — 띠 숨기기/보이기',
  '/toko quiet 22-09 | quiet off — 방해 금지 시간',
  '/toko break 50 — 휴식 권유 간격(분)',
  '/toko off-work 19 | off-work off — 퇴근 시각',
  '/toko ai on | off — 작은 모델 쓰기',
  '/toko notify on | off — OS 알림(하루 3회)',
  '/toko peers on | off — 옆 세션이 답을 마치거나 확인을 기다릴 때 알리기',
  '/toko meter on | off — 띠의 컨텍스트·비용·한도 미터',
  '/toko mood-sense on | off — 짜증 감지(프롬프트를 모델에 보냄, 기본 꺼짐)',
  '/toko shop | buy <id> | wear <id> — 상점',
  '/toko card — 펫 카드',
  '/toko focus 25 | focus off — 집중 타이머(그동안 말 걸지 않기)',
  '/toko quests — 오늘의 퀘스트',
  '/toko badges — 업적',
  '/toko dex — 인카운터 도감',
  '/toko memo [내용 | clear] — 생각 주차장 메모 (/memo <내용> 도 같음)',
  '/toko today — 오늘 한 일 요약을 클립보드에 복사',
  '/toko name <이름> — 이름 짓기 · 바꾸기',
  `/toko draw — 펫 뽑기(${SPEND.draw}코인, 알부터 키워요)`,
  '/toko pets | pick <번호|이름> — 보관함 보기 · 같이 다닐 펫 바꾸기',
  '/toko plaza on | off | wave <이름|all> | heart <이름> | snack <이름> | cheer <이름> | invite — 광장',
  '/toko event <종류> [shiny] — 이벤트나 장면 바로 보기(시연용)',
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

const badgeLine = (brain: Brain): string => {
  const badges = progressOf(brain).badges
  const unlocked = badges.filter(badge => badge.at !== null).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  const latest = unlocked.at(-1)
  return `업적 ${unlocked.length}/${badges.length}${latest === undefined ? '' : ` · 최근: ${latest.name}`}`
}

export const card = (brain: Brain): string => {
  const pet = brain.pet
  const soul = pet?.soul
  if (pet === null || soul === null || soul === undefined) {
    return '아직 알이에요. 곧 깨어나요.'
  }
  const traits = soul.traits
  return [
    `**${nameOf(pet) ?? UNNAMED}** · ${STAGE_LABEL[pet.growth.stage]} · ${SPECIES[pet.bones.species].label} · ${RARITY_LABEL[rarityOf(pet.bones)]}`,
    `성격: ${soul.personality}`,
    `말버릇: ${soul.quirk}`,
    `성향: 활발 ${traits.energetic} · 수다 ${traits.chatty} · 걱정 ${traits.worried} · 장난 ${traits.playful}`,
    `함께한 날 ${pet.growth.daysTogether}일 · 받아들인 휴식 ${pet.growth.breaksAccepted}번 · 코인 ${balance(brain)}`,
    badgeLine(brain),
    ...(brain.memory.lessons.length > 0 ? [`배운 것: ${brain.memory.lessons.at(-1)}`] : []),
  ].join('\n')
}

const shopLine = (brain: Brain, item: ShopItem): string =>
  `- ${item.id} · ${item.name} · ${item.price}코인${brain.wallet.items.includes(item.id) && item.kind !== 'snack' ? ' (보유)' : ''}`

const shopText = (brain: Brain): string =>
  [
    '상점 (/toko buy <id>):',
    ...SHOP.filter(item => item.kind !== 'pet').map(item => shopLine(brain, item)),
    '애완동물:',
    ...SHOP.filter(item => item.kind === 'pet').map(item => shopLine(brain, item)),
    `코인 ${balance(brain)}`,
  ].join('\n')

const petLine = (pet: TokoPet): string =>
  `${pet.soul === null ? '알' : (nameOf(pet) ?? UNNAMED)} · ${SPECIES[pet.bones.species].label} · ${RARITY_LABEL[rarityOf(pet.bones)]} · ${STAGE_LABEL[pet.growth.stage]}`

const shelfText = (brain: Brain): string =>
  [
    brain.pet === null ? '같이 다니는 펫이 없어요.' : `같이 다니는 펫: ${petLine(brain.pet)}`,
    ...(brain.shelf.length === 0 ? ['보관함이 비어 있어요. /toko draw 로 새 펫을 뽑아요.'] : ['보관함 (/toko pick <번호|이름>):', ...brain.shelf.map((pet, index) => `${index + 1}. ${petLine(pet)}`)]),
  ].join('\n')

const findShelved = (shelf: readonly TokoPet[], query: string): TokoPet | undefined => {
  const index = Number(query)
  return Number.isInteger(index) ? shelf[index - 1] : shelf.find(pet => pet.soul?.name === query)
}

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
    const friends = brain.friends.map(friend => `- ${friend.name} (${SPECIES[friend.species].label}, ${friend.status})`)
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
  const opened = await $.ui.open({ id: ROOM_ID, title: `${nameOf(ctx.brain.pet) ?? '토코'}의 방` })
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
    case 'peers': {
      const toggle = onOff(value)
      return toggle === null ? { text: '예: /toko peers off' } : changeSettings($, brain, { isPeersOn: toggle }, toggle ? '옆 세션 소식을 전할게요.' : '옆 세션 소식은 전하지 않을게요.')
    }
    case 'meter': {
      const toggle = onOff(value)
      return toggle === null
        ? { text: '예: /toko meter off' }
        : changeSettings($, brain, { isMeterOn: toggle }, toggle ? '띠에 컨텍스트·비용·한도를 보여 줄게요.' : '미터를 껐어요.')
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
    case 'focus':
      return { text: await focusCommand($, ctx, value) }
    case 'quests':
      return { text: questText(progressOf(brain).quests) }
    case 'badges':
      return { text: badgeText(progressOf(brain).badges) }
    case 'dex':
      return { text: dexText(progressOf(brain).dex) }
    case 'memo':
      return { text: await memoCommand($, ctx, rest.join(' ')) }
    case 'today':
      return { text: await todayCommand($, ctx) }
    case 'name': {
      if (brain.pet?.soul === null || brain.pet?.soul === undefined) {
        return { text: '아직 알이에요. 깨어나면 이름을 지어 주세요.' }
      }
      const name = rest.join(' ')
      const problem = nameProblem(name)
      if (problem !== null) {
        return { text: problem }
      }
      const line = isAwaitingName(brain.pet) ? `${name}! 마음에 쏙 들어. 잘 부탁해` : `이제 나는 ${name}! 새 이름 마음에 들어`
      await namePet($, brain, name, line)
      return { text: `이름을 "${name}"(으)로 지었어요.` }
    }
    case 'draw': {
      const text = await drawPet($, brain)
      await sync($, brain)
      return { text }
    }
    case 'pets':
      return { text: shelfText(brain) }
    case 'pick': {
      const pet = value === undefined ? undefined : findShelved(brain.shelf, rest.join(' '))
      return { text: pet === undefined ? shelfText(brain) : await switchPet($, brain, pet.id) }
    }
    case 'plaza':
      return plazaCommand($, brain, rest)
    case 'event': {
      const kind = value ?? 'stretch'
      if (isEncounterKind(kind)) {
        await runEncounter($, brain, kind, rest[1] === 'shiny')
        await sync($, brain)
        return { text: `${DEX_NAMES[kind]} 장면을 띄웠어요.` }
      }
      await openOffer($, brain, kind, offerLine(brain, kind))
      return { text: `${kind} 이벤트를 띄웠어요.` }
    }
    default:
      return { text: HELP }
  }
}

export async function todayCommand($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  await refreshShared($, brain, true)
  const summary = todayText(todayTally(brain), brain.now, brain.memos.length)
  const copied = await $.ui.copy({ text: summary }).catch(() => ({ isCopied: false as const, reason: 'refused' as const }))
  return `${summary}\n\n${copied.isCopied ? '클립보드에 복사했어요.' : `클립보드에 복사하지 못했어요(${copied.reason}). 위 글을 그대로 쓰세요.`}`
}

export async function memoCommand($: $, ctx: Ctx, args: string): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  const text = args.trim()
  if (text.length === 0) {
    return memoText(brain.memos)
  }
  if (text === 'clear') {
    await forgetMemo($, brain, null)
    return '메모를 모두 지웠어요.'
  }
  await parkMemo($, brain, text)
  return `메모를 맡아 뒀어요(${brain.memos.length}개). 턴이 끝나면 꺼내 드릴게요.`
}

export async function memoFill($: $, ctx: Ctx, id: string): Promise<void> {
  await now($, ctx)
  await fillMemo($, ctx.brain, id)
}

export async function memoDrop($: $, ctx: Ctx, id: string): Promise<void> {
  await forgetMemo($, ctx.brain, id)
}

export async function focusCommand($: $, ctx: Ctx, value: string | undefined): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  if (value === 'off' || value === 'stop') {
    if (brain.focus === null) {
      return '집중 중이 아니에요.'
    }
    await stopFocus($, brain)
    return '집중을 멈췄어요. 코인은 끝까지 했을 때만 받아요.'
  }
  if (value === undefined && brain.focus !== null) {
    return `집중 중이에요. ${Math.max(1, Math.ceil((brain.focus.endsAt - brain.now) / MINUTE))}분 남았어요. 멈추려면 /toko focus off`
  }
  const minutes = value === undefined ? FOCUS_MINUTES : Number(value)
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
    return '5~120 사이 분으로 알려 주세요. 예: /toko focus 25'
  }
  await startFocus($, brain, minutes)
  return `${minutes}분 동안 조용히 있을게요. 끝나면 쉬자고 할게요.`
}

export async function bonkCommand($: $, ctx: Ctx, args: string): Promise<{ text: string; context?: readonly string[] }> {
  await now($, ctx)
  const brain = ctx.brain
  const reason = args.trim()
  const wasRunning = brain.isTurnRunning
  await startBonk($, brain, reason)
  const name = nameOf(brain.pet) ?? '토코'
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

export async function drawFromRoom($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await drawPet($, ctx.brain)
  await sync($, ctx.brain)
}

export async function pickPet($: $, ctx: Ctx, id: string): Promise<void> {
  await now($, ctx)
  await switchPet($, ctx.brain, id)
}

export async function wearItem($: $, ctx: Ctx, id: string): Promise<void> {
  await toggleWear($, ctx.brain, id)
}

export async function plazaAct($: $, ctx: Ctx, action: PlazaAction, to: string | null): Promise<void> {
  await now($, ctx)
  await say($, ctx.brain, await sendPlaza($, ctx.brain, action, to))
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
