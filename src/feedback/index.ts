import { useAppStore } from '../store/appStore'
import type { FeedbackEvaluator, FeedbackResult } from '../types'
import { evaluateHitRate } from './hitRate'

export const FEEDBACK_EVALUATORS: FeedbackEvaluator[] = [
  evaluateHitRate,
]

export function useFeedback(): FeedbackResult[] {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const visible = useAppStore(s => s.formantVisible)
  return FEEDBACK_EVALUATORS
    .map(fn => fn({ latestFrame, bands, visible }))
    .filter((r): r is FeedbackResult => r !== null)
}
