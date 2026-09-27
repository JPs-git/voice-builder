import { useState } from 'react'
import type { ToolItem } from '../../hooks/useToolbar'
import styles from './MobileMoreMenu.module.css'

export interface MobileMoreMenuProps {
  items: ToolItem[]
  onSelect: (toolId: string) => void
  nav?: { label: string; onClick: () => void }
}

export function MobileMoreMenu({ items, onSelect, nav }: MobileMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const menuItems = items.filter(item => item.id !== 'record')
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-label="更多操作"
        aria-expanded={open} onClick={() => setOpen(prev => !prev)}>⋯</button>
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
              onClick={() => { if (item.disabled) return; onSelect(item.id); setOpen(false) }}>
              <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.itemLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
