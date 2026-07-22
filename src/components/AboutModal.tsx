import { Modal } from './Modal'
import styles from './AboutModal.module.css'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal open={open} title="关于" onClose={onClose}>
      <section className={styles.section}>
        <h4>项目信息</h4>
        <p>名称：在线声音训练「看见自己的声音」</p>
        <p>版本：1.0.0</p>
      </section>

      <section className={styles.section}>
        <h4>仓库地址</h4>
        <p>
          <a className={styles.link} href="https://github.com/JPs-git/voice-builder" target="_blank" rel="noopener noreferrer">
            https://github.com/JPs-git/voice-builder
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h4>更新日志</h4>
        <p className={styles.placeholder}>待补充…</p>
      </section>

      <section className={styles.section}>
        <h4>作者 / 联系方式</h4>
        <p className={styles.placeholder}>待补充…</p>
      </section>
    </Modal>
  )
}
