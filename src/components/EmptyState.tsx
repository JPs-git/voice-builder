interface EmptyStateProps {
  title: string
  description: string
  visible?: boolean
}

export function EmptyState({ title, description, visible = true }: EmptyStateProps) {
  if (!visible) return null
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{description}</div>
    </div>
  )
}