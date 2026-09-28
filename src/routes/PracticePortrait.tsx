import { useCallback, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from './AppShell'
import { useAppStore } from '../store/appStore'
import { Piano } from '../components/Piano'
import { PitchChart } from '../components/PitchChart'
import { EmptyState } from '../components/EmptyState'
import { RecordDock } from '../components/mobile/RecordDock'
import { getPianoSynth } from '../audio/PianoSynth'
import { useCurrentMidi } from '../hooks/useCurrentMidi'
import { presetShortLabel } from '../types'
import styles from './PracticePage.module.css'

export function PracticePortrait() {
  const { cursorTime, hasData, isCapturing, isRequesting, onRecord, onClear, onPlayback, isPlaying } =
    useOutletContext<ShellContext>()
  const currentMidi = useCurrentMidi()
  const activePreset = useAppStore(s => s.activePreset)

  useEffect(() => () => getPianoSynth().stopAll(), [])

  const playNote = (midi: number) => getPianoSynth().play(midi)

  const topRef = useRef<HTMLDivElement>(null)
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const goalLabel = presetShortLabel(activePreset)

  return (
    <div ref={topRef} className={styles.page} data-layout="portrait">
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
            </div>
            <div className={styles.chartArea}>
              <PitchChart cursorTime={cursorTime} />
              <EmptyState
                title="还没有声音数据"
                description="点击下方开始录音"
                visible={!hasData}
                icon="🎙"
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
        onGoalClick={scrollToTop}
        onClear={onClear}
        onPlayback={onPlayback}
        hasData={hasData}
        isPlaying={isPlaying}
      />
    </div>
  )
}
