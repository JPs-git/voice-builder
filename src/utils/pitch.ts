export const SEMITONE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const A4_MIDI = 69
export const A4_FREQ = 440

export const MIDI_C2 = 36
export const MIDI_C3 = 48
export const MIDI_C4 = 60
export const MIDI_C5 = 72
export const MIDI_B5 = 83
export const MIDI_C6 = 84

export function midiToFreq(midi: number): number {
  return A4_FREQ * 2 ** ((midi - A4_MIDI) / 12)
}

export function freqToMidi(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ)
}

export function nearestMidi(freq: number): number {
  return Math.round(freqToMidi(freq))
}

export function midiToName(midi: number): string {
  const m = Math.round(midi)
  const name = SEMITONE_NAMES[((m % 12) + 12) % 12]
  const octave = Math.floor(m / 12) - 1
  return `${name}${octave}`
}

export function isNaturalMidi(midi: number): boolean {
  const residue = ((Math.round(midi) % 12) + 12) % 12
  return residue === 0 || residue === 2 || residue === 4 || residue === 5 || residue === 7 || residue === 9 || residue === 11
}

export function centsOffset(freq: number, refMidi: number): number {
  return 1200 * Math.log2(freq / midiToFreq(refMidi))
}