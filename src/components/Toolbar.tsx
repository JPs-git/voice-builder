import type { AppPhase } from '../types'

interface ToolbarProps {
  phase: AppPhase
  onRecord: () => void
  onImport: () => void
  onClear: () => void
  onConfig: () => void
  onHelp: () => void
}

const LABELS: Record<AppPhase, string> = {
  idle: '开始录音',
  requesting: '麦克风授权中…',
  recording: '停止录音',
  paused: '继续录音',
  analyzing: '分析中…',
}

export function Toolbar({ phase, onRecord, onImport, onClear, onConfig, onHelp }: ToolbarProps) {
  const label = LABELS[phase]
  const isRecording = phase === 'recording'
  const isRequesting = phase === 'requesting'
  const isPaused = phase === 'paused'

  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', background: '#FFF', borderBottom: '1px solid #E5E7EB',
      position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="assets/logo.png" alt="" style={{ width: 28, height: 28 }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>在线声音训练</span>
        <span style={{ fontSize: 13, color: '#6B7280' }}>「看见自己的声音」</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onRecord} disabled={isRequesting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: 'none', cursor: isRequesting ? 'not-allowed' : 'pointer',
            background: isRecording ? '#C81E37' : '#E23E57', color: '#FFF', fontSize: 14, fontWeight: 500,
          }}>
          <span>{isRecording ? '■' : '●'}</span>
          <span>{label}</span>
        </button>

        <ActionButton label="导入 WAV" icon="📁" onClick={onImport} />
        {isPaused && <ActionButton label="回放" icon="♫" onClick={() => {}} />}
        <ActionButton label="清空" icon="↺" onClick={onClear} />
        <ActionButton label="配置" icon="⚙" onClick={onConfig} />
        <ActionButton label="帮助" icon="?" onClick={onHelp} />

        <input type="file" id="wavInput" accept=".wav" hidden />
      </div>
    </header>
  )
}

function ActionButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
        border: '1px solid #D1D5DB', background: '#FFF', cursor: 'pointer', fontSize: 14, color: '#4B5563',
        fontWeight: 500,
      }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
