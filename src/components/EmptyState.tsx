import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  title: string
  description: string
  visible?: boolean
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, description, visible = true, icon, action }: EmptyStateProps) {
  if (!visible) return null
  return (
    <div className={styles.empty}>
      {icon && <span className={styles.icon} data-testid="empty-icon" aria-hidden="true">{icon}</span>}
      <div className={styles.title}>{title}</div>
      <div className={styles.desc}>{description}</div>
      {action && <button type="button" className={styles.action} onClick={action.onClick}>{action.label}</button>}
    </div>
  )
}
