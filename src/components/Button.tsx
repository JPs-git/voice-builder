import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost'
  icon?: string
  label?: string
  recording?: boolean
}

export function Button({ variant = 'default', icon, label, recording, className, children, ...rest }: ButtonProps) {
  const cls = [
    styles.btn,
    variant === 'primary' && styles.primary,
    variant === 'ghost' && styles.ghost,
    recording && styles.recording,
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} {...rest}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {label && <span className={styles.label}>{label}</span>}
      {children}
    </button>
  )
}
