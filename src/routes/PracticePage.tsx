import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ShellContext } from './AppShell'
import { Piano } from '../components/Piano'
import { PitchChart } from '../components/PitchChart'
import { EmptyState } from '../components/EmptyState'
import { getPianoSynth } from '../audio/PianoSynth'
import { nearestMidi, MIDI_C3, MIDI_C5 } from '../utils/pitch'
import styles from './PracticePage.module.css'

export function PracticePage() {
  const { cursorTime, hasData } = useOutletContext<ShellContext>()
  const latestFrame = useAppStore(s => s.latestFrame)

  useEffect(() => () => getPianoSynth().stopAll(), [])

  const f0 = latestFrame?.f0 ?? null
  let currentMidi: number | null = null
  if (f0 && f0 > 0) {
    const m = nearestMidi(f0)
    if (m >= MIDI_C3 && m <= MIDI_C5) currentMidi = m
  }

  const playNote = (midi: number) => getPianoSynth().play(midi)

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <section className={styles.card}>
          <div className={styles.chartHeader}>
            <h2 className={styles.cardTitle}>钢琴 C3–C5 · 点击听参考音</h2>
          </div>
          <div className={styles.pianoArea}>
            <Piano currentMidi={currentMidi} onKeyPress={playNote} />
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.chartWrapper}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle}>音高谱（科学记谱法）</h2>
            </div>
            <div className={styles.chartArea}>
              <PitchChart cursorTime={cursorTime} />
              <EmptyState
                title="还没有声音数据"
                description="🎤 点击顶栏'开始录音'试试"
                visible={!hasData}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}