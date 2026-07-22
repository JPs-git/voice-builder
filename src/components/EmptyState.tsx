import styles from './EmptyState.module.css'

interface EmptyStateProps {
  title: string
  description: string
  visible?: boolean
}

export function EmptyState({ title, description, visible = true }: EmptyStateProps) {
  if (!visible) return null
  return (
    <div className={styles.empty}>
      <div className={styles.title}>{title}</div>
      <div className={styles.desc}>{description}</div>
    </div>
  )
}