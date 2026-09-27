import { VOWEL_PRESETS, presetShortLabel } from '../../types'
import { useAppStore } from '../../store/appStore'
import { usePresetBands } from '../../hooks/usePresetBands'
import { BandRangeRow } from '../BandRangeRow'
import styles from './TrainingGoalCard.module.css'

const BAND_KEYS = ['f0', 'f1', 'f2'] as const

export function TrainingGoalCard() {
  const bands = useAppStore(s => s.bands)
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const { localValues, onInputChange, onCommit, onInputKeyDown, onReset } = usePresetBands()

  const presetKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className={styles.card} aria-label="训练目标">
      <header className={styles.header}>
        <span className={styles.title}>训练目标</span>
        <div className={styles.presetGroup}>
          <select
            className={styles.select}
            value={activePreset}
            aria-label="选择元音预设"
            onChange={e => switchPreset(e.target.value)}
          >
            {presetKeys.map(name => (
              <option key={name} value={name}>
                {presetShortLabel(name)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={styles.reset}
          onClick={onReset}
          aria-label="重置所有预设"
        >
          ⟲
        </button>
      </header>

      <div className={styles.bands}>
        {BAND_KEYS.map(key => (
          <BandRangeRow
            key={key}
            bandKey={key}
            localValues={localValues}
            onInputChange={onInputChange}
            onCommit={onCommit}
            onInputKeyDown={onInputKeyDown}
            className={styles.bandRow}
            keyClassName={styles.bandKey}
            inputClassName={styles.bandInput}
            dashClassName={styles.dash}
            unitClassName={styles.unit}
            style={{ borderLeftColor: bands[key].color }}
          />
        ))}
      </div>

      <span className={styles.chevron} aria-hidden="true">›</span>
    </section>
  )
}
