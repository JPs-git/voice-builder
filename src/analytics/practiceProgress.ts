import { getAnalyticsPage, isAnalyticsAllowed, track } from './analytics'

export function createPracticeProgress(onEngaged: () => void): (sampleCount: number, sampleRate: number) => void {
  let seconds = 0
  let engaged = false
  return (sampleCount, sampleRate) => {
    if (engaged || !Number.isInteger(sampleCount) || sampleCount <= 0
      || !Number.isFinite(sampleRate) || sampleRate <= 0) return
    seconds += sampleCount / sampleRate
    if (seconds + 1e-9 >= 30) {
      engaged = true
      onEngaged()
    }
  }
}

// Independent of the ten-second audio buffer and of hook/route remounts.
const addSamples = createPracticeProgress(() => {
  const page = getAnalyticsPage()
  if (page) track('practice_engaged', { page })
})

export function recordPracticeSamples(sampleCount: number, sampleRate: number): void {
  if (isAnalyticsAllowed() && getAnalyticsPage()) addSamples(sampleCount, sampleRate)
}
