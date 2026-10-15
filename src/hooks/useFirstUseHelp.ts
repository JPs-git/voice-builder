import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useIntroHintStore } from '../store/introHintStore'

export function useFirstUseHelp(): { eligible: boolean; dismiss: () => void } {
  const handled = useIntroHintStore(state => state.handled)
  const markHandled = useIntroHintStore(state => state.markHandled)
  const hasValidAnalysis = useAppStore(state => !handled && state.frames.some(frame =>
    [frame.f0, frame.f1, frame.f2].some(value => typeof value === 'number' && Number.isFinite(value) && value > 0),
  ))
  useEffect(() => {
    if (hasValidAnalysis) markHandled()
  }, [hasValidAnalysis, markHandled])
  return { eligible: !handled && !hasValidAnalysis, dismiss: markHandled }
}
