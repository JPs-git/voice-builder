import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ShellContext } from './AppShell'
import { FeedbackHero } from '../components/mobile/FeedbackHero'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import type { FormantSeries } from '../types'
import styles from './AnalysisPage.module.css'

const LEGEND_KEYS = ['f0', 'f1', 'f2'] as const

const SERIES_COLORS: Record<FormantSeries, string> = {
  f0: '#12B886',
  f1: '#F04B6A',
  f2: '#3F83F8',
}

export function AnalysisPortrait() {
  const { cursorTime, hasData } = useOutletContext<ShellContext>()

  const formantVisible = useAppStore(s => s.formantVisible)
  const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)
  return (
    <div className={styles.page} data-layout="portrait">
      <main className={`${styles.content} ${styles.portraitMain}`}>
        <div data-testid="feedback-hero" className={styles.portraitSlot}>
          <FeedbackHero />
        </div>

        <div className={styles.chartStack}>
          <section className={`${styles.card} ${styles.chartPanel}`}>
            <div className={styles.chartPanelHeader}>
              <h2 className={styles.cardTitle}><svg className={styles.chartGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 12v1m4-5v9m5-15v20m5-14v9m4-5v1" /></svg> 基频 <span className={styles.f0Suffix}>F0</span></h2>
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
                description="点击下方开始录音"
                visible={!hasData}
                icon="🎙"
              />
            </div>
          </section>

          <section className={`${styles.card} ${styles.chartPanel}`}>
            <div className={styles.chartPanelHeader}>
              <h2 className={styles.cardTitle}><svg className={styles.chartGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 15v6M9 7v14M15 2v19M21 10v11" /></svg> 共振峰</h2>
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
                icon="🎙"
              />
            </div>
          </section>
        </div>
      </main>

    </div>
  )
}
