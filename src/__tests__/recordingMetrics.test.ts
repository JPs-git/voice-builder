import { describe, expect, it } from 'vitest'
import { RecordingMetrics } from '../performance/recordingMetrics'

describe('recording diagnostics', () => {
  it('does not collect samples while disabled', () => {
    const metrics = new RecordingMetrics()
    metrics.record('analysis', 10)
    expect(metrics.snapshot()).toEqual({})
  })

  it('retains only the latest 2048 samples and reports nearest-rank percentiles', () => {
    const metrics = new RecordingMetrics(true)
    for (let i = 1; i <= 4096; i++) metrics.record('analysis', i)
    expect(metrics.snapshot().analysis).toEqual({
      count: 2048, p50: 3072, p95: 3994, p99: 4076, max: 4096,
    })
    metrics.record('analysis', NaN)
    metrics.record('analysis', -1)
    expect(metrics.snapshot().analysis?.count).toBe(2048)
    metrics.clear()
    expect(metrics.snapshot()).toEqual({})
  })
})
