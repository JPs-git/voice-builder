import type { FeedbackContext, FeedbackResult } from '../types'

const KEYS = ['f0', 'f1', 'f2'] as const

export function evaluateHitRate(ctx: FeedbackContext): FeedbackResult | null {
  const { latestFrame, bands } = ctx
  if (!latestFrame) return null

  const hints: string[] = []
  let hasData = false
  let allHit = true

  for (const k of KEYS) {
    const v = latestFrame[k]
    const range = bands[k].range
    if (v == null || !Number.isFinite(v)) continue
    hasData = true
    if (v < range[0]) {
      allHit = false
      hints.push(`${k.toUpperCase()}偏低`)
    } else if (v > range[1]) {
      allHit = false
      hints.push(`${k.toUpperCase()}偏高`)
    }
  }

  if (!hasData) return null
  if (allHit) {
    return { id: 'hit-rate', label: '目标区间', status: 'hit', message: '完美' }
  }
  return { id: 'hit-rate', label: '目标区间', status: 'miss', message: hints.join(' ') }
}
