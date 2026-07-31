import { describe, it, expect, beforeEach } from 'vitest'
import { useFrameStore } from '../store/frameStore'
import { useAnalysisStore } from '../store/analysisStore'

function resetStore() {
  useFrameStore.getState().clear()
  useAnalysisStore.getState().reset()
}

function makeFrame(overrides: Record<string, number | boolean | null> = {}) {
  return {
    time: overrides.time ?? 0,
    f0: overrides.f0 as number | null ?? null,
    f1: overrides.f1 as number | null ?? null,
    f2: overrides.f2 as number | null ?? null,
    f3: (overrides.f3 as number | null) ?? null,
    f4: (overrides.f4 as number | null) ?? null,
    voiced: (overrides.voiced as boolean) ?? true,
  }
}

describe('frameStore', () => {
  beforeEach(() => resetStore())

  describe('initial state', () => {
    it('has empty frames', () => {
      expect(useFrameStore.getState().frames).toEqual([])
    })

    it('has null latestFrame', () => {
      expect(useFrameStore.getState().latestFrame).toBeNull()
    })

    it('has zero stats', () => {
      const { stats } = useFrameStore.getState()
      expect(stats.f0Mean).toBeNull()
      expect(stats.hitRate).toBeNull()
      expect(stats.duration).toBe(0)
    })

    it('has cursorTime -1', () => {
      expect(useFrameStore.getState().cursorTime).toBe(-1)
    })
  })

  describe('appendFrame', () => {
    it('adds a frame to empty state', () => {
      const frame = makeFrame({ time: 0.01, f0: 220, f1: 850, f2: 1200 })
      useFrameStore.getState().appendFrame(frame)
      expect(useFrameStore.getState().frames).toHaveLength(1)
      expect(useFrameStore.getState().latestFrame).toEqual(frame)
    })

    it('appends multiple frames', () => {
      for (let i = 0; i < 5; i++) {
        useFrameStore.getState().appendFrame(makeFrame({ time: i * 0.01, f0: 220 + i }))
      }
      expect(useFrameStore.getState().frames).toHaveLength(5)
      expect(useFrameStore.getState().latestFrame?.time).toBe(0.04)
    })

    it('enforces window cap of 1000 frames', () => {
      for (let i = 0; i < 1050; i++) {
        useFrameStore.getState().appendFrame(makeFrame({ time: i * 0.01, f0: 220 }))
      }
      const { frames } = useFrameStore.getState()
      expect(frames.length).toBe(1000)
      expect(frames[0].time).toBe(0.5) // first 50 frames shifted out
      expect(frames[frames.length - 1].time).toBe(10.49) // last frame
    })

    it('updates latestFrame on each append', () => {
      const f1 = makeFrame({ time: 0.01, f0: 220 })
      const f2 = makeFrame({ time: 0.02, f0: 225 })
      useFrameStore.getState().appendFrame(f1)
      expect(useFrameStore.getState().latestFrame).toEqual(f1)
      useFrameStore.getState().appendFrame(f2)
      expect(useFrameStore.getState().latestFrame).toEqual(f2)
    })
  })

  describe('stats', () => {
    it('computes f0Mean from frames', () => {
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 200 }))
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.02, f0: 300 }))
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.03, f0: 400 }))
      expect(useFrameStore.getState().stats.f0Mean).toBeCloseTo(300)
    })

    it('f0Mean ignores null f0', () => {
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 200 }))
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.02, f0: null, voiced: false }))
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.03, f0: 400 }))
      expect(useFrameStore.getState().stats.f0Mean).toBeCloseTo(300)
    })

    it('computes hitRate', () => {
      // Default bands.f0 for vowel-a is [200, 280]
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))   // hit
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.02, f0: 300 }))   // miss
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.03, f0: 250 }))   // hit
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.04, f0: 180 }))   // miss
      expect(useFrameStore.getState().stats.hitRate).toBeCloseTo(0.5)
    })

    it('tracks duration as last frame time', () => {
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.05, f0: 225 }))
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.10, f0: 230 }))
      expect(useFrameStore.getState().stats.duration).toBe(0.10)
    })

    it('returns null stats for empty frames', () => {
      expect(useFrameStore.getState().stats.f0Mean).toBeNull()
      expect(useFrameStore.getState().stats.hitRate).toBeNull()
      expect(useFrameStore.getState().stats.duration).toBe(0)
    })
  })

  describe('setFrames', () => {
    it('batch sets all frames', () => {
      const frames = [
        makeFrame({ time: 0.01, f0: 220 }),
        makeFrame({ time: 0.02, f0: 225 }),
        makeFrame({ time: 0.03, f0: 230 }),
      ]
      useFrameStore.getState().setFrames(frames)
      expect(useFrameStore.getState().frames).toHaveLength(3)
      expect(useFrameStore.getState().latestFrame?.time).toBe(0.03)
    })

    it('replaces existing frames', () => {
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      const frames = [makeFrame({ time: 0.10, f0: 300 })]
      useFrameStore.getState().setFrames(frames)
      expect(useFrameStore.getState().frames).toHaveLength(1)
      expect(useFrameStore.getState().latestFrame?.time).toBe(0.10)
    })

    it('recomputes stats', () => {
      const frames = [
        makeFrame({ time: 0.01, f0: 200 }),
        makeFrame({ time: 0.02, f0: 400 }),
      ]
      useFrameStore.getState().setFrames(frames)
      expect(useFrameStore.getState().stats.f0Mean).toBeCloseTo(300)
    })
  })

  describe('setCursorTime', () => {
    it('sets cursor time', () => {
      useFrameStore.getState().setCursorTime(1.5)
      expect(useFrameStore.getState().cursorTime).toBe(1.5)
    })

    it('supports -1 for hidden cursor', () => {
      useFrameStore.getState().setCursorTime(3.0)
      useFrameStore.getState().setCursorTime(-1)
      expect(useFrameStore.getState().cursorTime).toBe(-1)
    })
  })

  describe('clear', () => {
    it('clears all data', () => {
      useFrameStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      useFrameStore.getState().setCursorTime(2.0)
      useFrameStore.getState().clear()

      expect(useFrameStore.getState().frames).toEqual([])
      expect(useFrameStore.getState().latestFrame).toBeNull()
      expect(useFrameStore.getState().cursorTime).toBe(-1)
      expect(useFrameStore.getState().stats.f0Mean).toBeNull()
    })
  })
})
