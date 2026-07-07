import { useState, useEffect, useCallback } from 'react'

const TIPS = [
  '点击顶部「开始录音」或「导入 WAV」即可开始分析',
  '点击元音卡片 a/o/e/i/u/ü 快速切换目标区间',
  '元音开口度大小决定F1，舌位前后决定F2',
  '保持话筒距离 10–15cm，录音效果更佳',
  '持续平稳发声，能获得更稳定的共振峰曲线',
  '点击 ⚙ 配置可切换共振峰算法（混合法 / LPC / 倒谱法）',
  '点击图例可单独隐藏或显示 F0/F1/F2 曲线',
  '目标区间以绿色高亮显示，进入区间时数值变色',
  'F0 基频决定音高，女性通常 180–300Hz，男性 80–150Hz',
  '录音超过 10 秒时自动保留最近 10 秒数据',
  '点「清空」按钮重置所有数据和图表',
  '遇到问题？点击顶栏 ? 按钮查看完整使用说明',
]

interface TipWidgetProps {
  interval?: number
}

export function TipWidget({ interval = 5000 }: TipWidgetProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [visible, setVisible] = useState(true)

  const next = useCallback(() => {
    setIndex(i => (i + 1) % TIPS.length)
  }, [])

  useEffect(() => {
    if (!visible) return
    const id = setInterval(next, interval)
    return () => clearInterval(id)
  }, [interval, visible])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 16, zIndex: 50,
      background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '12px 16px',
      maxWidth: 320, display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <div style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.5, flex: 1 }}>
        💡 {TIPS[index]}
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
          color: '#98A2B3', padding: 0, lineHeight: 1, flexShrink: 0,
        }}
        aria-label="关闭提示"
      >
        ×
      </button>
    </div>
  )
}
