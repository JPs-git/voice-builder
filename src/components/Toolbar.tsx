import type { AppPhase } from '../types'
import { useAnalysisStore } from '../store/analysisStore'
import { useFrameStore } from '../store/frameStore'
import logo from '../../assets/logo.png'
import { Button } from './Button'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  phase: AppPhase
  isPlaying: boolean
  onImport: () => void
  onPlayback: () => void
  onStopPlayback: () => void
  onConfig: () => void
  onHelp: () => void
  onAbout: () => void
}

const LABELS: Record<AppPhase, string> = {
  idle: '开始录音',
  requesting: '麦克风授权中…',
  recording: '停止录音',
  ready: '继续录音',
}

export function Toolbar({
  phase,
  isPlaying,
  onImport,
  onPlayback,
  onStopPlayback,
  onConfig,
  onHelp,
  onAbout,
}: ToolbarProps) {
  const setPhase = useAnalysisStore(s => s.setPhase)
  const hasFrames = useFrameStore(s => s.frames.length > 0)

  const label = LABELS[phase]
  const isRecording = phase === 'recording'
  const isRequesting = phase === 'requesting'
  const isReady = phase === 'ready'

  const onRecord = () => {
    if (isRecording) {
      setPhase('ready')
    } else {
      setPhase('requesting')
    }
  }

  const onClear = () => {
    setPhase('idle')
  }

  const canPlayOrClear = isReady || isRecording

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

        <Button id="btnPlayback" variant="ghost" icon={isPlaying ? '■' : '♫'} label={isPlaying ? '停止' : '回放'} onClick={isPlaying ? onStopPlayback : onPlayback} disabled={!canPlayOrClear} />

        <Button id="btnClear" variant="ghost" icon="↺" label="清空" onClick={onClear} disabled={!canPlayOrClear && !hasFrames} />

        <Button id="btnConfig" variant="ghost" icon="⚙" label="配置" aria-label="配置" onClick={onConfig} />

        <Button id="btnHelp" variant="ghost" icon="?" label="帮助" onClick={onHelp} />

        <Button id="btnAbout" variant="ghost" icon="ⓘ" label="关于" onClick={onAbout} />
      </div>
    </header>
  )
}
