import { VOWEL_PRESETS } from '../types'
import { useAppStore } from '../store/appStore'
import { F0_RANGE } from '../config/analysisRanges'
import { usePresetBands, bandKeyToId } from '../hooks/usePresetBands'
import styles from './TargetPresetBar.module.css'

export function TargetPresetBar() {
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const { localValues, onInputChange, onCommit, onInputKeyDown, onReset } = usePresetBands()

  const vowelKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className={styles.bar} aria-label="共振峰目标区间">
      <div className={styles.row}>
        <label className={styles.label}>目标区间</label>
        <button
          type="button"
          className={styles.resetIcon}
          onClick={onReset}
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
            onClick={() => switchPreset(name)}
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
              onChange={e => onInputChange(key, 0, e.target.value)}
              onBlur={() => onCommit(key, 0)}
              onKeyDown={onInputKeyDown(key, 0)}
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
              onChange={e => onInputChange(key, 1, e.target.value)}
              onBlur={() => onCommit(key, 1)}
              onKeyDown={onInputKeyDown(key, 1)}
              aria-label={`${key.toUpperCase()}上限`}
            />
            <span className={styles.bandUnit}>Hz</span>
          </div>
        ))}
      </div>
    </section>
  )
}
