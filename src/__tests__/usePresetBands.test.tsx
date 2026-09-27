import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { usePresetBands } from '../hooks/usePresetBands'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { VOWEL_PRESETS } from '../types'

let api: ReturnType<typeof usePresetBands> | null = null

function Probe({ onReady }: { onReady: (a: ReturnType<typeof usePresetBands>) => void }) {
  const hook = usePresetBands()
  onReady(hook)
  return <span data-testid="ready">ready</span>
}

function mount(): void {
  render(<Probe onReady={a => { api = a }} />)
}

describe('usePresetBands', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useToastStore.setState({ toasts: [] })
    api = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('seeds localValues from the store bands', () => {
    mount()
    expect(api).not.toBeNull()
    const vowelA = VOWEL_PRESETS['vowel-a']
    expect(api!.localValues['f0-0']).toBe(String(vowelA.f0[0]))
    expect(api!.localValues['f0-1']).toBe(String(vowelA.f0[1]))
    expect(api!.localValues['f1-0']).toBe(String(vowelA.f1[0]))
    expect(api!.localValues['f2-1']).toBe(String(vowelA.f2[1]))
  })

  it('commits a valid edit into the store and saves a preset override', () => {
    mount()
    const vowelA = VOWEL_PRESETS['vowel-a']
    act(() => {
      api!.onInputChange('f0', 0, '250')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().bands.f0.range).toEqual([250, vowelA.f0[1]])
    const override = useAppStore.getState().presetOverrides.find(o => o.key === 'vowel-a')
    expect(override?.f0[0]).toBe(250)
  })

  it('clamps F0 above the detection ceiling and raises a toast', () => {
    mount()
    act(() => {
      api!.onInputChange('f0', 1, '1100')
    })
    expect(useAppStore.getState().bands.f0.range[1]).toBe(1000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('reverts when the value is not a finite number', () => {
    mount()
    const vowelA = VOWEL_PRESETS['vowel-a']
    act(() => {
      api!.onInputChange('f0', 0, 'abc')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().bands.f0.range).toEqual(vowelA.f0)
    expect(api!.localValues['f0-0']).toBe(String(vowelA.f0[0]))
  })

  it('reverts when low >= high', () => {
    mount()
    const vowelA = VOWEL_PRESETS['vowel-a']
    act(() => {
      api!.onInputChange('f0', 0, '500')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().bands.f0.range).toEqual(vowelA.f0)
    expect(api!.localValues['f0-0']).toBe(String(vowelA.f0[0]))
  })

  it('reapplies a saved override when switching away from and back to its preset', () => {
    mount()
    act(() => {
      api!.onInputChange('f1', 0, '700')
    })
    act(() => {
      api!.onCommit('f1', 0)
    })
    act(() => {
      useAppStore.getState().switchPreset('vowel-i')
    })
    expect(useAppStore.getState().bands.f1.range).toEqual(VOWEL_PRESETS['vowel-i'].f1)
    expect(api!.localValues['f1-0']).toBe(String(VOWEL_PRESETS['vowel-i'].f1[0]))
    act(() => {
      useAppStore.getState().switchPreset('vowel-a')
    })
    expect(useAppStore.getState().bands.f1.range).toEqual([700, VOWEL_PRESETS['vowel-a'].f1[1]])
    expect(api!.localValues['f1-0']).toBe('700')
  })

  it('onReset restores default presets after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mount()
    act(() => {
      api!.onInputChange('f0', 0, '250')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().presetOverrides.length).toBeGreaterThan(0)
    act(() => {
      api!.onReset()
    })
    expect(useAppStore.getState().presetOverrides).toHaveLength(0)
    expect(useAppStore.getState().activePreset).toBe('vowel-a')
  })

  it('onReset keeps overrides and bands when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mount()
    act(() => {
      api!.onInputChange('f1', 0, '700')
    })
    act(() => {
      api!.onCommit('f1', 0)
    })
    act(() => {
      api!.onReset()
    })
    expect(useAppStore.getState().presetOverrides).toHaveLength(1)
    expect(useAppStore.getState().bands.f1.range).toEqual([700, VOWEL_PRESETS['vowel-a'].f1[1]])
    expect(api!.localValues['f1-0']).toBe('700')
  })

  it('onInputKeyDown commits on Enter', () => {
    mount()
    const blur = vi.fn()
    act(() => {
      api!.onInputChange('f0', 0, '260')
    })
    act(() => {
      api!.onInputKeyDown('f0', 0)({ key: 'Enter', target: { blur } } as never)
    })
    expect(useAppStore.getState().bands.f0.range[0]).toBe(260)
    expect(blur).toHaveBeenCalled()
  })
})
