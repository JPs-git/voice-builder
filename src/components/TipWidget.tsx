import { useTipStateMachine } from './useTipStateMachine'
import styles from './TipWidget.module.css'

const DEFAULT_TIPS = [
  '点击顶部「开始录音」或「导入 WAV」即可开始分析',
  '点击元音卡片 a/o/e/i/u/ü 快速切换目标区间',
  '元音开口度大小决定F1，舌位前后决定F2',
  '保持话筒距离 10–15cm，录音效果更佳',
  '持续平稳发声，能获得更稳定的共振峰曲线',
  '点击图例可单独隐藏或显示 F0/F1/F2 曲线',
  'F0 基频决定音高，女性通常 180–300Hz，男性 80–150Hz',
  '录音超过 10 秒时自动保留最近 10 秒数据',
  '点「清空」按钮重置所有数据和图表',
  '遇到问题？点击顶栏 ? 按钮查看完整使用说明',
]

interface TipWidgetProps {
  tips?: string[]
  interval?: number
}

export function TipWidget({ tips = DEFAULT_TIPS, interval = 5000 }: TipWidgetProps) {
  const initialIndex = Math.floor(Math.random() * tips.length)
  const { state, dispatch, cardRef } = useTipStateMachine(tips, interval, initialIndex)

  const isHidden = state.status === 'idle' || state.status === 'stopped' || state.status === 'closing'

  return (
    <div className={`${styles.widget}${state.status === 'stopped' ? ` ${styles.widgetClosed}` : ''}`}>
      <button className={styles.trigger} onClick={() => dispatch({ type: 'OPEN' })} aria-label="小提示">
        ℹ
      </button>
      <div
        ref={cardRef}
        className={`${styles.card}${isHidden ? ` ${styles.cardHidden}` : ''}`}
        onMouseEnter={() => dispatch({ type: 'MOUSE_ENTER' })}
        onMouseLeave={() => dispatch({ type: 'MOUSE_LEAVE' })}
      >
        <button className={styles.close} onClick={() => dispatch({ type: 'CLOSE' })} aria-label="关闭小提示">×</button>
        <h4 className={styles.title}>💡 小提示</h4>
        <p className={styles.text}>{tips[state.index]}</p>
      </div>
    </div>
  )
}
