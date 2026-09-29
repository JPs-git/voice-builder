import { useEffect, useState } from 'react'
import styles from './RecordDock.module.css'

export interface RecordDockProps {
  onRecord: () => void
  isCapturing: boolean
  isRequesting: boolean
  goalLabel: string
  onGoalClick: () => void
  showGoal?: boolean
  onClear?: () => void
  onPlayback?: () => void
  hasData?: boolean
  isPlaying?: boolean
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="#fff" />
      <path
        d="M5 10a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5z"
        fill="#fff"
      />
      <path d="M12 17v3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 21.5h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function RecordDock({ onRecord, isCapturing, isRequesting, goalLabel, onGoalClick, showGoal = true, onClear, onPlayback, hasData, isPlaying }: RecordDockProps) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isCapturing) { setElapsed(0); return }
    const id = window.setInterval(() => setElapsed(s => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [isCapturing])
  const timer = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const micLabel = isRequesting ? '麦克风授权中' : isCapturing ? '停止录音' : '开始录音'
  return (
    <div
      className={styles.dock}
      data-portrait-dock="true"
      data-actions={Boolean(onClear || onPlayback)}
      data-goal-entry={showGoal}
    >
      {showGoal && (
        <button type="button" className={styles.goal} onClick={onGoalClick}
          data-testid="dock-goal" aria-label="回到训练目标">
          <span className={styles.goalLabel} data-testid="dock-goal-label">{goalLabel}</span>
          <span className={styles.goalHint}>当前目标</span>
          <span className={styles.goalChevron} aria-hidden="true">›</span>
        </button>
      )}
      <span className={styles.micHalo} data-testid="dock-mic-halo">
        <button type="button" className={styles.mic} data-recording={isCapturing}
          onClick={onRecord} disabled={isRequesting} aria-label={micLabel}>
          {isCapturing ? '●' : <MicGlyph />}
        </button>
      </span>
      {onClear && <button type="button" className={styles.action} onClick={onClear} disabled={!hasData}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg>清除图谱
      </button>}
      {onPlayback && <button type="button" className={styles.action} onClick={onPlayback} disabled={!hasData || isRequesting}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d={isPlaying ? 'M9 9h6v6H9z' : 'm10 8 6 4-6 4z'} fill="currentColor" /></svg>{isPlaying ? '停止' : '回放'}
      </button>}
      <span className={styles.hint} data-testid="dock-hint">
        {isCapturing ? '正在录音' : '点击开始录音'}
      </span>
      {isCapturing && <span className={styles.timer} data-testid="dock-timer">{timer}</span>}
    </div>
  )
}
