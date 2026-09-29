import { describe, expect, it } from 'vitest'
import { LiveChartScheduler } from '../charts/liveChartScheduler'
import { recordingMetrics } from '../performance/recordingMetrics'

function clock() {
  let now = 0
  let id = 0
  const pending = new Map<number, FrameRequestCallback>()
  const scheduler = new LiveChartScheduler({
    now: () => now,
    request: callback => { pending.set(++id, callback); return id },
    cancel: token => { pending.delete(token) },
  })
  return { scheduler, pending, tick(time: number) {
    now = time
    const callbacks = [...pending.values()]
    pending.clear()
    callbacks.forEach(callback => callback(time))
  } }
}

describe('live chart cadence', () => {
  it('counts stalls before invalidation during recording instead of classifying them as idle', () => {
    const c = clock()
    recordingMetrics.enabled = true
    recordingMetrics.clear()
    try {
      c.scheduler.setActive(true)
      c.scheduler.subscribe(() => {})
      c.scheduler.invalidate()
      c.tick(0)
      for (let t = 300; t <= 12000; t += 300) {
        c.tick(t) // Main thread was blocked before it could deliver new audio.
        c.scheduler.invalidate()
        c.tick(t)
      }
      expect(recordingMetrics.snapshot().displayInterval?.max).toBe(300)
      expect(c.scheduler.fps).toBe(10)
    } finally {
      c.scheduler.dispose()
      recordingMetrics.enabled = false
      recordingMetrics.clear()
    }
  })

  it('merges updates, shows latest data and does not catch up after a stall', () => {
    const c = clock()
    let value = 0
    const shown: number[] = []
    c.scheduler.subscribe(() => shown.push(value))
    for (value = 0; value < 20; value++) c.scheduler.invalidate()
    expect(c.pending.size).toBe(1)
    c.tick(0)
    expect(shown).toEqual([20])
    value = 21
    c.scheduler.invalidate()
    c.tick(30)
    expect(shown).toHaveLength(1)
    value = 25
    c.scheduler.invalidate()
    c.tick(330)
    expect(shown).toEqual([20, 25])
    c.tick(350)
    expect(c.pending.size).toBe(0)
  })

  it('pauses hidden work, resumes once, and cancels when the last consumer leaves', () => {
    const c = clock()
    let draws = 0
    const unsubscribe = c.scheduler.subscribe(() => draws++)
    c.scheduler.invalidate()
    c.scheduler.setVisible(false)
    c.tick(1000)
    expect(draws).toBe(0)
    c.scheduler.setVisible(true)
    c.tick(1100)
    expect(draws).toBe(1)
    c.scheduler.invalidate()
    unsubscribe()
    expect(c.pending.size).toBe(0)
    c.scheduler.dispose()
  })

  it('drops to 10fps after sustained expensive draws, then recovers after stable windows', () => {
    const c = clock()
    let cost = 25
    c.scheduler.subscribe(() => c.scheduler.recordDrawCost(cost))
    for (let t = 0; t <= 11000; t += 70) {
      c.scheduler.invalidate()
      c.tick(t)
    }
    expect(c.scheduler.fps).toBe(10)
    cost = 2
    for (let t = 11060; t <= 47000; t += 10) {
      c.scheduler.invalidate()
      c.tick(t)
    }
    expect(c.scheduler.fps).toBe(15)
    cost = 25
    for (let t = 47010; t <= 63000; t += 10) {
      c.scheduler.invalidate()
      c.tick(t)
    }
    expect(c.scheduler.fps).toBe(10)
    cost = 2
    for (let t = 63010; t <= 98000; t += 10) {
      c.scheduler.invalidate()
      c.tick(t)
    }
    expect(c.scheduler.fps).toBe(10) // Recovery failure has a 60s cooldown.
    c.scheduler.dispose()
  })

  it('does not downgrade for a long idle period with no pending data', () => {
    const c = clock()
    c.scheduler.subscribe(() => {})
    for (let t = 0; t < 30000; t += 5000) {
      c.scheduler.invalidate()
      c.tick(t)
    }
    expect(c.scheduler.fps).toBe(15)
  })
})
