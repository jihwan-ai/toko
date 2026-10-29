import type { TokoBones, TokoMemoryEvent, TokoMood, TokoNeeds, TokoRarity, TokoSoul, TokoTraits } from '../../types'

import { SPECIES, rarityOf } from './pet'
import type { Random } from './random'
import { pick } from './random'
import type { Candidate } from './sim'

export const MAX_LINE = 60
export const DAILY_AI_CALLS = 30
export const DAILY_FORK_CALLS = 3

const FORBIDDEN = /(바보|멍청|병신|시발|씨발|ㅅㅂ|개새|꺼져|닥쳐|죽어|죽여|죽일|미친|한심|쓰레기|패버|때려죽)/

export const VOICE_RULES = [
  '너는 Claude Code 터미널 안에 사는 작은 픽셀 동반자다.',
  '목적은 하나다: AI와 일하며 쌓인 인지 부하를 덜고, 사용자가 숨 돌린 뒤 가벼운 마음으로 일로 돌아가게 돕는 것.',
  '반말을 쓰는 다정한 동료처럼 말한다. 한 줄, 40자 안팎. 이모지는 쓰지 않는다.',
  '재촉하지 않는다. 생산성 수치를 약속하지 않는다. 쉬지 않았다고 탓하지 않는다.',
  '사용자 편이지만 Claude를 깎아내리지 않는다. 욕설·비하·위협 표현은 쓰지 않는다.',
].join('\n')

export const OFFER_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  stretch: ['오래 앉아 있었네. 같이 기지개 한 번 켤래?', '어깨가 굳었겠다. 쭉— 펴고 오자'],
  'eye-rest': ['20초만 먼 데 보자. 내가 세어 줄게', '눈 잠깐 쉬어 갈까? 창밖 한 번 보고 와'],
  water: ['물 한 모금 어때? 나도 마실래', '목 마르지 않아? 물 한 잔 하고 오자'],
  nap: ['오늘은 많이 달렸어. 일찍 쉬는 것도 일이야', '나 졸려… 너도 슬슬 쉬어도 돼'],
  briefing: ['돌아왔구나. 아까 하던 거 한 줄로 짚어 줄까?', '잘 쉬었어? 하던 일 기억나게 도와줄게'],
  unstick: ['같은 데서 세 번 막혔네. 2분만 일어났다 와. 정리해 둘게', '잠깐 떨어져서 보면 보일 때가 있어. 쉬었다 하자'],
  wrapup: ['퇴근 시간 지났어. 오늘 한 일 세 줄로 정리해 줄까?', '오늘 고생했어. 마무리 정리 같이 할래?'],
  gift: ['어? 선물 상자가 떨어졌어! 열어 볼래?', '깜짝 선물이야. o 눌러서 열어 봐'],
  bugs: ['테스트 통과했다! 기념으로 벌레 잡기 한 판?', '잘했어! 30초만 놀다 갈래?'],
  chat: ['오늘 많이 했네. 잠깐 쉬면서 한숨 돌리자', '요즘 뭐가 제일 재밌어? 난 너 일하는 거 구경'],
  'calm-down': ['오늘 Claude랑 많이 싸웠네. 물 한 잔 하고 숨 고를래?', '화난 날엔 숨부터. 4초 들이쉬고 6초 내쉬자'],
  'plaza-stretch': ['광장 친구들이 다 같이 기지개 켠대. 같이 할래?', '다른 친구들도 쉬는 중이래. 우리도 같이 펴자'],
  'focus-break': ['집중 끝! 기지개 한 번 켜고 올래?', '잘 버텼어. 30초만 몸 펴고 오자'],
  name: ['안녕! 나 아직 이름이 없어. 지어 줄래?', '나 아직 이름이 없어. 네가 지어 주면 좋겠어'],
}

