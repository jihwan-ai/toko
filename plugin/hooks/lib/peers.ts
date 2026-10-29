export type PeerSignal = { kind: 'done' | 'waiting'; at: number; label: string }

const LABEL_LENGTH = 16

export const signalLabel = (prompt: string): string => [...prompt.replace(/\s+/g, ' ').trim()].slice(0, LABEL_LENGTH).join('')

export const isSignal = (value: unknown): value is PeerSignal => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const raw = value as Record<string, unknown>
  return (raw.kind === 'done' || raw.kind === 'waiting') && typeof raw.at === 'number' && typeof raw.label === 'string'
}

export const freshSignal = (entries: readonly { key: string; value: unknown }[], ownKey: string, seenAt: number): PeerSignal | null =>
  entries
    .filter(entry => entry.key !== ownKey)
    .map(entry => entry.value)
    .filter(isSignal)
    .filter(signal => signal.at > seenAt)
    .reduce<PeerSignal | null>((latest, signal) => (latest === null || signal.at > latest.at ? signal : latest), null)

export const signalText = (signal: PeerSignal): string => {
  const verb = signal.kind === 'done' ? '답을 마쳤어요' : '확인을 기다려요'
  return signal.label === '' ? `다른 세션이 ${verb}` : `「${signal.label}」 세션이 ${verb}`
}
