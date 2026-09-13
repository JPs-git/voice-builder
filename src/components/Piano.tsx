import styles from './Piano.module.css'
import { MIDI_C3, MIDI_C5, midiToName } from '../utils/pitch'

const BLACK_MIDI_RESIDUES = new Set([1, 3, 6, 8, 10])

function isWhite(midi: number): boolean {
  return !BLACK_MIDI_RESIDUES.has(midi % 12)
}

const WHITE_NOTES: number[] = (() => {
  const out: number[] = []
  for (let m = MIDI_C3; m <= MIDI_C5; m++) {
    if (isWhite(m)) out.push(m)
  }
  return out
})()

function hasBlackAfter(white: number): boolean {
  return white + 1 <= MIDI_C5 && BLACK_MIDI_RESIDUES.has((white + 1) % 12)
}

interface PianoProps {
  currentMidi?: number | null
  onKeyPress: (midi: number) => void
}

export function Piano({ currentMidi = null, onKeyPress }: PianoProps) {
  return (
    <div className={styles.piano} role="group" aria-label="钢琴 C3-C5">
      {WHITE_NOTES.map(white => (
        <div key={white} className={styles.whiteWrap}>
          <button
            type="button"
            className={styles.white}
            data-active={currentMidi === white}
            aria-label={midiToName(white)}
            aria-pressed={currentMidi === white}
            onClick={() => onKeyPress(white)}
          >
            {white % 12 === 0 && <span className={styles.noteLabel}>{midiToName(white)}</span>}
          </button>
          {hasBlackAfter(white) && (
            <button
              type="button"
              className={styles.black}
              data-active={currentMidi === white + 1}
              aria-label={midiToName(white + 1)}
              aria-pressed={currentMidi === white + 1}
              onClick={() => onKeyPress(white + 1)}
            />
          )}
        </div>
      ))}
    </div>
  )
}