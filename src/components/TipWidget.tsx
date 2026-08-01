import { useEffect, useState } from 'react'
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

function randomTipIndex(length: number, currentIndex?: number) {
  if (length < 2) return 0

  const nextIndex = Math.floor(Math.random() * length)
  return nextIndex === currentIndex ? (nextIndex + 1) % length : nextIndex
}

export function TipWidget({ tips = DEFAULT_TIPS, interval = 5000 }: TipWidgetProps) {
  const availableTips = tips.length > 0 ? tips : DEFAULT_TIPS
  const [isVisible, setIsVisible] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [tipIndex, setTipIndex] = useState(() => randomTipIndex(availableTips.length))

  useEffect(() => {
    if (isDismissed || isPaused) return

    const timer = window.setTimeout(() => {
      if (isVisible) {
        setIsVisible(false)
      } else {
        setTipIndex(index => randomTipIndex(availableTips.length, index))
        setIsVisible(true)
      }
    }, interval)

    return () => clearTimeout(timer)
  }, [availableTips.length, interval, isDismissed, isPaused, isVisible])

  const handleClose = () => {
    setIsDismissed(true)
    setIsPaused(false)
    setIsVisible(false)
  }

  const handleOpen = () => {
    setTipIndex(index => randomTipIndex(availableTips.length, index))
    setIsDismissed(false)
    setIsPaused(false)
    setIsVisible(true)
  }

  const isHidden = !isVisible

  return (
    <div className={`${styles.widget}${isDismissed ? ` ${styles.widgetClosed}` : ''}`}>
      <button className={styles.trigger} onClick={handleOpen} aria-label="小提示">
        ℹ
      </button>
      <div
        className={`${styles.card}${isHidden ? ` ${styles.cardHidden}` : ''}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <button className={styles.close} onClick={handleClose} aria-label="关闭小提示">×</button>
        <h4 className={styles.title}>💡 小提示</h4>
        <p className={styles.text}>{availableTips[tipIndex]}</p>
      </div>
    </div>
  )
}
