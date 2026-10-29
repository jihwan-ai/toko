import type { TokoFriend, TokoMood, TokoSpecies } from '../../types'

import { isSpecies } from './pet'

export const PLAZA_POLL_MS = 20_000
export const FRIEND_TTL_MS = 90_000

export type PlazaStatus = 'working' | 'resting' | 'idle' | 'away'

export type PlazaAction = 'wave' | 'heart' | 'snack' | 'stretch-call' | 'cheer'

export const PLAZA_ACTIONS: readonly PlazaAction[] = ['wave', 'heart', 'snack', 'stretch-call', 'cheer']

export const ACTION_LABEL: Readonly<Record<PlazaAction, string>> = {
  wave: '손 흔들기',
  heart: '하트',
  snack: '간식 나눠 주기',
  'stretch-call': '다 같이 기지개',
  cheer: '응원',
}

type WireColor = 'honey' | 'mint' | 'peach' | 'lavender'

const WIRE_COLOR: Readonly<Record<TokoSpecies, WireColor>> = {
  cat: 'honey',
  bear: 'peach',
  chick: 'honey',
  bunny: 'lavender',
  frog: 'mint',
  penguin: 'lavender',
  fox: 'peach',
  dragon: 'mint',
  unicorn: 'lavender',
  ghost: 'lavender',
  phoenix: 'peach',
  robot: 'mint',
  axolotl: 'peach',
}

export const wireColor = (species: TokoSpecies): WireColor => WIRE_COLOR[species]

export type PlazaMe = { id: string; name: string; color: WireColor; species: TokoSpecies; mood: TokoMood; status: PlazaStatus }

export type PlazaEvent = {
  id: string
  at: number
  kind: PlazaAction | 'join' | 'leave'
  from: { id: string; name: string; species: TokoSpecies }
  to: string | null
  line: string
}

export type PlazaSnapshot = { friends: readonly TokoFriend[]; events: readonly PlazaEvent[]; now: number }

const COLORS: ReadonlySet<string> = new Set(['honey', 'mint', 'peach', 'lavender'])
const MOODS: ReadonlySet<string> = new Set(['excited', 'calm', 'sleepy', 'worried', 'sulky'])
const KINDS: ReadonlySet<string> = new Set([...PLAZA_ACTIONS, 'join', 'leave'])

const text = (value: unknown, max: number): string => (typeof value === 'string' ? [...value.replace(/\s+/g, ' ').trim()].slice(0, max).join('') : '')

const speciesOf = (raw: Record<string, unknown>): TokoSpecies => (isSpecies(raw.species) ? raw.species : 'cat')

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const parseFriend = (value: unknown): TokoFriend | null => {
  const raw = asRecord(value)
  if (raw === null || typeof raw.id !== 'string' || !COLORS.has(String(raw.color))) {
    return null
  }
  return {
    id: text(raw.id, 64),
    name: text(raw.name, 12) || '친구',
    species: speciesOf(raw),
    mood: MOODS.has(String(raw.mood)) ? (raw.mood as TokoMood) : 'calm',
    status: text(raw.status, 12) || 'idle',
    lastSeen: typeof raw.lastSeen === 'number' ? raw.lastSeen : 0,
  }
}

const parseEvent = (value: unknown): PlazaEvent | null => {
  const raw = asRecord(value)
  const from = asRecord(raw?.from)
  if (raw === null || from === null || typeof raw.id !== 'string' || !KINDS.has(String(raw.kind)) || !COLORS.has(String(from.color))) {
    return null
  }
  return {
    id: text(raw.id, 64),
    at: typeof raw.at === 'number' ? raw.at : 0,
    kind: raw.kind as PlazaEvent['kind'],
    from: { id: text(from.id, 64), name: text(from.name, 12) || '친구', species: speciesOf(from) },
    to: typeof raw.to === 'string' ? raw.to : null,
    line: text(raw.line, 80),
  }
}

const isPresent = <T>(value: T | null): value is T => value !== null

export const parseSnapshot = (body: string, myId: string): PlazaSnapshot | null => {
  try {
    const raw = asRecord(JSON.parse(body))
    if (raw === null) {
      return null
    }
    const friends = (Array.isArray(raw.friends) ? raw.friends : []).map(parseFriend).filter(isPresent).filter(friend => friend.id !== myId)
    const events = (Array.isArray(raw.events) ? raw.events : []).map(parseEvent).filter(isPresent).filter(event => event.from.id !== myId)
    return { friends: friends.slice(0, 30), events: events.slice(-20), now: typeof raw.now === 'number' ? raw.now : 0 }
  } catch {
    return null
  }
}

export const plazaEndpoint = (base: string, path: string): string | null => {
  const trimmed = base.trim().replace(/\/+$/, '')
  return /^https?:\/\/[^\s]+$/.test(trimmed) ? `${trimmed}${path}` : null
}

export const isForMe = (event: PlazaEvent, myId: string): boolean => event.to === null || event.to === myId

export const eventText = (event: PlazaEvent): string => {
  const verb: Readonly<Record<PlazaEvent['kind'], string>> = {
    wave: '손을 흔들었어',
    heart: '하트를 보냈어',
    snack: '간식을 나눠 줬어',
    'stretch-call': '다 같이 기지개 켜자고 해',
    cheer: '응원을 보냈어',
    join: '광장에 왔어',
    leave: '광장을 떠났어',
  }
  return `${event.from.name}: ${event.line || verb[event.kind]}`
}

export const findFriend = (friends: readonly TokoFriend[], query: string): TokoFriend | undefined => {
  const needle = query.trim()
  return friends.find(friend => friend.name === needle) ?? friends.find(friend => friend.name.startsWith(needle)) ?? friends.find(friend => friend.id === needle)
}
