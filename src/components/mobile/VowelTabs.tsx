import { VOWEL_PRESETS, presetShortLabel } from '../../types'
import styles from './VowelTabs.module.css'

export interface VowelTabsProps {
  active: string
  onSelect: (preset: string) => void
}

export function VowelTabs({ active, onSelect }: VowelTabsProps) {
  const keys = Object.keys(VOWEL_PRESETS)
  return (
    <div className={styles.tabs} role="group" aria-label="选择元音预设">
      {keys.map(key => (
        <button
          key={key}
          type="button"
          className={styles.tab}
          aria-pressed={key === active}
          onClick={() => onSelect(key)}
        >
          {presetShortLabel(key)}
        </button>
      ))}
    </div>
  )
}
