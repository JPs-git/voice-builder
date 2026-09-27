import styles from './RecordDock.module.css'

export interface RecordDockProps {
  onRecord: () => void
  isCapturing: boolean
  isRequesting: boolean
  goalLabel: string
  onGoalClick: () => void
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
      <button type="button" className={styles.mic} data-recording={isCapturing}
        onClick={onRecord} disabled={isRequesting} aria-label={micLabel}>
        {isCapturing ? '■' : '●'}
      </button>
      <span className={styles.hint} data-testid="dock-hint">
        {isCapturing ? '再次点击停止' : '点击开始录音'}
      </span>
    </div>
  )
}
