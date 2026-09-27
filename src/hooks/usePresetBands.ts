import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { F0_RANGE } from '../config/analysisRanges'
import type { TargetBands } from '../types'

export type BandKey = 'f0' | 'f1' | 'f2'
export type BandIndex = 0 | 1

export function bandKeyToId(key: BandKey, index: BandIndex): string {
  return `${key}-${index}`
}

function clampF0(num: number): number {
  return Math.min(num, F0_RANGE.max)
}

function makeLocalValues(bands: TargetBands) {
  return {
    [bandKeyToId('f0', 0)]: String(bands.f0.range[0]),
    [bandKeyToId('f0', 1)]: String(bands.f0.range[1]),
    [bandKeyToId('f1', 0)]: String(bands.f1.range[0]),
    [bandKeyToId('f1', 1)]: String(bands.f1.range[1]),
    [bandKeyToId('f2', 0)]: String(bands.f2.range[0]),
    [bandKeyToId('f2', 1)]: String(bands.f2.range[1]),
  }
}

export interface PresetBandsApi {
  localValues: Record<string, string>
  onInputChange: (key: BandKey, index: BandIndex, value: string) => void
  onCommit: (key: BandKey, index: BandIndex) => void
  onInputKeyDown: (key: BandKey, index: BandIndex) => (e: React.KeyboardEvent<HTMLInputElement>) => void
  onReset: () => void
}

export function usePresetBands(): PresetBandsApi {
  const bands = useAppStore(s => s.bands)
  const setBands = useAppStore(s => s.setBands)
  const activePreset = useAppStore(s => s.activePreset)
  const savePresetOverride = useAppStore(s => s.savePresetOverride)
  const resetPresets = useAppStore(s => s.resetPresets)

  const [localValues, setLocalValues] = useState<Record<string, string>>(() =>
    makeLocalValues(bands),
  )

  useEffect(() => {
    setLocalValues(makeLocalValues(bands))
  }, [bands])

  const onInputChange = useCallback(
    (key: BandKey, index: BandIndex, value: string) => {
      const id = bandKeyToId(key, index)
      setLocalValues(prev => ({ ...prev, [id]: value }))
      const num = parseFloat(value)
      if (!Number.isFinite(num)) return
      const clamped = key === 'f0' ? clampF0(num) : num
      const current = bands[key].range
      const next: [number, number] =
        index === 0 ? [clamped, current[1]] : [current[0], clamped]
      if (next[0] < next[1]) {
        const updatedBands = { ...bands, [key]: { ...bands[key], range: next } }
        setBands({ [key]: next })
        savePresetOverride(
          activePreset,
          updatedBands.f0.range,
          updatedBands.f1.range,
          updatedBands.f2.range,
        )
        if (clamped !== num) {
          useToastStore.getState().showToast(
            'info',
            `F0 已超出检测上限 ${F0_RANGE.max}Hz，已自动设为 ${F0_RANGE.max}Hz`,
          )
        }
      }
    },
    [bands, setBands, activePreset, savePresetOverride],
  )

  const onCommit = useCallback(
    (key: BandKey, index: BandIndex) => {
      const id = bandKeyToId(key, index)
      const num = parseFloat(localValues[id])
      if (!Number.isFinite(num)) {
        setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
        return
      }
      const clamped = key === 'f0' ? clampF0(num) : num
      const current = bands[key].range
      const next: [number, number] =
        index === 0 ? [clamped, current[1]] : [current[0], clamped]
      if (next[0] < next[1]) {
        const updatedBands = { ...bands, [key]: { ...bands[key], range: next } }
        setBands({ [key]: next })
        savePresetOverride(
          activePreset,
          updatedBands.f0.range,
          updatedBands.f1.range,
          updatedBands.f2.range,
        )
      } else {
        setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
      }
    },
    [localValues, bands, setBands, activePreset, savePresetOverride],
  )

  const onInputKeyDown = useCallback(
    (key: BandKey, index: BandIndex) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onCommit(key, index)
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [onCommit],
  )

  const onReset = useCallback(() => {
    if (window.confirm('确定要重置所有预设到初始值吗？')) {
      resetPresets()
    }
  }, [resetPresets])

  return { localValues, onInputChange, onCommit, onInputKeyDown, onReset }
}
