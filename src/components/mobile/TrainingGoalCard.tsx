import { useAppStore } from '../../store/appStore'
import { usePresetBands } from '../../hooks/usePresetBands'
import { BandRangeRow } from '../BandRangeRow'
import { VOWEL_PRESETS, presetShortLabel } from '../../types'
import styles from './TrainingGoalCard.module.css'

const BAND_KEYS = ['f0', 'f1', 'f2'] as const

const BAND_BAR_COLORS = { f0: '#12B886', f1: '#F04B6A', f2: '#3F83F8' }

export function TrainingGoalCard() {
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const { localValues, onInputChange, onCommit, onInputKeyDown } = usePresetBands()

  return (
    <section className={styles.card} aria-label="训练目标">
      <header className={styles.header}>
        <span className={styles.targetIcon} role="img" aria-label="训练目标图标">🎯</span>
        <span className={styles.title}>训练目标</span>
      </header>

      <div className={styles.vowelBox}>
        <select
          aria-label="选择元音预设"
          className={styles.select}
          value={activePreset}
          onChange={e => switchPreset(e.target.value)}
        >
          {Object.keys(VOWEL_PRESETS).map(key => (
            <option key={key} value={key}>
              {presetShortLabel(key)}
            </option>
          ))}
        </select>
      </div>

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
            keyClassName={`${styles.bandKey} ${styles[`bandKey_${key}`]}`}
            inputClassName={styles.bandInput}
            dashClassName={styles.dash}
            unitClassName={styles.unit}
            style={{ borderLeftColor: BAND_BAR_COLORS[key] }}
          />
        ))}
      </div>
    </section>
  )
}
