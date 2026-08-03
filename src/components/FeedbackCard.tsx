import { useAppStore } from '../store/appStore'
import { useFeedback } from '../feedback'
import { getFormantStatus } from '../feedback/status'
import type { FormantStatus } from '../feedback/status'
import type { VoiceRegister } from '../types'
import styles from './FeedbackCard.module.css'

const KEYS = ['f0', 'f1', 'f2'] as const

const REGISTER_LABEL: Record<VoiceRegister, string> = {
  chest: '真声',
  mixed: '混声',
  falsetto: '假声',
  unvoiced: '—',
}

const REGISTER_CLASS: Record<VoiceRegister, string> = {
  chest: styles.registerChest,
  mixed: styles.registerMixed,
  falsetto: styles.registerFalsetto,
  unvoiced: styles.registerNone,
}

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

function formatRegister(frame: ReturnType<typeof useAppStore.getState>['latestFrame']): VoiceRegister {
  if (!frame?.register || frame.register === 'unvoiced') return 'unvoiced'
  return frame.register
}

export function FeedbackCard() {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const formantVisible = useAppStore(s => s.formantVisible)
  const results = useFeedback()
  const register = formatRegister(latestFrame)

  return (
    <aside className={styles.card} aria-label="实时反馈">
      <div className={styles.header}>实时反馈</div>
      <div className={styles.values}>
        <div className={styles.valueRow}>
          <span className={styles.valueLabel}>声区</span>
          <span className={`${styles.valueNum} ${REGISTER_CLASS[register]}`}>
            {REGISTER_LABEL[register]}
          </span>
        </div>
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
