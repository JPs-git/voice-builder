import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { BAND_INPUT_LIMITS, FORMANT_MIN_GAP_HZ } from '../config/analysisRanges'
import { getFormantEditBounds } from '../config/targetBandRules'
import type { TargetBands } from '../types'

export type BandKey = 'f0' | 'f1' | 'f2'
export type BandIndex = 0 | 1

export function bandKeyToId(key: BandKey, index: BandIndex): string {
  return `${key}-${index}`
}

function clampBand(key: BandKey, num: number): number {
  const { min, max } = BAND_INPUT_LIMITS[key]
  return Math.max(min, Math.min(num, max))
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
  inputMessages: Record<string, string>
  showInputMessage: (key: BandKey, index: BandIndex, message: string) => void
  onInputChange: (key: BandKey, index: BandIndex, value: string) => void
  onSliderChange: (key: BandKey, index: BandIndex, value: number) => void
  onCommit: (key: BandKey, index: BandIndex) => void
  onInputKeyDown: (key: BandKey, index: BandIndex) => (e: React.KeyboardEvent<HTMLInputElement>) => void
  onReset: () => void
}

export function usePresetBands(): PresetBandsApi {
  const bands = useAppStore(s => s.bands)
  const resetPresets = useAppStore(s => s.resetPresets)
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => makeLocalValues(bands))
  const [inputMessages, setInputMessages] = useState<Record<string, string>>({})
  const ownBands = useRef<TargetBands | null>(null)

  useEffect(() => {
    setLocalValues(makeLocalValues(bands))
    if (ownBands.current !== bands) setInputMessages({})
    ownBands.current = null
  }, [bands])

  // Read the latest store so a blur followed by a slider/preset action cannot overwrite another edit.
  const applyValue = useCallback((key: BandKey, index: BandIndex, num: number) => {
    if (!Number.isFinite(num)) return '请输入有效数值，已恢复为最近有效值'
    const state = useAppStore.getState()
    const bounded = clampBand(key, num)
    const current = state.bands[key].range
    let clamped = bounded
    if (key !== 'f0') {
      const [lowest, highest] = getFormantEditBounds(key, index, state.bands)
      if (lowest > highest) {
        return key === 'f1' && index === 1
          ? `F2 下限限制与 ${FORMANT_MIN_GAP_HZ} Hz 间隔冲突，请提高 F2 下限或降低 F1 下限`
          : `当前区间无法保留 ${FORMANT_MIN_GAP_HZ} Hz 间隔，请先调整另一端`
      }
      clamped = Math.max(lowest, Math.min(bounded, highest))
    }
    const next: [number, number] = index === 0 ? [clamped, current[1]] : [current[0], clamped]
    if (next[0] >= next[1]) return '下限必须小于上限，已恢复为最近有效值'
    if (clamped !== current[index]) {
      state.setBands({ [key]: next })
      const updated = useAppStore.getState().bands
      ownBands.current = updated
      state.savePresetOverride(state.activePreset, updated.f0.range, updated.f1.range, updated.f2.range)
    }
    if (clamped !== num && key === 'f0' && num > BAND_INPUT_LIMITS.f0.max) {
      useToastStore.getState().showToast('info', `F0 目标已超出图谱上限 ${BAND_INPUT_LIMITS.f0.max}Hz，已自动设为 ${BAND_INPUT_LIMITS.f0.max}Hz`)
    }
    if (clamped !== num) {
      const reasons: string[] = []
      if (bounded !== num) {
        const limits = BAND_INPUT_LIMITS[key]
        reasons.push(`允许范围为 ${limits.min}–${limits.max} Hz`)
      }
      if (clamped !== bounded) {
        if (key === 'f1' && index === 1 && bounded > state.bands.f2.range[0]) {
          reasons.push(`F1 上限不能超过 F2 下限 ${state.bands.f2.range[0]} Hz`)
        } else if (key === 'f2' && index === 0 && bounded < state.bands.f1.range[1]) {
          reasons.push(`F2 下限不能低于 F1 上限 ${state.bands.f1.range[1]} Hz`)
        } else {
          reasons.push(`上下限至少相隔 ${FORMANT_MIN_GAP_HZ} Hz`)
        }
      }
      return `已调整为 ${clamped} Hz；${reasons.join('；')}`
    }
  }, [])

  const onInputChange = useCallback((key: BandKey, index: BandIndex, value: string) => {
    setLocalValues(prev => ({ ...prev, [bandKeyToId(key, index)]: value }))
    setInputMessages({})
  }, [])

  const onCommit = useCallback((key: BandKey, index: BandIndex) => {
    const id = bandKeyToId(key, index)
    const message = applyValue(key, index, Number.parseFloat(localValues[id]))
    setInputMessages(message ? { [id]: message } : {})
    // Empty or invalid drafts revert; valid values normalize to the committed/clamped number.
    const committed = useAppStore.getState().bands[key].range[index]
    setLocalValues(prev => ({ ...prev, [id]: String(committed) }))
  }, [localValues, applyValue])

  const onInputKeyDown = useCallback((_key: BandKey, _index: BandIndex) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const dialog = event.currentTarget.closest<HTMLElement>('[role="dialog"]')
      event.currentTarget.blur()
      dialog?.focus({ preventScroll: true })
    }
  }, [])

  const onReset = useCallback(() => {
    if (window.confirm('确定要恢复全部元音的默认目标吗？所有自定义目标将被清除，并切换到元音 a。')) {
      resetPresets()
      ownBands.current = null
      setInputMessages({})
      setLocalValues(makeLocalValues(useAppStore.getState().bands))
    }
  }, [resetPresets])

  const onSliderChange = useCallback((key: BandKey, index: BandIndex, value: number) => {
    const message = applyValue(key, index, value)
    setInputMessages(message ? { [bandKeyToId(key, index)]: message } : {})
  }, [applyValue])

  const showInputMessage = useCallback((key: BandKey, index: BandIndex, message: string) => {
    setInputMessages(message ? { [bandKeyToId(key, index)]: message } : {})
  }, [])

  return { localValues, inputMessages, showInputMessage, onInputChange, onSliderChange, onCommit, onInputKeyDown, onReset }
}
