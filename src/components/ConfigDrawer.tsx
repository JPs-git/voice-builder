import { FORMANT_METHODS } from '../types'
import type { AppConfig, FormantMethod as FM } from '../types'

interface ConfigDrawerProps {
  open: boolean
  config: AppConfig
  onChange: (config: Partial<AppConfig>) => void
  onClose: () => void
}

export function ConfigDrawer({ open, config, onChange, onClose }: ConfigDrawerProps) {
  if (!open) return null
  return (
    <aside style={{
      position: 'fixed', inset: 0, zIndex: 30, display: 'flex', pointerEvents: 'auto',
    }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        width: 320, background: '#FFF', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>配置</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>×</button>
        </header>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>共振峰算法</h4>
            {FORMANT_METHODS.map((m: FM) => (
              <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="radio" name="formantMethod" value={m.value}
                  checked={config.formantMethod === m.value}
                  onChange={() => onChange({ formantMethod: m.value })}
                />
                <span>{m.label} <small style={{ color: '#6B7280' }}>（{m.description}）</small></span>
              </label>
            ))}
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>生效于下次录音或导入</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>共振峰平滑</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={config.formantSmoothing}
                onChange={e => onChange({ formantSmoothing: e.target.checked })}
              />
              <span>中值滤波平滑 <small style={{ color: '#6B7280' }}>（减少毛刺跳变）</small></span>
            </label>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>实时 5 帧中值滤波，消除孤立异常跳变</p>
          </section>
        </div>
      </div>
    </aside>
  )
}
