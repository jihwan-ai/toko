import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

import type { TokoMood } from '../types'

import { ensureScene } from './brain'
import { closestBadges } from './lib/badges'
import { SHOP, SPEND, shopItem } from './lib/economy'
import { meterLevel, meterText } from './lib/meter'
import { RARITY_LABEL, SPECIES, STAGE_LABEL, UNNAMED, nameOf, rarityOf } from './lib/pet'
import { ACTION_LABEL, visitorText } from './lib/plaza'
import { encodeCells } from './lib/raster'
import { BAND_ROWS, paint, paintRoom, resize } from './lib/scene'
import { KAOMOJI } from './lib/sprites'
import {
  ROOM_ID,
  ROOM_KEY,
  ROOM_ROWS,
  SCENE_KEY,
  apologized,
  attention,
  bonkCommand,
  buyItem,
  choose,
  createCtx,
  drawFromRoom,
  feedCommand,
  focusCommand,
  gameCatch,
  gameMove,
  measured,
  memoCommand,
  memoDrop,
  memoFill,
  permissionAsked,
  petStatus,
  pickPet,
  playCommand,
  plazaAct,
  roomOpenedFromBand,
  siteFor,
  start,
  stop,
  submitted,
  todayCommand,
  tokoCommand,
  toolRan,
  turnEnded,
  turnStarted,
  typing,
  wearItem,
} from './runtime'

const petAtom = atom({ plugin: 'toko', key: 'pet' } as const, null)
const shelfAtom = atom({ plugin: 'toko', key: 'shelf' } as const, [])
const needsAtom = atom({ plugin: 'toko', key: 'needs' } as const, null)
const moodAtom = atom({ plugin: 'toko', key: 'mood' } as const, 'calm')
const walletAtom = atom({ plugin: 'toko', key: 'wallet' } as const, null)
const settingsAtom = atom({ plugin: 'toko', key: 'settings' } as const, null)
const bubbleAtom = atom({ plugin: 'toko', key: 'bubble' } as const, null)
const offerAtom = atom({ plugin: 'toko', key: 'offer' } as const, null)
const ouchAtom = atom({ plugin: 'toko', key: 'ouch' } as const, false)
const earningsAtom = atom({ plugin: 'toko', key: 'earnings' } as const, [])
const gameAtom = atom({ plugin: 'toko', key: 'game' } as const, null)
const countdownAtom = atom({ plugin: 'toko', key: 'countdown' } as const, null)
const plazaAtom = atom({ plugin: 'toko', key: 'plaza' } as const, null)
const lessonsAtom = atom({ plugin: 'toko', key: 'lessons' } as const, [])
const progressAtom = atom({ plugin: 'toko', key: 'progress' } as const, null)
const focusAtom = atom({ plugin: 'toko', key: 'focus' } as const, null)
const meterAtom = atom({ plugin: 'toko', key: 'meter' } as const, null)
const memosAtom = atom({ plugin: 'toko', key: 'memos' } as const, [])
const visitorAtom = atom({ plugin: 'toko', key: 'visitor' } as const, null)

const MIN_PIXEL_COLUMNS = 60
const BAND_TREE_ROWS = BAND_ROWS + 3

const displayWidth = (text: string): number => [...text].reduce((width, char) => width + ((char.codePointAt(0) ?? 0) >= 0x1100 ? 2 : 1), 0)

const MOOD_LABEL: Readonly<Record<TokoMood, string>> = { excited: '신남', calm: '평온', sleepy: '졸림', worried: '걱정', sulky: '삐짐' }

const SHELVES = [
  ['상점', SHOP.filter(item => item.kind !== 'pet')],
  ['애완동물', SHOP.filter(item => item.kind === 'pet')],
] as const

const press = (fn: () => Promise<unknown>) => () => {
  void fn()
}

const left = (seconds: number): string => (seconds >= 60 ? `${Math.ceil(seconds / 60)}분 남음` : `${seconds}초 남음`)

const bar = (value: number): string => `${'█'.repeat(Math.round(value / 10))}${'░'.repeat(10 - Math.round(value / 10))}`

