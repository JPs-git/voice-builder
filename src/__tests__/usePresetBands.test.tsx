import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('onReset restores default presets after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
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
    confirmSpy.mockRestore()
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
