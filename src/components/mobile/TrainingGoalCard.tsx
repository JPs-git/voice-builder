import { VOWEL_PRESETS } from '../../types'
import { useAppStore } from '../../store/appStore'
import { F0_RANGE } from '../../config/analysisRanges'
import { usePresetBands, bandKeyToId } from '../../hooks/usePresetBands'
import styles from './TrainingGoalCard.module.css'

const BAND_KEYS = ['f0', 'f1', 'f2'] as const

export function presetShortLabel(presetName: string): string {
  return VOWEL_PRESETS[presetName]?.label.replace('元音 ', '') ?? '—'
}

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
          <label className={styles.selectLabel} htmlFor="goal-preset">当前元音</label>
          <select
            id="goal-preset"
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
          <span className={styles.presetBadge} data-testid="goal-preset-label">
            {presetShortLabel(activePreset)}
          </span>
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
          <div key={key} className={styles.bandRow} style={{ borderLeftColor: bands[key].color }}>
            <span className={styles.bandKey}>{key.toUpperCase()}</span>
            <input
              type="number"
              inputMode="numeric"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandInput}
              value={localValues[bandKeyToId(key, 0)]}
              onChange={e => onInputChange(key, 0, e.target.value)}
              onBlur={() => onCommit(key, 0)}
              onKeyDown={onInputKeyDown(key, 0)}
              aria-label={`${key.toUpperCase()}下限`}
            />
            <span className={styles.dash}>—</span>
            <input
              type="number"
              inputMode="numeric"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandInput}
              value={localValues[bandKeyToId(key, 1)]}
              onChange={e => onInputChange(key, 1, e.target.value)}
              onBlur={() => onCommit(key, 1)}
              onKeyDown={onInputKeyDown(key, 1)}
              aria-label={`${key.toUpperCase()}上限`}
            />
            <span className={styles.unit}>Hz</span>
          </div>
        ))}
      </div>

      <span className={styles.chevron} aria-hidden="true">›</span>
    </section>
  )
}
