import styles from './Drawer.module.css'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  if (!open) return null
  return (
    <aside className={styles.drawer}>
      <div className={styles.drawerMask} onClick={onClose} />
      <div className={styles.drawerPanel}>
        <header className={styles.drawerHeader}>
          <h3>{title}</h3>
          <button className={styles.drawerClose} onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </aside>
  )
}
