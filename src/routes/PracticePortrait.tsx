import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from './AppShell'
import { Piano } from '../components/Piano'
import { PitchChart } from '../components/PitchChart'
import { EmptyState } from '../components/EmptyState'
import { FeedbackHero } from '../components/mobile/FeedbackHero'
import { getPianoSynth } from '../audio/PianoSynth'
import { useCurrentMidi } from '../hooks/useCurrentMidi'
import { MIDI_C2, MIDI_C3, MIDI_C4, MIDI_C6 } from '../utils/pitch'
import styles from './PracticePage.module.css'

const PIANO_RANGE_STARTS = [MIDI_C2, MIDI_C3, MIDI_C4] as const
const PIANO_RANGE_SEMITONES = 24

export function PracticePortrait() {
  const { cursorTime, hasData, pianoRangeStart, setPianoRangeStart } = useOutletContext<ShellContext>()
  const rangeStart = pianoRangeStart ?? MIDI_C2
  const currentMidi = useCurrentMidi(MIDI_C2, MIDI_C6)

  useEffect(() => () => getPianoSynth().stopAll(), [])

  const playNote = (midi: number) => getPianoSynth().play(midi)
  const rangeEnd = rangeStart + PIANO_RANGE_SEMITONES
  const rangeIndex = PIANO_RANGE_STARTS.indexOf(rangeStart as typeof PIANO_RANGE_STARTS[number])

  return (
    <div className={styles.page} data-layout="portrait">
      <main className={`${styles.content} ${styles.portraitContent}`}>
        <FeedbackHero />

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
          <div className={styles.pianoViewport}>
            <button
              type="button"
              className={`${styles.rangeArrow} ${styles.rangeArrowLeft}`}
              aria-label="向左翻页一个八度"
              disabled={rangeIndex <= 0}
              onClick={() => setPianoRangeStart?.(PIANO_RANGE_STARTS[Math.max(0, rangeIndex - 1)])}
            >
              ‹
            </button>
            <div className={styles.pianoArea}>
              <Piano
                currentMidi={currentMidi}
                onKeyPress={playNote}
                startMidi={rangeStart}
                endMidi={rangeEnd}
              />
            </div>
            <button
              type="button"
              className={`${styles.rangeArrow} ${styles.rangeArrowRight}`}
              aria-label="向右翻页一个八度"
              disabled={rangeIndex >= PIANO_RANGE_STARTS.length - 1}
              onClick={() => setPianoRangeStart?.(PIANO_RANGE_STARTS[Math.min(PIANO_RANGE_STARTS.length - 1, rangeIndex + 1)])}
            >
              ›
            </button>
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
