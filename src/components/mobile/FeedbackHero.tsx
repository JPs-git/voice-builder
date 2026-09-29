import { useDisplayAnalysis } from '../../hooks/useDisplayAnalysis'
import { useAppStore } from '../../store/appStore'
import { getFormantStatus } from '../../feedback/status'
import type { FormantStatus } from '../../feedback/status'
import type { FormantSeries } from '../../types'
import styles from './FeedbackHero.module.css'

const KEYS: FormantSeries[] = ['f0', 'f1', 'f2']

const VAL_COLORS: Record<FormantSeries, string> = {
  f0: 'var(--v2-f0)',
  f1: 'var(--v2-f1)',
  f2: 'var(--v2-f2)',
}

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
  const { latestFrame } = useDisplayAnalysis()
  const bands = useAppStore(s => s.bands)
  const formantVisible = useAppStore(s => s.formantVisible)

  const visibleKeys = KEYS.filter(key => formantVisible[key])
  const statuses = visibleKeys.map(key => getFormantStatus(latestFrame?.[key], bands[key].range))
  const badge = resolveBadge(statuses)

  return (
    <section className={styles.card} aria-label="实时反馈">
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

      {visibleKeys.map(key => (
        <span
          key={key}
          className={styles.value}
          data-testid={`hero-col-${key}`}
          style={{ color: VAL_COLORS[key] }}
        >
          <span className={styles.valueKey}>{key.toUpperCase()}</span>
          <span className={styles.number} data-testid={key === 'f0' ? 'hero-f0' : undefined}>
            {formatValue(latestFrame?.[key])}
          </span><span className={styles.unit}>Hz</span>
        </span>
      ))}
    </section>
  )
}
