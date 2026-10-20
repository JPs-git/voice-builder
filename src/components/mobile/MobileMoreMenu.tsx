import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ToolItem } from '../../hooks/useToolbar'
import styles from './MobileMoreMenu.module.css'

export interface MobileMoreMenuProps {
  items: ToolItem[]
  onSelect: (toolId: string) => void
  nav?: { label: string; onClick: () => void }
  triggerButtonRef?: RefObject<HTMLButtonElement | null>
  variant?: 'mobile' | 'desktop'
}

export function MobileMoreMenu({ items, onSelect, nav, triggerButtonRef, variant='mobile' }: MobileMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const internalTriggerRef = useRef<HTMLButtonElement>(null)
  const triggerRef = triggerButtonRef ?? internalTriggerRef
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, triggerRef])
  const menuItems = items.filter(item => item.id !== 'record')
  return (
    <div ref={wrapRef} className={`${styles.wrap} ${variant==='desktop'?styles.desktop:''}`}>
      <button ref={triggerRef} type="button" className={styles.trigger} aria-label="更多操作"
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(prev => !prev)}>⋯</button>
      {open && (
        <div className={styles.menu} role="menu">
          {nav && (
            <button key="__nav" type="button" role="menuitem" className={styles.item}
              onClick={() => { nav.onClick(); setOpen(false) }}>
              <span className={styles.itemIcon} aria-hidden="true">⇄</span>
              <span className={styles.itemLabel}>{nav.label}</span>
            </button>
          )}
          {menuItems.map(item => (
            <button key={item.id} type="button" role="menuitem" className={styles.item}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                // The menu item unmounts; modal focus restoration needs a persistent origin.
                triggerRef.current?.focus()
                onSelect(item.id)
                setOpen(false)
              }}>
              <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.itemLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