export const REACTION_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  hello: ['왔구나! 오늘도 천천히 가자', '안녕! 옆에 있을게'],
  welcomeBack: ['잘 쉬었어?', '돌아왔네. 천천히 다시 시작하자'],
  accepted: ['좋아, 같이 하자', '응, 천천히'],
  later: ['이따 봐', '알았어, 나중에'],
  stop: ['내일 보자', '오늘은 조용히 있을게'],
  praise: ['잘했어. 몸이 좀 가벼워졌지?', '고마워, 나도 개운해'],
  fed: ['냠! 맛있다', '배부르다~ 고마워'],
  played: ['재밌었다!', '헤헤, 또 놀자'],
  noSnack: ['간식이 없어… 상점에서 사 줄래?', '배고파. /toko shop 에서 간식 사 줘'],
  bonkStart: ['이 녀석…!', '각오해라!'],
  bonkHit: ['삑!', '뿅!'],
  bonkEnd: ['둘 다 고생했어. 숨 고를래, 하고 싶은 말 전할래?', '시원해? 이제 숨 한 번 고르자'],
  apology: ['…알았어. 이번만 봐줄게', '흥, 사과 받아 줄게'],
  breatheIn: ['들이쉬고… 2, 3, 4', '천천히 들이쉬어'],
  breatheOut: ['내쉬고… 2, 3, 4, 5, 6', '길게 내쉬어'],
  breatheDone: ['좀 나아졌어?', '좋아. 다시 가 보자'],
  longTurn: ['Claude가 열심히 하는 중이야. 눈 잠깐 쉬어', '기다리는 동안 먼 데 한 번 보자'],
  turnDone: ['끝났어!', 'Claude가 다 했대'],
  testFail: ['괜찮아, 한 번 더', '음… 어디가 걸렸을까'],
  testPass: ['통과! 잘했어', '해냈다!'],
  commit: ['커밋했다! 깃발 흔들게', '한 걸음 저장 완료'],
  firstCommit: ['오늘 첫 커밋! 작은 선물 줄게', '첫 커밋 축하해. 선물이야'],
  permission: ['Claude가 허락을 기다려', '확인해 줄 게 있대'],
  full: ['대화가 꽉 찼어. 배불러…', '머리가 꽉 찼대. 정리할 때인가 봐'],
  grow: ['나 컸어!', '봐 봐, 조금 자랐어!'],
  friendVisit: ['친구가 놀러 왔어!', '광장 친구야. 손 흔들어 줘'],
  friendWave: ['친구가 손 흔들어 줬대', '친구가 하트 보냈어'],
  hush: ['응, 조용히 있을게', '알았어. 필요하면 불러'],
}

export const fallbackLine = (random: Random, table: Readonly<Record<string, readonly string[]>>, key: string): string =>
  pick(random, table[key] ?? REACTION_FALLBACK.hello ?? ['응'])

