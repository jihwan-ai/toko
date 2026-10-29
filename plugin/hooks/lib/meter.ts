import type { TokoMeter } from '../../types'

export type MeterLevel = 'normal' | 'warn' | 'alert'

export const CONTEXT_LEVELS = { warn: 70, alert: 85 } as const
export const LIMIT_LEVELS = { warn: 75, alert: 90 } as const
export const SHOW_RESET_AT = 80

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

const LIMIT_LABEL: Readonly<Record<string, string>> = { five_hour: '5시간', seven_day: '7일', spend_limit: '한도' }

export const busiestLimit = (limits: readonly Limit[]): Limit | null => [...limits].sort((a, b) => b.percentUsed - a.percentUsed)[0] ?? null

export const meterOf = (contextPercent: number | undefined, costUsd: number | undefined, limits: readonly Limit[]): TokoMeter => {
  const limit = busiestLimit(limits)
  return {
    contextPercent: contextPercent ?? null,
    costUsd: costUsd ?? null,
    limitLabel: limit === null ? null : (LIMIT_LABEL[limit.kind] ?? limit.kind),
    limitPercent: limit?.percentUsed ?? null,
    resetsAt: limit?.resetsAt ?? null,
  }
}

export const meterLevel = (meter: TokoMeter): MeterLevel => {
  const context = meter.contextPercent ?? 0
  const limit = meter.limitPercent ?? 0
  if (context >= CONTEXT_LEVELS.alert || limit >= LIMIT_LEVELS.alert) {
    return 'alert'
  }
  return context >= CONTEXT_LEVELS.warn || limit >= LIMIT_LEVELS.warn ? 'warn' : 'normal'
}

const resetClock = (iso: string | null): string | null => {
  const date = iso === null ? null : new Date(iso)
  return date === null || Number.isNaN(date.getTime()) ? null : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export const meterText = (meter: TokoMeter): string => {
  const reset = meter.limitPercent !== null && meter.limitPercent >= SHOW_RESET_AT ? resetClock(meter.resetsAt) : null
  return [
    ...(meter.contextPercent === null ? [] : [`컨텍스트 ${Math.round(meter.contextPercent)}%`]),
    ...(meter.costUsd === null ? [] : [`$${meter.costUsd.toFixed(2)}`]),
    ...(meter.limitPercent === null || meter.limitLabel === null ? [] : [`${meter.limitLabel} ${Math.round(meter.limitPercent)}%${reset === null ? '' : ` (${reset} 리셋)`}`]),
  ].join(' · ')
}
