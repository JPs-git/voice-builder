import type { AppPhase } from '../types'

interface ToolbarProps {
  phase: AppPhase
  isPlaying: boolean
  onRecord: () => void
  onImport: () => void
  onPlayback: () => void
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

export function Toolbar({ phase, isPlaying, onRecord, onImport, onPlayback, onClear, onConfig, onHelp }: ToolbarProps) {
  const label = LABELS[phase]
  const isRecording = phase === 'recording'
  const isRequesting = phase === 'requesting'
  const isPaused = phase === 'paused'

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <img src="assets/logo.png" className="logo" alt="" aria-hidden="true" />
        <span className="title">在线声音训练</span>
        <span className="subtitle">「看见自己的声音」</span>
      </div>

      <div className="toolbar-actions">
        <button id="btnRecord" className={`btn btn-primary${isRecording ? ' is-recording' : ''}`} onClick={onRecord} disabled={isRequesting}>
          <span className="btn-icon">{isRecording ? '■' : '●'}</span>
          <span className="btn-label">{label}</span>
        </button>

        <button id="btnImport" className="btn btn-ghost" onClick={onImport}>
          <span className="btn-icon">📁</span>
          <span className="btn-label">导入 WAV</span>
        </button>

        <button id="btnPlayback" className="btn btn-ghost" onClick={onPlayback} disabled={!isPaused}>
          <span className="btn-icon">{isPlaying ? '■' : '♫'}</span>
          <span className="btn-label">{isPlaying ? '停止' : '回放'}</span>
        </button>

        <button id="btnClear" className="btn btn-ghost" onClick={onClear}>
          <span className="btn-icon">↺</span>
          <span className="btn-label">清空</span>
        </button>

        <button id="btnConfig" className="btn btn-ghost" aria-label="配置" onClick={onConfig}>
          <span className="btn-icon">⚙</span>
          <span className="btn-label">配置</span>
        </button>

        <button id="btnHelp" className="btn btn-ghost" onClick={onHelp}>
          <span className="btn-icon">?</span>
          <span className="btn-label">帮助</span>
        </button>
      </div>
    </header>
  )
}