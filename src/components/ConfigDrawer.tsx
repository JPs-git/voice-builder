import { FORMANT_METHODS } from '../types'
import type { AppConfig, FormantMethod as FM } from '../types'
import { Drawer } from './Drawer'
import styles from './ConfigDrawer.module.css'

interface ConfigDrawerProps {
  open: boolean
  config: AppConfig
  onChange: (config: Partial<AppConfig>) => void
  onClose: () => void
}

export function ConfigDrawer({ open, config, onChange, onClose }: ConfigDrawerProps) {
  return (
    <Drawer open={open} title="配置" onClose={onClose}>
      <section>
        <h4>共振峰算法</h4>
        <div className={styles.radioGroup}>
          {FORMANT_METHODS.map((m: FM) => (
            <label key={m.value} className={styles.radioItem}>
              <input
                type="radio" name="formantMethod" value={m.value}
                checked={config.formantMethod === m.value}
                onChange={() => onChange({ formantMethod: m.value })}
              />
              <span>{m.label} <small>（{m.description}）</small></span>
            </label>
          ))}
        </div>
        <p className={styles.configHint}>生效于下次录音或导入</p>
      </section>
      <section>
        <h4>共振峰平滑</h4>
        <label className={styles.radioItem}>
          <input
            type="checkbox"
            checked={config.formantSmoothing}
            onChange={e => onChange({ formantSmoothing: e.target.checked })}
          />
          <span>中值滤波平滑 <small>（减少毛刺跳变）</small></span>
        </label>
        <p className={styles.configHint}>实时 5 帧中值滤波，消除孤立异常跳变</p>
      </section>
    </Drawer>
  )
}
