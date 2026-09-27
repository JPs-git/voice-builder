import { VOWEL_PRESETS, presetShortLabel } from '../types'
import { useAppStore } from '../store/appStore'
import { usePresetBands } from '../hooks/usePresetBands'
import { BandRangeRow } from './BandRangeRow'
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
            {presetShortLabel(name)}
          </button>
        ))}
      </div>
      <div className={styles.inputs}>
        {(['f0', 'f1', 'f2'] as const).map(key => (
          <BandRangeRow
            key={key}
            bandKey={key}
            localValues={localValues}
            onInputChange={onInputChange}
            onCommit={onCommit}
            onInputKeyDown={onInputKeyDown}
            className={styles.bandInput}
            keyClassName={styles.bandKey}
            inputClassName={[styles.bandLo, styles.bandHi]}
            dashClassName={styles.bandDash}
            unitClassName={styles.bandUnit}
          />
        ))}
      </div>
    </section>
  )
}
