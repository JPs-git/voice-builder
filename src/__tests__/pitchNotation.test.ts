import { describe, it, expect } from 'vitest'
import {
  SEMITONE_NAMES,
  midiToFreq,
  freqToMidi,
  nearestMidi,
  midiToName,
  centsOffset,
  isNaturalMidi,
  MIDI_C2,
  MIDI_C3,
  MIDI_C5,
  MIDI_C6,
} from '../utils/pitch'

describe('pitch notation utils', () => {
  it('exposes the 12 semitone names', () => {
    expect(SEMITONE_NAMES).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])
  })

  it('converts midi to frequency (A4 = 440, C4 ~ 261.63)', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6)
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1)
    expect(midiToFreq(48)).toBeCloseTo(130.81, 1)
  })

  it('converts frequency to continuous midi', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6)
    expect(freqToMidi(261.63)).toBeCloseTo(60, 3)
  })

  it('rounds to nearest midi note', () => {
    expect(nearestMidi(440)).toBe(69)
    expect(nearestMidi(262)).toBe(60)
    expect(nearestMidi(466.16)).toBe(70)
  })

  it('formats scientific pitch notation', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToName(61)).toBe('C#4')
    expect(midiToName(72)).toBe('C5')
    expect(midiToName(48)).toBe('C3')
    expect(midiToName(57)).toBe('A3')
    expect(midiToName(69)).toBe('A4')
  })

  it('computes cents offset to a reference note', () => {
    expect(centsOffset(440, 69)).toBeCloseTo(0, 6)
    expect(centsOffset(261.63, 60)).toBeCloseTo(0, 1)
    expect(centsOffset(264, 60)).toBeGreaterThan(0)
    expect(centsOffset(261.63, 69)).toBeLessThan(0)
  })

  it('identifies natural (non-accidental) midi notes', () => {
    expect(isNaturalMidi(36)).toBe(true)  // C2
    expect(isNaturalMidi(37)).toBe(false) // C#2
    expect(isNaturalMidi(48)).toBe(true)  // C3
    expect(isNaturalMidi(60)).toBe(true)  // C4
    expect(isNaturalMidi(61)).toBe(false) // C#4
    expect(isNaturalMidi(69)).toBe(true)  // A4
    expect(isNaturalMidi(84)).toBe(true)  // C6
  })

  it('provides chart boundary constants', () => {
    expect(MIDI_C2).toBe(36)
    expect(MIDI_C3).toBe(48)
    expect(MIDI_C5).toBe(72)
    expect(MIDI_C6).toBe(84)
  })
})