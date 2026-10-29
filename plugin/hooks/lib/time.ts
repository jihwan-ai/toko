export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

export const dayKey = (now: number): string => {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const hourOf = (now: number): number => new Date(now).getHours()

export const weekdayOf = (now: number): string => ['일', '월', '화', '수', '목', '금', '토'][new Date(now).getDay()] ?? ''

export const isWithinHours = (hour: number, range: readonly [number, number] | null): boolean => {
  if (range === null) {
    return false
  }
  const [start, end] = range
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end
}

export const clockText = (now: number): string => {
  const date = new Date(now)
  return `${weekdayOf(now)}요일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
