import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  title: string
  description: string
  visible?: boolean
  icon?: ReactNode
}

export function EmptyState({ title, description, visible = true, icon }: EmptyStateProps) {
  if (!visible) return null
  return (
    <div className={styles.empty}>
      {icon && <span className={styles.icon} data-testid="empty-icon" aria-hidden="true">{icon}</span>}
      <div className={styles.title}>{title}</div>
      <div className={styles.desc}>{description}</div>
    </div>
  )
}