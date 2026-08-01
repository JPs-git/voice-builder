import { useAppStore } from '../store/appStore'
import type { FeedbackEvaluator, FeedbackResult } from '../types'
import { evaluateHitRate } from './hitRate'

export const FEEDBACK_EVALUATORS: FeedbackEvaluator[] = [
  evaluateHitRate,
]

export function useFeedback(): FeedbackResult[] {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  return FEEDBACK_EVALUATORS
    .map(fn => fn({ latestFrame, bands }))
    .filter((r): r is FeedbackResult => r !== null)
}
