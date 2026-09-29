import { recordingMetrics } from '../performance/recordingMetrics'

interface Clock {
  now(): number
  request(callback: FrameRequestCallback): number
  cancel(id: number): void
}

/** One latest-only display clock. Analysis continues independently. */
export class LiveChartScheduler {
  private listeners = new Set<() => void>()
  private raf: number | null = null
  private visible = true
  private active = false
  private dirty = false
  private deadline = 0
  private lastDraw: number | null = null
  private windowStart: number | null = null
  private costs: number[] = []
  private cost = 0
  private late = 0
  private draws = 0
  private badWindows = 0
  private goodWindows = 0
  private cooldownUntil = 0
  private recovering = false
  private rate: 10 | 15 = 15
  get fps(): 10 | 15 { return this.rate }

  constructor(private clock: Clock = {
    now: () => performance.now(),
    request: callback => requestAnimationFrame(callback),
    cancel: id => cancelAnimationFrame(id),
  }) {}

  subscribe(draw: () => void): () => void {
    this.listeners.add(draw)
    return () => {
      this.listeners.delete(draw)
      if (!this.listeners.size) this.dispose()
    }
  }

  invalidate(): void {
    if (!this.active && !this.dirty && this.clock.now() - this.deadline > 1000 / this.rate) {
      // No data arrived during this gap: it is idle, not missed rendering.
      this.deadline = this.clock.now()
      this.lastDraw = null
    }
    this.dirty = true
    this.schedule()
  }

  recordDrawCost(ms: number): void {
    if (Number.isFinite(ms) && ms >= 0) this.cost += ms
  }

  setActive(active: boolean): void {
    if (active === this.active) return
    this.active = active
    this.resetWindow()
    this.deadline = this.clock.now()
    this.lastDraw = null
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return
    this.visible = visible
    if (!visible) {
      if (this.raf !== null) this.clock.cancel(this.raf)
      this.raf = null
      this.resetWindow()
      this.lastDraw = null
    } else {
      this.deadline = this.clock.now()
      this.schedule()
    }
  }

  dispose(): void {
    if (this.raf !== null) this.clock.cancel(this.raf)
    this.raf = null
    this.listeners.clear()
    this.dirty = false
    this.deadline = 0
    this.lastDraw = null
    this.resetWindow()
    this.rate = 15
    this.cooldownUntil = 0
    this.recovering = false
  }

  private resetWindow(): void {
    this.windowStart = null
    this.costs = []
    this.cost = this.late = this.draws = this.badWindows = this.goodWindows = 0
  }

  private schedule(): void {
    if (this.raf === null && this.visible && this.dirty && this.listeners.size) {
      this.raf = this.clock.request(this.tick)
    }
  }

  private tick = (): void => {
    this.raf = null
    const now = this.clock.now()
    if (now + .01 < this.deadline) { this.schedule(); return }
    if (!this.visible || !this.dirty) return
    this.evaluate(now)
    const interval = 1000 / this.rate
    if (this.lastDraw !== null) {
      recordingMetrics.record('displayInterval', now - this.lastDraw)
      if (now - this.deadline > interval / 2) this.late++
    }
    this.draws++
    this.lastDraw = now
    // Preserve phase, but never replay missed ticks.
    this.deadline += (Math.floor(Math.max(0, now - this.deadline) / interval) + 1) * interval
    this.dirty = false
    for (const draw of this.listeners) draw()
    this.schedule()
  }

  private evaluate(now: number): void {
    if (this.windowStart === null) this.windowStart = now
    if (this.draws > 0) this.costs.push(this.cost)
    this.cost = 0
    if (now - this.windowStart < 5000) return
    // Severe recording stalls may yield fewer than 20 draws in five seconds.
    // They still need to trigger a downgrade; recovery requires a fuller window.
    const enough = this.draws >= 5
    const sorted = this.costs.sort((a, b) => a - b)
    const p95 = sorted[Math.ceil(sorted.length * .95) - 1] ?? 0
    const lateRatio = this.draws ? this.late / this.draws : 0
    this.badWindows = enough && (lateRatio > .1 || p95 > 20) ? this.badWindows + 1 : 0
    this.goodWindows = this.draws >= 20 && lateRatio < .02 && p95 < 10 ? this.goodWindows + 1 : 0
    if (this.rate === 15 && this.badWindows >= 2) {
      this.rate = 10
      if (this.recovering) this.cooldownUntil = now + 60000
      this.recovering = false
      this.goodWindows = this.badWindows = 0
    } else if (this.rate === 10 && this.goodWindows >= 6 && now >= this.cooldownUntil) {
      this.rate = 15
      this.recovering = true
      this.goodWindows = this.badWindows = 0
    }
    this.windowStart = now
    this.costs = []
    this.draws = this.late = 0
  }
}

export const liveChartScheduler = new LiveChartScheduler()
