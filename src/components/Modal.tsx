import styles from './Modal.module.css'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null
  return (
    <div className={styles.modal}>
      <div className={styles.modalMask} onClick={onClose} />
      <div className={styles.modalPanel}>
        <header className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}
