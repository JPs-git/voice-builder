import { useCallback, useRef } from 'react'
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
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

export function AnalysisPortrait() {
  const { cursorTime, hasData, isCapturing, isRequesting, onRecord } =
    useOutletContext<ShellContext>()

  const formantVisible = useAppStore(s => s.formantVisible)
  const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)
  const activePreset = useAppStore(s => s.activePreset)

  const goalRef = useRef<HTMLDivElement>(null)
  const scrollToGoal = useCallback(() => {
    goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

        <nav className={styles.portraitTabs} aria-label="图表导航">
          <button
            type="button"
            className={styles.portraitTab}
            onClick={() => document.getElementById('f0Chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            基频
          </button>
          <span className={styles.portraitTabDivider} aria-hidden="true">|</span>
          <button
            type="button"
            className={styles.portraitTab}
            onClick={() => document.getElementById('formantChart')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            共振峰
          </button>
        </nav>

        <section className={`${styles.card} ${styles.portraitCard}`}>
          <div className={styles.chartWrapper}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle}>基频</h2>
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
        </section>

        <section className={`${styles.card} ${styles.portraitCard}`}>
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
                  <i style={{ background: SERIES_COLORS[key] }}></i>
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
