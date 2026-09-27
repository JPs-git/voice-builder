import { useAppStore } from '../store/appStore'
import { nearestMidi, MIDI_C2, MIDI_B5 } from '../utils/pitch'

export function useCurrentMidi(): number | null {
  const f0 = useAppStore(s => s.latestFrame?.f0 ?? null)
  if (!f0 || f0 <= 0) return null
  const midi = nearestMidi(f0)
  return midi >= MIDI_C2 && midi <= MIDI_B5 ? midi : null
}