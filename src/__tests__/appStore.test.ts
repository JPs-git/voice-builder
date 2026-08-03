import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

function resetStore() {
  useAppStore.getState().reset()
}

function makeFrame(overrides: Record<string, number | boolean | null> = {}) {
  return {
    time: overrides.time as number ?? 0,
    f0: overrides.f0 as number | null ?? null,
    f1: overrides.f1 as number | null ?? null,
    f2: overrides.f2 as number | null ?? null,
    f3: (overrides.f3 as number | null) ?? null,
    f4: (overrides.f4 as number | null) ?? null,
    voiced: (overrides.voiced as boolean) ?? true,
  }
}

describe('appStore', () => {
  beforeEach(() => resetStore())

  describe('config', () => {
    it('has default config', () => {
      const { config } = useAppStore.getState()
      expect(config.formantMethod).toBe('hybrid')
      expect(config.formantSmoothing).toBe(true)
      expect(config.registerDetection).toBe(true)
    })

    it('merges partial config', () => {
      useAppStore.getState().setConfig({ formantSmoothing: false })
      const { config } = useAppStore.getState()
      expect(config.formantSmoothing).toBe(false)
      expect(config.formantMethod).toBe('hybrid')
    })
  })

  describe('bands', () => {
    it('defaults to vowel-a bands', () => {
      const vowelA = VOWEL_PRESETS['vowel-a']
      const { bands } = useAppStore.getState()
      expect(bands.f0.range).toEqual(vowelA.f0)
      expect(bands.f1.range).toEqual(vowelA.f1)
    })

    it('merges partial bands', () => {
      useAppStore.getState().setBands({ f1: [500, 700] })
      expect(useAppStore.getState().bands.f1.range).toEqual([500, 700])
    })

    it('rejects invalid range', () => {
      const original = useAppStore.getState().bands.f1.range
      useAppStore.getState().setBands({ f1: [800, 500] })
      expect(useAppStore.getState().bands.f1.range).toEqual(original)
    })
  })

  describe('frames', () => {
    it('starts empty', () => {
      expect(useAppStore.getState().frames).toEqual([])
      expect(useAppStore.getState().latestFrame).toBeNull()
    })

    it('appendFrame adds frames', () => {
      useAppStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      useAppStore.getState().appendFrame(makeFrame({ time: 0.02, f0: 225 }))
      expect(useAppStore.getState().frames).toHaveLength(2)
      expect(useAppStore.getState().latestFrame?.time).toBe(0.02)
    })

    it('enforces 1000 frame window', () => {
      for (let i = 0; i < 1050; i++) {
        useAppStore.getState().appendFrame(makeFrame({ time: i * 0.01, f0: 220 }))
      }
      expect(useAppStore.getState().frames.length).toBe(1000)
    })

    it('setFrames batch replaces', () => {
      const frames = [
        makeFrame({ time: 0.01, f0: 220 }),
        makeFrame({ time: 0.02, f0: 225 }),
      ]
      useAppStore.getState().setFrames(frames)
      expect(useAppStore.getState().frames).toHaveLength(2)
    })
  })

  describe('clearFrames', () => {
    it('clears only frames, preserves config and bands', () => {
      useAppStore.getState().setConfig({ formantMethod: 'cepstral' })
      useAppStore.getState().setBands({ f0: [100, 200] })
      useAppStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      useAppStore.getState().clearFrames()

      expect(useAppStore.getState().frames).toEqual([])
      expect(useAppStore.getState().latestFrame).toBeNull()
      // Config and bands preserved
      expect(useAppStore.getState().config.formantMethod).toBe('cepstral')
      expect(useAppStore.getState().bands.f0.range).toEqual([100, 200])
    })
  })

  describe('reset', () => {
    it('restores initial state', () => {
      useAppStore.getState().setConfig({ formantMethod: 'cepstral' })
      useAppStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      useAppStore.getState().reset()

      const state = useAppStore.getState()
      expect(state.config.formantMethod).toBe('hybrid')
      expect(state.frames).toEqual([])
      expect(state.latestFrame).toBeNull()
    })
  })

  describe('formantVisible', () => {
    it('defaults to all visible', () => {
      const { formantVisible } = useAppStore.getState()
      expect(formantVisible).toEqual({ f0: true, f1: true, f2: true })
    })

    it('toggleFormantVisible flips a single key', () => {
      useAppStore.getState().toggleFormantVisible('f1')
      const { formantVisible } = useAppStore.getState()
      expect(formantVisible.f0).toBe(true)
      expect(formantVisible.f1).toBe(false)
      expect(formantVisible.f2).toBe(true)
    })

    it('toggleFormantVisible flips back', () => {
      useAppStore.getState().toggleFormantVisible('f0')
      useAppStore.getState().toggleFormantVisible('f0')
      expect(useAppStore.getState().formantVisible.f0).toBe(true)
    })
  })

  describe('clearFrames preserves formantVisible', () => {
    it('keeps hidden state across clear', () => {
      useAppStore.getState().toggleFormantVisible('f1')
      useAppStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
      useAppStore.getState().clearFrames()
      expect(useAppStore.getState().formantVisible.f1).toBe(false)
      expect(useAppStore.getState().frames).toEqual([])
    })
  })

  describe('reset restores formantVisible', () => {
    it('restores all visible', () => {
      useAppStore.getState().toggleFormantVisible('f2')
      useAppStore.getState().reset()
      expect(useAppStore.getState().formantVisible).toEqual({ f0: true, f1: true, f2: true })
    })
  })
})
