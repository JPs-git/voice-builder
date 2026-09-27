import { useAppStore } from '../../store/appStore'
import { getFormantStatus } from '../../feedback/status'
import type { FormantStatus } from '../../feedback/status'
import type { FormantSeries } from '../../types'
import styles from './FeedbackHero.module.css'

const KEYS: FormantSeries[] = ['f0', 'f1', 'f2']

export interface Badge {
  tone: 'idle' | 'hit' | 'warn'
  text: string
}

export function resolveBadge(statuses: FormantStatus[]): Badge {
  if (statuses.length === 0) return { tone: 'idle', text: '等待声音' }
  const meaningful = statuses.filter(s => s !== 'none')
  if (meaningful.length === 0) return { tone: 'idle', text: '等待声音' }
  if (meaningful.every(s => s === 'hit')) return { tone: 'hit', text: '目标范围内' }
  if (meaningful.some(s => s === 'high')) return { tone: 'warn', text: '偏高' }
  return { tone: 'warn', text: '偏低' }
}

export function statusGlyph(status: FormantStatus): string {
  if (status === 'hit') return '✓'
  if (status === 'low') return '↓'
  if (status === 'high') return '↑'
  return '—'
}

function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '--'
  return String(Math.round(value))
}

export function FeedbackHero() {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const formantVisible = useAppStore(s => s.formantVisible)

  const visibleKeys = KEYS.filter(key => formantVisible[key])
  const columns = visibleKeys.map(key => ({
    key,
    status: getFormantStatus(latestFrame?.[key], bands[key].range),
  }))
  const badge = resolveBadge(columns.map(column => column.status))

  return (
    <section className={styles.card} aria-label="实时反馈">
      <header className={styles.header}>
        <span className={styles.heroIcon} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.title}>实时反馈</span>
        <span
          className={styles.badge}
          data-tone={badge.tone}
          data-testid="hero-badge"
        >
          <span className={styles.badgeDot} aria-hidden="true" />
          {badge.text}
        </span>
      </header>

      <div className={styles.readout}>
        <span className={styles.readoutLabel}>F0</span>
        <span className={styles.readoutRow}>
          <span className={styles.readoutValue} data-testid="hero-f0">
            {formatValue(latestFrame?.f0)}
          </span>
          <span className={styles.readoutUnit}>Hz</span>
        </span>
      </div>

      <div className={styles.columns}>
        {columns.map(({ key, status }) => (
          <div
            key={key}
            className={styles.column}
            data-testid={`hero-col-${key}`}
            data-status={status}
          >
            <span className={styles.columnKey}>{key.toUpperCase()}</span>
            <span className={styles.columnValueRow}>
              <span className={styles.columnValue}>{formatValue(latestFrame?.[key])}</span>
              <span className={styles.columnUnit}>Hz</span>
            </span>
            <span
              className={styles.columnStatus}
              data-status={status}
              data-testid={`hero-col-${key}-status`}
            >
              {statusGlyph(status)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
