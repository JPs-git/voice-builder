import { useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from './AppShell'
import { Piano } from '../components/Piano'
import { PitchChart } from '../components/PitchChart'
import { EmptyState } from '../components/EmptyState'
import { getPianoSynth } from '../audio/PianoSynth'
import { useCurrentMidi } from '../hooks/useCurrentMidi'
import { MIDI_C2, MIDI_C6 } from '../utils/pitch'
import styles from './PracticePage.module.css'

const BLACK_KEY_LABEL_CLEARANCE_PX = 20

export function PracticePortrait() {
  const { cursorTime, hasData, pianoScrollProgress = 0, setPianoScrollProgress } = useOutletContext<ShellContext>()
  const pianoViewportRef = useRef<HTMLDivElement>(null)
  const currentMidi = useCurrentMidi(MIDI_C2, MIDI_C6)

  useEffect(() => () => getPianoSynth().stopAll(), [])

  const playNote = (midi: number) => getPianoSynth().play(midi)
  useEffect(() => {
    const viewport = pianoViewportRef.current
    if (!viewport) return
    viewport.scrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth) * pianoScrollProgress
  }, [pianoScrollProgress])

  const rememberPianoPosition = () => {
    const viewport = pianoViewportRef.current
    if (!viewport) return
    const maxScroll = viewport.scrollWidth - viewport.clientWidth
    setPianoScrollProgress?.(maxScroll > 0 ? viewport.scrollLeft / maxScroll : 0)
  }

  return (
    <div className={styles.page} data-layout="portrait">
      <main className={`${styles.content} ${styles.portraitContent}`}>
        <section className={`${styles.card} ${styles.portraitPianoCard}`}>
          <header className={styles.pianoHeader}>
            <h2 className={styles.pianoTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 3v11m3-11v11m4-11v11m3-11v11M7 14h10" />
              </svg>
              钢琴键盘
            </h2>
          </header>
          <div
            ref={pianoViewportRef}
            className={styles.pianoViewport}
            role="region"
            aria-label="左右滑动调整钢琴音域"
            tabIndex={0}
            onScroll={rememberPianoPosition}
          >
            <div className={styles.pianoArea} style={{ paddingTop: BLACK_KEY_LABEL_CLEARANCE_PX }}>
              <Piano
                currentMidi={currentMidi}
                onKeyPress={playNote}
                startMidi={MIDI_C2}
                endMidi={MIDI_C6}
                deferKeyPress
              />
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.portraitPitchCard}`}>
          <div className={`${styles.chartWrapper} ${styles.portraitChartWrapper}`}>
            <div className={styles.pitchChartHeader}>
              <h2 className={styles.pianoTitle}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 13v-2m4 6V7m5 12V5m5 10V9m4 4v-2" />
                </svg>
                音高图
              </h2>
            </div>
            <div className={styles.chartArea}>
              <PitchChart cursorTime={cursorTime} layout="portrait" />
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
    </div>
  )
}
