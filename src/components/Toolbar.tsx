import logo from '../../assets/logo.png'
import { Button } from './Button'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  isCapturing: boolean
  isRequesting: boolean
  hasData: boolean
  isPlaying: boolean
  onRecord: () => void
  onImport: () => void
  onPlayback: () => void
  onStopPlayback: () => void
  onClear: () => void
  onConfig: () => void
  onHelp: () => void
  onAbout: () => void
}

export function Toolbar({
  isCapturing,
  isRequesting,
  hasData,
  isPlaying,
  onRecord,
  onImport,
  onPlayback,
  onStopPlayback,
  onClear,
  onConfig,
  onHelp,
  onAbout,
}: ToolbarProps) {
  let label: string
  if (isRequesting) {
    label = '麦克风授权中…'
  } else if (isCapturing) {
    label = '停止录音'
  } else if (hasData) {
    label = '继续录音'
  } else {
    label = '开始录音'
  }

  const canPlayOrClear = hasData || isCapturing

  return (
    <header className={styles.toolbar}>
      <div className={styles.brand}>
        <img src={logo} className={styles.logo} alt="" aria-hidden="true" />
        <span className={styles.title}>在线声音训练</span>
        <span className={styles.subtitle}>「看见自己的声音」</span>
      </div>

      <div className={styles.actions}>
        <Button
          id="btnRecord"
          variant="primary"
          icon={isCapturing ? '■' : '●'}
          label={label}
          recording={isCapturing}
          onClick={onRecord}
          disabled={isRequesting}
        />

        <Button id="btnImport" variant="ghost" icon="📁" label="导入 WAV" onClick={onImport} />

        <Button
          id="btnPlayback"
          variant="ghost"
          icon={isPlaying ? '■' : '♫'}
          label={isPlaying ? '停止' : '回放'}
          onClick={isPlaying ? onStopPlayback : onPlayback}
          disabled={!canPlayOrClear}
        />

        <Button
          id="btnClear"
          variant="ghost"
          icon="↺"
          label="清空"
          onClick={onClear}
          disabled={!canPlayOrClear}
        />

        <Button id="btnConfig" variant="ghost" icon="⚙" label="配置" aria-label="配置" onClick={onConfig} />

        <Button id="btnHelp" variant="ghost" icon="?" label="帮助" onClick={onHelp} />

        <Button id="btnAbout" variant="ghost" icon="ⓘ" label="关于" onClick={onAbout} />
      </div>
    </header>
  )
}
