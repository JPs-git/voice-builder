import { useDisplayAnalysis } from './useDisplayAnalysis'
import { nearestMidi, MIDI_C2, MIDI_B5 } from '../utils/pitch'

export function useCurrentMidi(minMidi = MIDI_C2, maxMidi = MIDI_B5): number | null {
  const { latestFrame } = useDisplayAnalysis()
  const f0 = latestFrame?.f0 ?? null
  if (!f0 || f0 <= 0) return null
  const midi = nearestMidi(f0)
  return midi >= minMidi && midi <= maxMidi ? midi : null
}
