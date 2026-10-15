import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from './AppShell'
import { Piano } from '../components/Piano'
import { PitchChart } from '../components/PitchChart'
import { EmptyState } from '../components/EmptyState'
import { ContextHelpButton } from '../components/ContextHelpButton'
import { getPianoSynth } from '../audio/PianoSynth'
import { useCurrentMidi } from '../hooks/useCurrentMidi'
import styles from './PracticePage.module.css'

export function PracticeLandscape() {
  const { cursorTime, hasData, onOpenHelp } = useOutletContext<ShellContext>()
  const currentMidi = useCurrentMidi()

  useEffect(() => () => getPianoSynth().stopAll(), [])

  const playNote = (midi: number) => getPianoSynth().play(midi)

  return (
    <div className={styles.page} data-layout="landscape">
      <main className={styles.content}>
        <section className={styles.card}>
          <div className={styles.pianoArea}>
            <Piano currentMidi={currentMidi} onKeyPress={playNote} />
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.chartWrapper}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle}>音高</h2>
              {onOpenHelp && <ContextHelpButton label="音高图说明" onClick={() => onOpenHelp('pitch-reference')} />}
            </div>
            <div className={styles.chartArea}>
              <PitchChart cursorTime={cursorTime} />
              <EmptyState
                title="还没有声音数据"
                description="点击顶栏「开始录音」，或点击琴键听参考音"
                visible={!hasData}
                action={onOpenHelp ? { label: '了解音高参考', onClick: () => onOpenHelp('pitch-reference') } : undefined}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
