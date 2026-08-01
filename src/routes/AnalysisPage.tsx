import { useState } from 'react'
import { useToolbar } from '../hooks/useToolbar'
import { Toolbar } from '../components/Toolbar'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { FeedbackCard } from '../components/FeedbackCard'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { TipWidget } from '../components/TipWidget'
import { Toast } from '../components/Toast'
import styles from './AnalysisPage.module.css'

const LEGEND_KEYS = ['f0', 'f1', 'f2'] as const
type LegendKey = typeof LEGEND_KEYS[number]

const COLORS: Record<LegendKey, string> = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

export function AnalysisPage() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [seriesVisible, setSeriesVisible] = useState<Record<LegendKey, boolean>>({
    f0: true,
    f1: true,
    f2: true,
  })

  const handleToggleSeries = (key: LegendKey) => {
    setSeriesVisible(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const { toolItems, handleClickTool, hasData, cursorTime, fileInputRef, handleFileChange }
    = useToolbar(
      () => setConfigOpen(true),
      () => setHelpOpen(true),
      () => setAboutOpen(true),
    )

  return (
    <div>
      <Toolbar toolItems={toolItems} onToolClick={handleClickTool} />

      <main className={styles.content}>
        <div className={styles.sidePanel}>
          <TargetPresetBar />
          <FeedbackCard />
        </div>

        <div className={styles.chartsColumn}>
          <section className={`${styles.card} ${styles.chartsColumnCard}`}>
            <div className={styles.chartWrapper}>
              <div className={styles.chartHeader}>
                <h2 className={styles.cardTitle}>基频</h2>
              </div>
              <div className={styles.chartArea}>
                <F0Chart cursorTime={cursorTime} />
                <EmptyState
                  title="还没有声音数据"
                  description="🎤 点击顶栏'开始录音'试试"
                  visible={!hasData}
                />
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.chartsColumnCard}`}>
            <div className={styles.chartWrapper}>
              <div className={`${styles.chartHeader} ${styles.chartHeaderLegend}`}>
                <h2 className={styles.cardTitle}>共振峰</h2>
                <div className={styles.cardLegend} aria-label="图例">
                  {LEGEND_KEYS.map(key => (
                    <button
                      key={key}
                      className={styles.legendItem}
                      data-key={key}
                      data-active={String(seriesVisible[key])}
                      onClick={() => handleToggleSeries(key)}
                    >
                      <i style={{ background: COLORS[key] }}></i>{key.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chartArea}>
                <FormantChart cursorTime={cursorTime} seriesVisible={seriesVisible} />
                <EmptyState
                  title="曲线待生成"
                  description="录音或导入音频后显示共振峰曲线"
                  visible={!hasData}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <TipWidget />

      <Toast />

      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <input ref={fileInputRef} type="file" accept=".wav" hidden onChange={handleFileChange} />
    </div>
  )
}
