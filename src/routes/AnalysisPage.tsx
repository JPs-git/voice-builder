import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ShellContext } from './AppShell'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { FeedbackCard } from '../components/FeedbackCard'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import { TipWidget } from '../components/TipWidget'
import type { FormantSeries } from '../types'
import styles from './AnalysisPage.module.css'

const LEGEND_KEYS = ['f0', 'f1', 'f2'] as const

const COLORS: Record<FormantSeries, string> = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

export function AnalysisPage() {
  const { cursorTime, hasData } = useOutletContext<ShellContext>()

  const formantVisible = useAppStore(s => s.formantVisible)
  const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)

  return (
    <div className={styles.page}>
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
                      data-active={String(formantVisible[key])}
                      onClick={() => toggleFormantVisible(key)}
                    >
                      <i style={{ background: COLORS[key] }}></i>{key.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chartArea}>
                <FormantChart cursorTime={cursorTime} />
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
    </div>
  )
}
