import { useCallback, useState, useEffect } from 'react'
import { VOWEL_PRESETS } from '../types'
import { useAppStore } from '../store/appStore'
import type { TargetBands } from '../types'
import styles from './TargetPresetBar.module.css'

function bandKeyToId(key: 'f0' | 'f1' | 'f2', index: 0 | 1): string {
  return `${key}-${index}`
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
  const [activePreset, setActivePreset] = useState<string | null>('vowel-a')

  const [localValues, setLocalValues] = useState<Record<string, string>>(() =>
    makeLocalValues(bands),
  )

  useEffect(() => {
    setLocalValues(makeLocalValues(bands))
  }, [bands])

  const handleInputChange = useCallback(
    (key: 'f0' | 'f1' | 'f2', index: 0 | 1, value: string) => {
      setLocalValues(prev => ({ ...prev, [bandKeyToId(key, index)]: value }))
    },
    [],
  )

  const commitValue = useCallback(
    (key: 'f0' | 'f1' | 'f2', index: 0 | 1) => {
      const id = bandKeyToId(key, index)
      const num = parseFloat(localValues[id])
      if (!Number.isFinite(num)) {
        setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
        return
      }
      const current = bands[key].range
      const next: [number, number] =
        index === 0 ? [num, current[1]] : [current[0], num]
      if (next[0] < next[1]) {
        setBands({ [key]: next })
      } else {
        setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
      }
    },
    [localValues, bands, setBands],
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
    const preset = VOWEL_PRESETS[name]
    if (!preset) return
    setActivePreset(name)
    setBands({ f0: preset.f0, f1: preset.f1, f2: preset.f2 })
  }, [setBands])

  const vowelKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className={styles.bar} aria-label="共振峰目标区间">
      <div className={styles.row}>
        <label className={styles.label}>目标区间</label>
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
              min={key === 'f0' ? 20 : 100}
              max={key === 'f0' ? 600 : 3500}
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
              min={key === 'f0' ? 20 : 100}
              max={key === 'f0' ? 600 : 3500}
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
