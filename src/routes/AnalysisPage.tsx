import { useState } from 'react'
import { useToolbar } from '../hooks/useToolbar'
import { Toolbar } from '../components/Toolbar'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { TipWidget } from '../components/TipWidget'
import styles from './AnalysisPage.module.css'

export function AnalysisPage() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

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
        <TargetPresetBar />

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
                  <button className={styles.legendItem} data-key="f0" data-active="true"><i style={{ background: '#1F2937' }}></i>F0</button>
                  <button className={styles.legendItem} data-key="f1" data-active="true"><i style={{ background: '#E23E57' }}></i>F1</button>
                  <button className={styles.legendItem} data-key="f2" data-active="true"><i style={{ background: '#3B82F6' }}></i>F2</button>
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

      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <input ref={fileInputRef} type="file" accept=".wav" hidden onChange={handleFileChange} />
    </div>
  )
}
