import styles from './RecordDock.module.css'

export interface RecordDockProps {
  onRecord: () => void
  isCapturing: boolean
  isRequesting: boolean
  goalLabel: string
  onGoalClick: () => void
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

export function RecordDock({ onRecord, isCapturing, isRequesting, goalLabel, onGoalClick }: RecordDockProps) {
  const micLabel = isRequesting ? '麦克风授权中' : isCapturing ? '停止录音' : '开始录音'
  return (
    <div className={styles.dock} data-portrait-dock="true">
      <button type="button" className={styles.goal} onClick={onGoalClick}
        data-testid="dock-goal" aria-label="回到训练目标">
        <span className={styles.goalLabel} data-testid="dock-goal-label">{goalLabel}</span>
        <span className={styles.goalHint}>当前目标</span>
        <span className={styles.goalChevron} aria-hidden="true">›</span>
      </button>
      <span className={styles.micHalo} data-testid="dock-mic-halo">
        <button type="button" className={styles.mic} data-recording={isCapturing}
          onClick={onRecord} disabled={isRequesting} aria-label={micLabel}>
          {isCapturing ? '■' : <MicGlyph />}
        </button>
      </span>
      <span className={styles.hint} data-testid="dock-hint">
        {isCapturing ? '再次点击停止' : '点击开始录音'}
      </span>
    </div>
  )
}
