import { useState } from 'react'
import styles from './Tip.module.css'

interface TipProps {
  content: string
  ariaLabel?: string
}

const isHoverCapable = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(hover: hover)').matches === true

export function Tip({ content, ariaLabel = '说明' }: TipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [canHover] = useState(isHoverCapable)

  const hoverHandlers = canHover
    ? {
        onMouseEnter: () => setIsOpen(true),
        onMouseLeave: () => setIsOpen(false),
      }
    : {}

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        onClick={() => setIsOpen(open => !open)}
        {...hoverHandlers}
      >
        ⓘ
      </button>
      {isOpen && <div className={styles.popover}>{content}</div>}
    </span>
  )
}