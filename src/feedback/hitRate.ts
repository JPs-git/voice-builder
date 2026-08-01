import type { FeedbackContext, FeedbackResult } from '../types'
import { getFormantStatus } from './status'

const KEYS = ['f0', 'f1', 'f2'] as const

export function evaluateHitRate(ctx: FeedbackContext): FeedbackResult | null {
  const { latestFrame, bands } = ctx
  if (!latestFrame) return null

  const hints: string[] = []
  let hasData = false
  let allHit = true

  for (const k of KEYS) {
    const status = getFormantStatus(latestFrame[k], bands[k].range)
    if (status === 'none') continue
    hasData = true
    if (status === 'low') {
      allHit = false
      hints.push(`${k.toUpperCase()}偏低`)
    } else if (status === 'high') {
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
