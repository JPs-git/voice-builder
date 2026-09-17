import { useCallback, useState, useEffect } from 'react'
import { VOWEL_PRESETS } from '../types'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { F0_RANGE } from '../config/analysisRanges'
import type { TargetBands } from '../types'
import styles from './TargetPresetBar.module.css'

function bandKeyToId(key: 'f0' | 'f1' | 'f2', index: 0 | 1): string {
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

export function TargetPresetBar() {
  const bands = useAppStore(s => s.bands)
  const setBands = useAppStore(s => s.setBands)
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const savePresetOverride = useAppStore(s => s.savePresetOverride)
  const resetPresets = useAppStore(s => s.resetPresets)

  const [localValues, setLocalValues] = useState<Record<string, string>>(() =>
    makeLocalValues(bands),
  )

  useEffect(() => {
    setLocalValues(makeLocalValues(bands))
  }, [bands])

  const handleInputChange = useCallback(
    (key: 'f0' | 'f1' | 'f2', index: 0 | 1, value: string) => {
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

  const commitValue = useCallback(
    (key: 'f0' | 'f1' | 'f2', index: 0 | 1) => {
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

  const handleInputBlur = useCallback(
    (key: 'f0' | 'f1' | 'f2', index: 0 | 1) => { commitValue(key, index) },
    [commitValue],
  )

  const handleInputKeyDown = useCallback(
    (key: 'f0' | 'f1' | 'f2', index: 0 | 1) => {
      return (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          commitValue(key, index)
          ;(e.target as HTMLInputElement).blur()
        }
      }
    },
    [commitValue],
  )

  const handlePresetClick = useCallback((name: string) => {
    if (!VOWEL_PRESETS[name]) return
    switchPreset(name)
  }, [switchPreset])

  const handleReset = useCallback(() => {
    if (window.confirm('确定要重置所有预设到初始值吗？')) {
      resetPresets()
    }
  }, [resetPresets])

  const vowelKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className={styles.bar} aria-label="共振峰目标区间">
      <div className={styles.row}>
        <label className={styles.label}>目标区间</label>
        <button
          type="button"
          className={styles.resetIcon}
          onClick={handleReset}
          aria-label="重置所有预设"
        >
          ⟲
        </button>
      </div>
      <div className={styles.vowels} role="group" aria-label="元音预设">
        {vowelKeys.map(name => (
          <button
            key={name}
            type="button"
            className={`${styles.vowelBtn}${activePreset === name ? ` ${styles.vowelBtnActive}` : ''}`}
            data-preset={name}
            onClick={() => handlePresetClick(name)}
          >
            {VOWEL_PRESETS[name].label.replace('元音 ', '')}
          </button>
        ))}
      </div>
      <div className={styles.inputs}>
        {(['f0', 'f1', 'f2'] as const).map(key => (
          <div key={key} className={styles.bandInput} data-band={key}>
            <span className={styles.bandKey}>{key.toUpperCase()}</span>
            <input
              type="number"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandLo}
              value={localValues[bandKeyToId(key, 0)]}
              onChange={e => handleInputChange(key, 0, e.target.value)}
              onBlur={() => handleInputBlur(key, 0)}
              onKeyDown={handleInputKeyDown(key, 0)}
              aria-label={`${key.toUpperCase()}下限`}
            />
            <span className={styles.bandDash}>—</span>
            <input
              type="number"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandHi}
              value={localValues[bandKeyToId(key, 1)]}
              onChange={e => handleInputChange(key, 1, e.target.value)}
              onBlur={() => handleInputBlur(key, 1)}
              onKeyDown={handleInputKeyDown(key, 1)}
              aria-label={`${key.toUpperCase()}上限`}
            />
            <span className={styles.bandUnit}>Hz</span>
          </div>
        ))}
      </div>
    </section>
  )
}
