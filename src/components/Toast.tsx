import { useToastStore } from '../store/toastStore'
import styles from './Toast.module.css'

export function Toast() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`${styles.toast} ${toast.type === 'error' ? styles.error : ''}`}
        >
          <span className={styles.message}>{toast.message}</span>
          <button
            className={styles.close}
            onClick={() => dismissToast(toast.id)}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
