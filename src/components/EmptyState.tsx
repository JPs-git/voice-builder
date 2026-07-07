interface EmptyStateProps {
  title: string
  description: string
  visible?: boolean
}

export function EmptyState({ title, description, visible = true }: EmptyStateProps) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#98A2B3' }}>{title}</div>
      <div style={{ fontSize: 14, color: '#B0B7C3' }}>{description}</div>
    </div>
  )
}
