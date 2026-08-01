import { useAppStore } from '../store/appStore'
import { useFeedback } from '../feedback'
import { getFormantStatus } from '../feedback/status'
import type { FormantStatus } from '../feedback/status'
import styles from './FeedbackCard.module.css'

const KEYS = ['f0', 'f1', 'f2'] as const

const STATUS_CLASS: Record<FormantStatus, string> = {
  hit: styles.valueHit,
  low: styles.valueWarn,
  high: styles.valueWarn,
  none: styles.valueMute,
}

function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${Math.round(value)} Hz`
}

export function FeedbackCard() {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const formantVisible = useAppStore(s => s.formantVisible)
  const results = useFeedback()

  return (
    <aside className={styles.card} aria-label="实时反馈">
      <div className={styles.header}>实时反馈</div>
      <div className={styles.values}>
        {KEYS.filter(key => formantVisible[key]).map(key => {
          const status = getFormantStatus(latestFrame?.[key], bands[key].range)
          return (
            <div key={key} className={styles.valueRow} data-status={status}>
              <span className={styles.valueLabel}>{key.toUpperCase()}</span>
              <span className={`${styles.valueNum} ${STATUS_CLASS[status]}`}>
                {formatValue(latestFrame?.[key])}
              </span>
            </div>
          )
        })}
      </div>
      <ul className={styles.list}>
        {results.length === 0 ? (
          <li className={styles.row} data-status="idle">
            <span className={styles.label}>目标区间</span>
            <span className={styles.value}>—</span>
          </li>
        ) : (
          results.map(result => (
            <li
              key={result.id}
              className={styles.row}
              data-status={result.status}
            >
              <span className={styles.label}>{result.label}</span>
              <span
                className={`${styles.value} ${result.status === 'hit' ? styles.valueHit : ''}`}
              >
                {result.message}
              </span>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
