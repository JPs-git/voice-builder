import { describe, it, expect, beforeEach } from 'vitest'
import { useAnalysisStore } from '../store/analysisStore'
import { VOWEL_PRESETS } from '../types'

function resetStore() {
  useAnalysisStore.getState().reset()
}

describe('analysisStore', () => {
  beforeEach(() => resetStore())

  describe('initial state', () => {
    it('has idle phase', () => {
      expect(useAnalysisStore.getState().phase).toBe('idle')
    })

    it('has default config', () => {
      const { config } = useAnalysisStore.getState()
      expect(config.formantMethod).toBe('hybrid')
      expect(config.formantSmoothing).toBe(true)
    })

    it('defaults to vowel-a preset', () => {
      const { activePreset, bands } = useAnalysisStore.getState()
      const vowelA = VOWEL_PRESETS['vowel-a']
      expect(activePreset).toBe('vowel-a')
      expect(bands.f0.range).toEqual(vowelA.f0)
      expect(bands.f1.range).toEqual(vowelA.f1)
      expect(bands.f2.range).toEqual(vowelA.f2)
    })

    it('has null dataSource', () => {
      expect(useAnalysisStore.getState().dataSource).toBeNull()
    })
  })

  describe('setPhase', () => {
    it('updates phase', () => {
      useAnalysisStore.getState().setPhase('requesting')
      expect(useAnalysisStore.getState().phase).toBe('requesting')
    })

    it('updates to recording', () => {
      useAnalysisStore.getState().setPhase('recording')
      expect(useAnalysisStore.getState().phase).toBe('recording')
    })

    it('updates to ready', () => {
      useAnalysisStore.getState().setPhase('ready')
      expect(useAnalysisStore.getState().phase).toBe('ready')
    })
  })

  describe('setConfig', () => {
    it('merges partial config', () => {
      useAnalysisStore.getState().setConfig({ formantSmoothing: false })
      const { config } = useAnalysisStore.getState()
      expect(config.formantSmoothing).toBe(false)
      expect(config.formantMethod).toBe('hybrid') // unchanged
    })

    it('updates formantMethod', () => {
      useAnalysisStore.getState().setConfig({ formantMethod: 'lpc' })
      expect(useAnalysisStore.getState().config.formantMethod).toBe('lpc')
    })
  })

  describe('setActivePreset', () => {
    it('updates preset and sets corresponding bands', () => {
      useAnalysisStore.getState().setActivePreset('vowel-i')
      const { activePreset, bands } = useAnalysisStore.getState()
      const vowelI = VOWEL_PRESETS['vowel-i']
      expect(activePreset).toBe('vowel-i')
      expect(bands.f0.range).toEqual(vowelI.f0)
      expect(bands.f1.range).toEqual(vowelI.f1)
      expect(bands.f2.range).toEqual(vowelI.f2)
    })

    it('sets null preset', () => {
      useAnalysisStore.getState().setActivePreset(null)
      expect(useAnalysisStore.getState().activePreset).toBeNull()
    })

    it('no-ops on invalid preset name', () => {
      useAnalysisStore.getState().setActivePreset('vowel-i')
      useAnalysisStore.getState().setActivePreset('nonexistent')
      expect(useAnalysisStore.getState().activePreset).toBe('vowel-i')
    })
  })

  describe('setBands', () => {
    it('merges partial bands update', () => {
      useAnalysisStore.getState().setBands({ f1: [500, 700] })
      const { bands } = useAnalysisStore.getState()
      expect(bands.f1.range).toEqual([500, 700])
    })

    it('does not change other bands', () => {
      const vowelA = VOWEL_PRESETS['vowel-a']
      useAnalysisStore.getState().setBands({ f1: [500, 700] })
      const { bands } = useAnalysisStore.getState()
      expect(bands.f0.range).toEqual(vowelA.f0)
      expect(bands.f2.range).toEqual(vowelA.f2)
    })

    it('rejects invalid range (low >= high)', () => {
      const original = useAnalysisStore.getState().bands.f1.range
      useAnalysisStore.getState().setBands({ f1: [800, 500] })
      expect(useAnalysisStore.getState().bands.f1.range).toEqual(original)
    })

    it('rejects single-element range', () => {
      const original = useAnalysisStore.getState().bands.f0.range
      useAnalysisStore.getState().setBands({ f0: [300] as unknown as [number, number] })
      expect(useAnalysisStore.getState().bands.f0.range).toEqual(original)
    })
  })

  describe('reset', () => {
    it('restores initial state after changes', () => {
      useAnalysisStore.getState().setPhase('recording')
      useAnalysisStore.getState().setActivePreset('vowel-i')
      useAnalysisStore.getState().setConfig({ formantMethod: 'cepstral' })
      useAnalysisStore.getState().reset()

      const vowelA = VOWEL_PRESETS['vowel-a']
      const state = useAnalysisStore.getState()
      expect(state.phase).toBe('idle')
      expect(state.activePreset).toBe('vowel-a')
      expect(state.config.formantMethod).toBe('hybrid')
      expect(state.bands.f0.range).toEqual(vowelA.f0)
      expect(state.dataSource).toBeNull()
    })
  })
})
