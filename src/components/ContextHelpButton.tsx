import styles from './ContextHelpButton.module.css'

interface ContextHelpButtonProps {
  label: string
  onClick: () => void
}

export function ContextHelpButton({ label, onClick }: ContextHelpButtonProps) {
  return <button type="button" className={styles.button} aria-label={label} onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
      <circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" />
    </svg>
  </button>
}
