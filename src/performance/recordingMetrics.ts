export type MetricKind = 'captureInterval' | 'sampleRate' | 'analysis' | 'publish' | 'chartUpdate' | 'displayInterval'
type Summary = { count: number; p50: number; p95: number; p99: number; max: number }
export type MetricsSummary = Partial<Record<MetricKind, Summary>>
const CAPACITY = 2048

export class RecordingMetrics {
  private samples = new Map<MetricKind, { values: Float64Array; count: number; next: number }>()
  constructor(public enabled = false) {}

  record(kind: MetricKind, durationMs: number): void {
    if (!this.enabled || !Number.isFinite(durationMs) || durationMs < 0) return
    let entry = this.samples.get(kind)
    if (!entry) {
      entry = { values: new Float64Array(CAPACITY), count: 0, next: 0 }
      this.samples.set(kind, entry)
    }
    entry.values[entry.next] = durationMs
    entry.next = (entry.next + 1) % CAPACITY
    entry.count = Math.min(entry.count + 1, CAPACITY)
  }

  snapshot(): MetricsSummary {
    const result: MetricsSummary = {}
    for (const [kind, entry] of this.samples) {
      const sorted = entry.values.slice(0, entry.count).sort()
      const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1]
      result[kind] = { count: entry.count, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted[sorted.length - 1] }
    }
    return result
  }

  clear(): void { this.samples.clear() }
}

export const recordingMetrics = new RecordingMetrics(
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1',
)

// Opt-in, local diagnostics only. No audio or metrics are uploaded.
if (recordingMetrics.enabled) Object.assign(window, { voiceBuilderMetrics: recordingMetrics })
