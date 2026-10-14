import { useAppStore } from '../../store/appStore'
import { getFormantStatus } from '../../feedback/status'
import { VOICE_REGISTER_LABELS } from '../../feedback/register'
import type { FormantStatus } from '../../feedback/status'
import type { FormantSeries } from '../../types'
import styles from './FeedbackHero.module.css'

const KEYS: FormantSeries[] = ['f0', 'f1', 'f2']

const VAL_COLORS: Record<FormantSeries, string> = {
  f0: 'var(--v2-f0)',
  f1: 'var(--v2-f1)',
  f2: 'var(--v2-f2)',
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
  const formantVisible = useAppStore(s => s.formantVisible)

  const visibleKeys = KEYS.filter(key => formantVisible[key])
  const detectedRegister = latestFrame?.register
  const register = detectedRegister === 'chest' || detectedRegister === 'mixed' || detectedRegister === 'falsetto'
    ? detectedRegister
    : 'unvoiced'

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
        data-register={register}
        data-testid="hero-badge"
        aria-label={`声区：${register === 'unvoiced' ? '等待声音' : VOICE_REGISTER_LABELS[register]}`}
      >
        <span className={styles.badgeDot} aria-hidden="true" />
        {register === 'unvoiced' ? '等待声音' : VOICE_REGISTER_LABELS[register]}
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
