import type { AppPhase } from '../types'
import logo from '../../assets/logo.png'
import { Button } from './Button'
import styles from './Toolbar.module.css'

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
    <header className={styles.toolbar}>
      <div className={styles.brand}>
        <img src={logo} className={styles.logo} alt="" aria-hidden="true" />
        <span className={styles.title}>在线声音训练</span>
        <span className={styles.subtitle}>「看见自己的声音」</span>
      </div>

      <div className={styles.actions}>
        <Button id="btnRecord" variant="primary" icon={isRecording ? '■' : '●'} label={label} recording={isRecording} onClick={onRecord} disabled={isRequesting} />

        <Button id="btnImport" variant="ghost" icon="📁" label="导入 WAV" onClick={onImport} />

        <Button id="btnPlayback" variant="ghost" icon={isPlaying ? '■' : '♫'} label={isPlaying ? '停止' : '回放'} onClick={onPlayback} disabled={!isPaused} />

        <Button id="btnClear" variant="ghost" icon="↺" label="清空" onClick={onClear} />

        <Button id="btnConfig" variant="ghost" icon="⚙" label="配置" aria-label="配置" onClick={onConfig} />

        <Button id="btnHelp" variant="ghost" icon="?" label="帮助" onClick={onHelp} />
      </div>
    </header>
  )
}
