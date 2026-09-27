import { useAppStore } from '../../store/appStore'
import { usePresetBands } from '../../hooks/usePresetBands'
import { BandRangeRow } from '../BandRangeRow'
import { VowelTabs } from './VowelTabs'
import styles from './TrainingGoalCard.module.css'

const BAND_KEYS = ['f0', 'f1', 'f2'] as const

const BAND_BAR_COLORS = { f0: '#13B98B', f1: '#E84C68', f2: '#4387F5' }

export function TrainingGoalCard() {
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const { localValues, onInputChange, onCommit, onInputKeyDown } = usePresetBands()

  return (
    <section className={styles.card} aria-label="训练目标">
      <header className={styles.header}>
        <span className={styles.targetIcon} role="img" aria-label="训练目标图标">◎</span>
        <span className={styles.title}>训练目标</span>
        <span className={styles.chevron} aria-hidden="true">›</span>
      </header>

      <div className={styles.body}>
        <VowelTabs active={activePreset} onSelect={switchPreset} />

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
              style={{ borderLeftColor: BAND_BAR_COLORS[key] }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
