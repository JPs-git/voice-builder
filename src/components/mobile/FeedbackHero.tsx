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

const STATUS_LABELS: Record<FormantStatus, string> = {
  high: '高于目标范围',
  low: '低于目标范围',
  hit: '目标范围内',
  none: '暂无有效数据',
}

export function statusGlyph(status: FormantStatus): '↑' | '↓' | '' {
  if (status === 'low') return '↓'
  if (status === 'high') return '↑'
  return ''
}

export function FeedbackHero() {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
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
        role="group"
        data-register={register}
        data-testid="hero-badge"
        aria-label={`声区：${register === 'unvoiced' ? '暂无有效数据' : VOICE_REGISTER_LABELS[register]}`}
      >
        <span className={styles.badgeDot} aria-hidden="true" />
        {register === 'unvoiced' ? '--' : VOICE_REGISTER_LABELS[register]}
      </span>

      {visibleKeys.map(key => {
        const value = latestFrame?.[key]
        const valid = value != null && Number.isFinite(value) && value > 0
        const status = valid ? getFormantStatus(value, bands[key].range) : 'none'
        const text = valid ? String(Math.round(value)) : '--'
        return (
        <span
          key={key}
          className={styles.value}
          role="group"
          aria-label={status === 'none'
            ? `${key.toUpperCase()} ${STATUS_LABELS.none}`
            : `${key.toUpperCase()} ${text} Hz，${STATUS_LABELS[status]}`}
          data-status={status}
          data-testid={`hero-col-${key}`}
          style={{ color: VAL_COLORS[key] }}
        >
          <span className={styles.valueKey}>{key.toUpperCase()}</span>
          <span className={styles.number} data-testid={key === 'f0' ? 'hero-f0' : undefined}>
            {text}
          </span>
          <span className={styles.unit}>Hz</span>
          <span className={styles.direction} aria-hidden="true">{statusGlyph(status)}</span>
        </span>
        )
      })}
    </section>
  )
}