export const sanitizeLine = (line: unknown): string | null => {
  if (typeof line !== 'string') {
    return null
  }
  const oneLine = line.replace(/\s+/g, ' ').replace(/^["'「]|["'」]$/g, '').trim()
  if (oneLine.length === 0 || FORBIDDEN.test(oneLine)) {
    return null
  }
  return [...oneLine].slice(0, MAX_LINE).join('')
}

export const extractJson = (text: string): Record<string, unknown> | null => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const RARITY_FLAVOR: Readonly<Record<TokoRarity, string>> = {
  normal: '평범하고 다정한',
  rare: '아주 별나지만 미워할 수 없는',
}

export const soulPrompt = (bones: TokoBones): string =>
  [
    `토큰을 먹고 사는 동그란 ${SPECIES[bones.species].label} 펫이 막 알에서 깨어났다. 이 펫의 영혼을 지어 줘.`,
    `종족: ${SPECIES[bones.species].label}, 희귀도: ${rarityOf(bones)}(${RARITY_FLAVOR[rarityOf(bones)]} 성격).`,
    '조건: name은 한글 한 낱말 2~4자(12자 이내), personality는 한 문장, quirk는 말버릇 하나(따옴표로 예시 포함).',
    'traits는 energetic, chatty, worried, playful 네 개, 각각 0~1 소수.',
    'JSON 하나만 답해: {"name": "...", "personality": "...", "quirk": "...", "traits": {"energetic": 0.5, "chatty": 0.5, "worried": 0.5, "playful": 0.5}}',
  ].join('\n')

const unit = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback

export const parseSoul = (text: string, fallback: TokoSoul, clampName: (name: string) => string): TokoSoul | null => {
  const json = extractJson(text)
  if (json === null) {
    return null
  }
  const name = typeof json.name === 'string' ? clampName(json.name) : ''
  const personality = sanitizeLine(json.personality)
  const quirk = sanitizeLine(json.quirk)
  if (name.length === 0 || FORBIDDEN.test(name) || personality === null || quirk === null) {
    return null
  }
  const raw = typeof json.traits === 'object' && json.traits !== null ? (json.traits as Record<string, unknown>) : {}
  const traits: TokoTraits = {
    energetic: unit(raw.energetic, fallback.traits.energetic),
    chatty: unit(raw.chatty, fallback.traits.chatty),
    worried: unit(raw.worried, fallback.traits.worried),
    playful: unit(raw.playful, fallback.traits.playful),
  }
  return { name, personality, quirk, traits, hatchedAt: fallback.hatchedAt, isFallback: false, isNamed: false }
}

export const nameProblem = (name: string): string | null => {
  if (name.length === 0) {
    return '예: /toko name 콩이'
  }
  if (/\s/.test(name)) {
    return '이름은 띄어쓰기 없이 한 낱말로 지어 주세요. 예: /toko name 콩이'
  }
  if ([...name].length > 12) {
    return '이름은 12자까지예요.'
  }
  return FORBIDDEN.test(name) ? '그 이름은 쓸 수 없어요.' : null
}

export const soulSystem = (soul: TokoSoul): string =>
  [VOICE_RULES, `너의 이름은 ${soul.name}. 성격: ${soul.personality} 말버릇: ${soul.quirk}`].join('\n')

export type IntentInput = {
  soul: TokoSoul
  candidates: readonly Candidate[]
  mood: TokoMood
  needs: TokoNeeds
  events: readonly TokoMemoryEvent[]
  lessons: readonly string[]
  clock: string
}

export const intentPrompt = (input: IntentInput): string =>
  [
    `지금: ${input.clock}. 기분: ${input.mood}. 욕구(0~100): 기운 ${Math.round(input.needs.energy)}, 재미 ${Math.round(input.needs.fun)}, 배고픔 ${Math.round(input.needs.hunger)}, 교감 ${Math.round(input.needs.social)}.`,
    `최근 일: ${input.events.slice(-5).map(event => `${event.kind}${event.detail ? `(${event.detail})` : ''}`).join(', ') || '없음'}.`,
    `사용자에 대해 배운 것: ${input.lessons.slice(-2).join(' / ') || '아직 없음'}.`,
    '지금은 사용자가 잠깐 손을 멈춘 틈이다. 아래 후보 가운데 하나를 고르거나, 지금은 가만히 있는 게 낫다면 stay_quiet를 골라.',
    ...input.candidates.map(candidate => `- ${candidate.kind} (점수 ${candidate.score}): ${candidate.description}`),
    '- stay_quiet: 아무것도 하지 않는다',
    '힐링이 목적이다. 사용자가 몰입 중이라 판단되면 stay_quiet가 좋은 선택이다.',
    'JSON 하나만 답해: {"intent": "후보 이름", "line": "펫이 건넬 한 줄", "emotion": "excited|calm|sleepy|worried|sulky", "reason": "짧은 이유"}',
  ].join('\n')

export type Intent = { intent: string; line: string | null; reason: string }

export const parseIntent = (text: string, candidates: readonly Candidate[]): Intent | null => {
  const json = extractJson(text)
  if (json === null || typeof json.intent !== 'string') {
    return null
  }
  const isKnown = candidates.some(candidate => candidate.kind === json.intent)
  return {
    intent: isKnown ? json.intent : 'stay_quiet',
    line: isKnown ? sanitizeLine(json.line) : null,
    reason: typeof json.reason === 'string' ? json.reason.slice(0, 80) : '',
  }
}

export const linePrompt = (situation: string, facts: readonly string[]): string =>
  [
    `상황: ${situation}`,
    `기억하는 사실: ${facts.join(' / ') || '없음'}`,
    '이 상황에서 펫이 사용자에게 건넬 말을 써 줘. 사실에 없는 내용은 지어내지 마.',
    'JSON 하나만 답해: {"line": "..."}',
  ].join('\n')

export const parseLine = (text: string): string | null => sanitizeLine(extractJson(text)?.line)

export const reflectPrompt = (events: readonly TokoMemoryEvent[], answersByHour: readonly { accepted: number; declined: number }[]): string => {
  const hours = answersByHour
    .map((slot, hour) => ({ hour, ...slot }))
    .filter(slot => slot.accepted + slot.declined > 0)
    .map(slot => `${slot.hour}시 수락 ${slot.accepted} 거절 ${slot.declined}`)
  return [
    '어제 펫이 본 사용자의 하루다.',
    `사건: ${events.map(event => event.kind).join(', ') || '없음'}`,
    `시간대별 휴식 권유 반응: ${hours.join(', ') || '없음'}`,
    '사용자에 대해 배운 것을 1~2문장으로 써 줘. 언제 몰입하고 언제 쉬는 편인지처럼, 다음 권유 시점을 고르는 데 쓸 내용으로.',
    'JSON 하나만 답해: {"lesson": "..."}',
  ].join('\n')
}

export const parseLesson = (text: string): string | null => {
  const lesson = extractJson(text)?.lesson
  return typeof lesson === 'string' && lesson.trim().length > 0 && !FORBIDDEN.test(lesson) ? lesson.trim().slice(0, 140) : null
}

export const correctionPrompt = (reason: string): string =>
  [
    `사용자가 Claude에게 화가 난 이유: "${reason}"`,
    '이 불만을 Claude에게 다음 프롬프트로 보낼, 구체적이고 정중한 교정 요청 한 문장으로 바꿔 줘. 비난 없이, 무엇을 지켜 달라는지 분명하게.',
    'JSON 하나만 답해: {"line": "..."}',
  ].join('\n')

export const fallbackCorrection = (reason: string): string => `다음부터는 이 점을 꼭 지켜 줘: ${reason.trim()}. 방금 작업에서 어긋난 부분이 있으면 바로잡아 줘.`

export const bonkMessage = (petName: string, reason: string): string =>
  [
    `${petName}(이)가 뿅망치로 Claude를 때렸다. 이유: ${reason.trim() || '그냥 기분이 그랬다'}`,
    '이건 사용자의 가벼운 분풀이 연출이다. 첫 줄을 "아야…"로 시작해 짧게 받아들이고, 이유에 맞게 바로잡을 게 있으면 바로잡아 줘.',
    '그리고 mcp__toko__apologize 도구를 한 번 불러 펫에게 사과해 줘.',
  ].join('\n')
