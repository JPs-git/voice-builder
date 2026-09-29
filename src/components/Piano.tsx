import styles from './Piano.module.css'
import { MIDI_C2, MIDI_B5, midiToName } from '../utils/pitch'

const BLACK_MIDI_RESIDUES = new Set([1, 3, 6, 8, 10])

function isWhite(midi: number): boolean {
  return !BLACK_MIDI_RESIDUES.has(midi % 12)
}

function getWhiteNotes(startMidi: number, endMidi: number): number[] {
  const out: number[] = []
  for (let m = startMidi; m <= endMidi; m++) {
    if (isWhite(m)) out.push(m)
  }
  return out
}

function hasBlackAfter(white: number, endMidi: number): boolean {
  return white + 1 <= endMidi && BLACK_MIDI_RESIDUES.has((white + 1) % 12)
}

interface PianoProps {
  currentMidi?: number | null
  onKeyPress: (midi: number) => void
  startMidi?: number
  endMidi?: number
  deferKeyPress?: boolean
}

export function Piano({ currentMidi = null, onKeyPress, startMidi = MIDI_C2, endMidi = MIDI_B5, deferKeyPress = false }: PianoProps) {
  const whiteNotes = getWhiteNotes(startMidi, endMidi)
  return (
    <div className={styles.piano} role="group" aria-label={`钢琴 ${midiToName(startMidi)}-${midiToName(endMidi)}`}>
      {whiteNotes.map(white => (
        <div key={white} className={styles.whiteWrap}>
          <button
            type="button"
            className={styles.white}
            data-active={currentMidi === white}
            aria-label={midiToName(white)}
            aria-pressed={currentMidi === white}
            {...(deferKeyPress ? { onClick: () => onKeyPress(white) } : { onPointerDown: () => onKeyPress(white) })}
          >
            <span
              className={styles.noteLabel}
              data-octave-marker={white % 12 === 0 ? 'true' : 'false'}
              data-active={currentMidi === white ? 'true' : 'false'}
            >
              {midiToName(white)}
            </span>
          </button>
          {hasBlackAfter(white, endMidi) && (
            <button
              type="button"
              className={styles.black}
              data-active={currentMidi === white + 1}
              aria-label={midiToName(white + 1)}
              aria-pressed={currentMidi === white + 1}
              {...(deferKeyPress ? { onClick: () => onKeyPress(white + 1) } : { onPointerDown: () => onKeyPress(white + 1) })}
            >
              <span className={styles.noteLabel} data-octave-marker="false" data-active={currentMidi === white + 1 ? 'true' : 'false'}>
                {midiToName(white + 1)}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
