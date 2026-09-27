import { useCallback, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ShellContext } from './AppShell'
import { TrainingGoalCard } from '../components/mobile/TrainingGoalCard'
import { FeedbackHero } from '../components/mobile/FeedbackHero'
import { RecordDock } from '../components/mobile/RecordDock'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import { TipWidget } from '../components/TipWidget'
import { presetShortLabel } from '../types'
import type { FormantSeries } from '../types'
import styles from './AnalysisPage.module.css'

const LEGEND_KEYS = ['f0', 'f1', 'f2'] as const

const SERIES_COLORS: Record<FormantSeries, string> = {
  f0: '#13B98B',
  f1: '#E84C68',
  f2: '#3B82F6',
}

type ChartTab = 'f0' | 'formant'

export function AnalysisPortrait() {
  const { cursorTime, hasData, isCapturing, isRequesting, onRecord } =
    useOutletContext<ShellContext>()

  const formantVisible = useAppStore(s => s.formantVisible)
  const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)
  const activePreset = useAppStore(s => s.activePreset)

  const [activeTab, setActiveTab] = useState<ChartTab>('f0')

  const goalRef = useRef<HTMLDivElement>(null)
  const scrollToGoal = useCallback(() => {
    goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToChart = useCallback((tab: ChartTab) => {
    setActiveTab(tab)
    document.getElementById(tab === 'f0' ? 'f0Chart' : 'formantChart')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const goalLabel = presetShortLabel(activePreset)

  return (
    <div className={styles.page} data-layout="portrait">
      <main className={`${styles.content} ${styles.portraitMain}`}>
        <div ref={goalRef} data-testid="training-goal-card" className={styles.portraitSlot}>
          <TrainingGoalCard />
        </div>

        <div data-testid="feedback-hero" className={styles.portraitSlot}>
          <FeedbackHero />
        </div>

        <section className={`${styles.card} ${styles.portraitChartsCard}`}>
          <nav className={styles.portraitTabs} aria-label="图表导航">
            <button
              type="button"
              className={styles.portraitTab}
              data-active={String(activeTab === 'f0')}
              onClick={() => scrollToChart('f0')}
            >
              基频
            </button>
            <button
              type="button"
              className={styles.portraitTab}
              data-active={String(activeTab === 'formant')}
              onClick={() => scrollToChart('formant')}
            >
              共振峰
            </button>
          </nav>

          <div className={styles.chartPanel}>
            <div className={styles.chartPanelHeader}>
              <h2 className={styles.cardTitle}>基频</h2>
              <div className={styles.f0Legend} data-testid="f0-legend" aria-label="图例">
                <span className={styles.f0LegendItem}>
                  <i className={styles.f0LegendLine} aria-hidden="true" />
                  当前值
                </span>
                <span className={styles.f0LegendItem}>
                  <i className={styles.f0LegendZone} aria-hidden="true" />
                  目标区间
                </span>
                <span className={styles.f0LegendItem}>
                  <i className={styles.f0LegendTarget} aria-hidden="true" />
                  目标线
                </span>
              </div>
            </div>
            <div className={styles.chartArea}>
              <F0Chart cursorTime={cursorTime} />
              <EmptyState
                title="还没有声音数据"
                description="🎤 点击下方红色按钮开始录音"
                visible={!hasData}
              />
            </div>
          </div>

          <div className={styles.chartPanel}>
            <div className={styles.chartPanelHeader}>
              <h2 className={styles.cardTitle}>共振峰</h2>
              <div className={styles.cardLegend} data-testid="formant-legend" aria-label="图例">
                {LEGEND_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    className={styles.legendItem}
                    data-key={key}
                    data-active={String(formantVisible[key])}
                    onClick={() => toggleFormantVisible(key)}
                  >
                    <i style={{ background: SERIES_COLORS[key] }} />
                    {key.toUpperCase()}
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
      </main>

      <RecordDock
        onRecord={onRecord}
        isCapturing={isCapturing}
        isRequesting={isRequesting}
        goalLabel={goalLabel}
        onGoalClick={scrollToGoal}
      />

      <TipWidget />
    </div>
  )
}
