import { useFeedback } from '../feedback'
import styles from './FeedbackCard.module.css'

export function FeedbackCard() {
  const results = useFeedback()
  if (results.length === 0) return null
  return (
    <aside className={styles.card} aria-label="实时反馈">
      <div className={styles.header}>实时反馈</div>
      <ul className={styles.list}>
        {results.map(result => (
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
        ))}
      </ul>
    </aside>
  )
}