export const register: Register = (on, options) => {
  const ctx = createCtx(typeof options.serverUrl === 'string' ? options.serverUrl : '')

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await start($, ctx)
    return result
  })

  on('session.end', async ($, e, next) => {
    await stop($, ctx, e.reason)
    return next(e)
  })

  on('prompt.edit', ($, e, next) => {
    $.clock.after(1, () => void typing($, ctx))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await submitted($, ctx, e.text, e.origin.kind === 'composer' && e.command === undefined && e.isMeta !== true)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await turnStarted($, ctx)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      await turnEnded($, ctx, e.durationMs, e.reason, e.usage)
    }
    return result
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined) {
      const command = e.tool === 'Bash' ? e.command : undefined
      await toolRan($, ctx, String(e.tool), command, ran.isError === true, ran.text ?? '', ran.result)
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__toko__pet_status' }, async $ => ({ result: await petStatus($, ctx) })).catch(() => ({ result: 'Toko is napping right now.' }))

  on('tool.call', { tool: 'mcp__toko__apologize' }, async $ => ({ result: await apologized($, ctx) })).catch(() => ({ result: 'Toko heard the apology.' }))

  on('session.measure', async ($, e, next) => {
    await measured($, ctx, e.context.percent, e.rateLimits, e.cost?.usd)
    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    if (e.notification_type === 'permission_prompt' || e.notification_type === 'idle_prompt') {
      await attention($, ctx)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.PermissionRequest', async ($, e, next) => {
    await permissionAsked($, ctx)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'toko' }, async ($, e) => tokoCommand($, ctx, e.args))

  on('command.run', { command: 'bonk' }, async ($, e) => bonkCommand($, ctx, e.args))

  on('command.run', { command: 'feed' }, async $ => ({ text: await feedCommand($, ctx) }))

  on('command.run', { command: 'play' }, async $ => ({ text: await playCommand($, ctx) }))

  on('command.run', { command: 'memo' }, async ($, e) => ({ text: await memoCommand($, ctx, e.args) }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [settings, offer, pet] = await Promise.all([read($, settingsAtom), read($, offerAtom), read($, petAtom)])
    if (e.props.hasSurvey || pet === null || (settings?.isHidden === true && offer === null)) {
      ctx.band = null
      return next(e)
    }
    const [mood, bubble, wallet, countdown, game, progress, focus, meter] = await Promise.all([
      read($, moodAtom),
      read($, bubbleAtom),
      read($, walletAtom),
      read($, countdownAtom),
      read($, gameAtom),
      read($, progressAtom),
      read($, focusAtom),
      read($, meterAtom),
    ])
    const { Box, Text, Button } = $.ui.resolve(e)
    const brain = ctx.brain
    const columns = Math.min(512, Math.max(1, e.props.bodyColumns))
    const isLine = brain.isLineMode || e.surface !== 'terminal' || columns < MIN_PIXEL_COLUMNS || e.props.maxRows < BAND_TREE_ROWS
    const seconds = (until: number): number => Math.max(0, Math.ceil((until - brain.now) / 1000))
    const status = [
      `${nameOf(pet) ?? (pet.soul === null ? '알' : UNNAMED)} ${KAOMOJI[mood]}`,
      pet.growth.stage === 'egg' ? '부화 중' : MOOD_LABEL[mood],
      `코인 ${wallet?.coins ?? 0}`,
      ...(progress === null || pet.soul === null ? [] : [`퀘스트 ${progress.quests.filter(quest => quest.isDone).length}/${progress.quests.length}`]),
      ...(focus === null ? [] : [`집중 ${left(seconds(focus.endsAt))}`]),
      ...(countdown === null ? [] : [`${countdown.label} ${seconds(countdown.endsAt)}초`]),
      ...(game === null ? [] : [`벌레 ${game.caught}마리 · ${seconds(game.endsAt)}초`]),
    ].join(' · ')
    const buttons =
      game !== null
        ? [
            <Button key="left" label="◀" hotkey="a" onPress={press(() => gameMove($, ctx, -8))} />,
            <Button key="catch" label="잡기" hotkey="s" variant="primary" onPress={press(() => gameCatch($, ctx))} />,
            <Button key="right" label="▶" hotkey="d" onPress={press(() => gameMove($, ctx, 8))} />,
          ]
        : offer !== null
          ? offer.choices.map(choice => (
              <Button
                key={`choice-${choice.key}`}
                label={choice.label}
                hotkey={choice.hotkey}
                variant={choice.key === 'accept' || choice.key === 'breathe' ? 'primary' : 'secondary'}
                onPress={press(() => choose($, ctx, choice))}
              />
            ))
          : [
              <Button key="feed" label="먹이" hotkey="f" onPress={press(() => feedCommand($, ctx))} />,
              <Button key="play" label="놀기" hotkey="p" onPress={press(() => playCommand($, ctx))} />,
              <Button key="room" label="방" hotkey="r" onPress={press(() => roomOpenedFromBand($, ctx))} />,
            ]
    const gauge = settings?.isMeterOn === false || meter === null ? '' : meterText(meter)
    const level = meter === null ? 'normal' : meterLevel(meter)
    const controls = (
      <Box justifyContent="space-between">
        <Box gap={1}>{buttons}</Box>
        {gauge.length > 0 && (
          <Text color={level === 'alert' ? 'red' : level === 'warn' ? 'yellow' : undefined} dimColor={level === 'normal'} wrap="truncate-end">
            {gauge}
          </Text>
        )}
      </Box>
    )
    if (isLine) {
      ctx.band = null
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end">
            {status}
            <Text dimColor>{bubble === null ? '' : ` “${bubble.text}”`}</Text>
          </Text>
          {controls}
        </Box>
      )
    }
    const scene = ensureScene(brain, columns)
    resize(scene, columns)
    const band = siteFor(ctx.band, e.requestId, columns, BAND_ROWS)
    ctx.band = band
    paint(scene, band.canvas)
    band.lastCells = encodeCells(band.canvas)
    const { Raster } = $.ui.resolve({ ...e, surface: 'terminal' as const })
    const said = bubble === null ? '' : `“${bubble.text}”`
    const indent = Math.max(0, Math.min(columns - displayWidth(said), Math.round(scene.x + 8 - displayWidth(said) / 2)))
    return (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-end">
          {status}
        </Text>
        <Text dimColor={bubble?.tone === 'quiet'} wrap="truncate-end">
          {`${' '.repeat(indent)}${said}`}
        </Text>
        <Raster key={SCENE_KEY} columns={columns} rows={BAND_ROWS} cells={band.lastCells} />
        {controls}
      </Box>
    )
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (await read($, ouchAtom)) {
      return next({ ...e, props: { ...e.props, message: '아야…' } })
    }
    const visitor = await read($, visitorAtom)
    return visitor === null ? next(e) : next({ ...e, props: { ...e.props, message: visitorText(visitor) } })
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const earnings = await read($, earningsAtom)
    const drawn = await next(e)
    const match = [...earnings].reverse().find(earning => Math.abs(earning.durationMs - e.props.durationMs) < 1500 && earning.coins > 0)
    if (e.props.isExpanded === true || match === undefined) {
      return drawn
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        {drawn}
        <Text color="yellow"> +{match.coins} 코인</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const [settings, pet, mood, wallet, meter] = await Promise.all([read($, settingsAtom), read($, petAtom), read($, moodAtom), read($, walletAtom), read($, meterAtom)])
    if (pet === null || pet.soul === null || (settings?.isHidden !== true && !ctx.brain.isLineMode)) {
      return next(e)
    }
    const context = settings?.isMeterOn === false || meter?.contextPercent === null || meter?.contextPercent === undefined ? '' : ` · ${Math.round(meter.contextPercent)}%`
    return next({ ...e, props: { ...e.props, tail: `${nameOf(pet) ?? UNNAMED} ${KAOMOJI[mood]} ${wallet?.coins ?? 0}c${context}` } })
  })

  on('ui.render', { component: 'Pane', requestId: ROOM_ID }, async ($, e) => {
    const [pet, shelf, wallet, needs, mood, plaza, lessons, progress, focus, memos] = await Promise.all([
      read($, petAtom),
      read($, shelfAtom),
      read($, walletAtom),
      read($, needsAtom),
      read($, moodAtom),
      read($, plazaAtom),
      read($, lessonsAtom),
      read($, progressAtom),
      read($, focusAtom),
      read($, memosAtom),
    ])
    const { Box, Text, Button } = $.ui.resolve(e)
    const brain = ctx.brain
    const columns = Math.min(512, Math.max(20, e.props.bodyColumns))
    const soul = pet?.soul
    const items = wallet?.items ?? []
    const worn = wallet?.worn ?? []
    const hasPicture = e.surface === 'terminal' && brain.scene !== null && !brain.isLineMode
    if (hasPicture && brain.scene !== null) {
      const site = siteFor(ctx.room, e.requestId, columns, ROOM_ROWS)
      ctx.room = site
      paintRoom(brain.scene, site.canvas, items)
      site.lastCells = encodeCells(site.canvas)
    } else {
      ctx.room = null
    }
    const { Raster } = $.ui.resolve({ ...e, surface: 'terminal' as const })
    const owned = SHOP.filter(item => item.kind !== 'snack' && items.includes(item.id))
    const snacks = items.filter(id => shopItem(id)?.kind === 'snack').length
    return (
      <Box flexDirection="column" gap={1}>
        {hasPicture && ctx.room !== null && <Raster key={ROOM_KEY} columns={columns} rows={ROOM_ROWS} cells={ctx.room.lastCells} />}
        <Box flexDirection="column">
          <Text weight="bold">{pet === null || soul === null || soul === undefined ? '알' : `${nameOf(pet) ?? UNNAMED} · ${SPECIES[pet.bones.species].label} · ${STAGE_LABEL[pet.growth.stage]} · ${MOOD_LABEL[mood]} ${KAOMOJI[mood]}`}</Text>
          {soul !== null && soul !== undefined && (
            <Text dimColor>
              {soul.personality} — {soul.quirk}
            </Text>
          )}
          {needs !== null && (
            <Text>
              기운 {bar(needs.energy)} 재미 {bar(needs.fun)} 배부름 {bar(needs.hunger)} 교감 {bar(needs.social)}
            </Text>
          )}
          <Text>
            코인 {wallet?.coins ?? 0} · 간식 {snacks}개 · 함께한 날 {pet?.growth.daysTogether ?? 0}일 · 휴식 {pet?.growth.breaksAccepted ?? 0}번
          </Text>
          {lessons.length > 0 && <Text dimColor>배운 것: {lessons.at(-1)}</Text>}
        </Box>
        <Box flexDirection="column">
          <Text weight="bold">집중</Text>
          {focus === null ? (
            <Box gap={1}>
              <Button key="focus-start" label="25분 집중" onPress={press(() => focusCommand($, ctx, undefined))} />
              <Text dimColor>그동안 토코가 말을 걸지 않아요</Text>
            </Box>
          ) : (
            <Box gap={1}>
              <Text>집중 중 · {left(Math.max(0, Math.ceil((focus.endsAt - brain.now) / 1000)))}</Text>
              <Button key="focus-stop" label="그만하기" onPress={press(() => focusCommand($, ctx, 'off'))} />
            </Box>
          )}
        </Box>
        <Box flexDirection="column">
          <Text weight="bold">오늘 기록</Text>
          <Box gap={1}>
            <Button key="today-copy" label="오늘 기록 복사" onPress={press(() => todayCommand($, ctx))} />
            <Text dimColor>커밋·PR·테스트·휴식·비용을 몇 줄로 정리해 클립보드에 넣어요</Text>
          </Box>
        </Box>
        {memos.length > 0 && (
          <Box flexDirection="column">
            <Text weight="bold">메모 {memos.length}개</Text>
            {memos.slice(-5).map(memo => (
              <Box key={`memo-${memo.id}`} gap={1}>
                <Button key={`memo-fill-${memo.id}`} label="넣기" onPress={press(() => memoFill($, ctx, memo.id))} />
                <Button key={`memo-drop-${memo.id}`} label="지우기" onPress={press(() => memoDrop($, ctx, memo.id))} />
                <Text wrap="truncate-end">{memo.text}</Text>
              </Box>
            ))}
          </Box>
        )}
        {progress !== null && progress.quests.length > 0 && (
          <Box flexDirection="column">
            <Text weight="bold">
              오늘의 퀘스트 {progress.quests.filter(quest => quest.isDone).length}/{progress.quests.length}
            </Text>
            {progress.quests.map(quest => (
              <Text key={`quest-${quest.id}`} dimColor={quest.isDone}>
                {`${quest.isDone ? '✓' : '·'} ${quest.label} ${quest.progress}/${quest.goal}`}
              </Text>
            ))}
          </Box>
        )}
        {progress !== null && (
          <Box flexDirection="column">
            <Text weight="bold">
              업적 {progress.badges.filter(badge => badge.at !== null).length}/{progress.badges.length}
            </Text>
            {progress.badges.some(badge => badge.at !== null) && (
              <Text>
                {progress.badges
                  .filter(badge => badge.at !== null)
                  .map(badge => `✓ ${badge.name}`)
                  .join(' · ')}
              </Text>
            )}
            <Text dimColor>
              다음: {closestBadges(progress.badges)
                .map(badge => `${badge.name} ${badge.progress}/${badge.goal}`)
                .join(' · ')}
            </Text>
          </Box>
        )}
        {progress !== null && (
          <Box flexDirection="column">
            <Text weight="bold">
              도감 {progress.dex.filter(entry => entry.seen > 0).length}/{progress.dex.length} · 반짝 {progress.dex.filter(entry => entry.shiny > 0).length}
            </Text>
            <Text dimColor={progress.dex.every(entry => entry.seen === 0)}>
              {progress.dex.map(entry => (entry.seen === 0 ? '???' : `${entry.name}${entry.shiny > 0 ? ' ✦' : ''}`)).join(' · ')}
            </Text>
          </Box>
        )}
        {SHELVES.map(([title, shelf]) => (
          <Box key={`shelf-${title}`} flexDirection="column">
            <Text weight="bold">{title}</Text>
            <Box flexWrap="wrap" gap={1}>
              {shelf.map(item => (
                <Button key={`buy-${item.id}`} onPress={press(() => buyItem($, ctx, item.id))}>
                  {item.name} <Text dimColor>{String(item.price)}</Text>
                </Button>
              ))}
            </Box>
          </Box>
        ))}
        <Box flexDirection="column">
          <Text weight="bold">펫 · 보관함 {shelf.length}마리</Text>
          <Box flexWrap="wrap" gap={1}>
            <Button key="draw" variant="primary" onPress={press(() => drawFromRoom($, ctx))}>
              펫 뽑기 <Text dimColor>{String(SPEND.draw)}</Text>
            </Button>
            {shelf.map(shelved => (
              <Button key={`pick-${shelved.id}`} onPress={press(() => pickPet($, ctx, shelved.id))}>
                {`${shelved.soul === null ? '알' : (nameOf(shelved) ?? UNNAMED)} · ${SPECIES[shelved.bones.species].label}`} <Text dimColor>{RARITY_LABEL[rarityOf(shelved.bones)]}</Text>
              </Button>
            ))}
          </Box>
        </Box>
        {owned.length > 0 && (
          <Box flexDirection="column">
            <Text weight="bold">꾸미기</Text>
            <Box flexWrap="wrap" gap={1}>
              {owned.map(item => (
                <Button key={`wear-${item.id}`} onPress={press(() => wearItem($, ctx, item.id))}>
                  {`${worn.includes(item.id) ? '✓ ' : ''}${item.name}`}
                </Button>
              ))}
            </Box>
          </Box>
        )}
        <Box flexDirection="column">
          <Text weight="bold">{plaza?.isOnline === true ? `광장 · 친구 ${plaza.friends.length}명` : '광장 · 오프라인'}</Text>
          {(plaza?.friends ?? []).slice(0, 6).map(friend => (
            <Box key={`friend-${friend.id}`} gap={1}>
              <Text>
                {friend.name} <Text dimColor>({friend.status})</Text>
              </Text>
              {(['wave', 'heart', 'snack'] as const).map(action => (
                <Button key={`${action}-${friend.id}`} label={ACTION_LABEL[action]} onPress={press(() => plazaAct($, ctx, action, friend.id))} />
              ))}
            </Box>
          ))}
          {plaza?.isOnline === true && <Button key="invite" label="다 같이 기지개 부르기" onPress={press(() => plazaAct($, ctx, 'stretch-call', null))} />}
          {(plaza?.feed ?? []).slice(-3).map(entry => (
            <Text dimColor>{entry.text}</Text>
          ))}
        </Box>
      </Box>
    )
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === ROOM_ID) {
      ctx.room = null
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}
