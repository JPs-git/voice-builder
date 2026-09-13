import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PianoSynth, getPianoSynth } from '../audio/PianoSynth'
import { midiToFreq } from '../utils/pitch'

const createdOscs: any[] = []
const createdCtxs: any[] = []

function mockAudioContext() {
  createdOscs.length = 0
  createdCtxs.length = 0
  const osc = () => {
    const o: any = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }
    createdOscs.push(o)
    return o
  }
  const gain = () => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
  const ctx: any = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(osc),
    createGain: vi.fn(gain),
  }
  createdCtxs.push(ctx)
  return ctx
}

let origAudioContext: typeof globalThis.AudioContext

describe('PianoSynth', () => {
  beforeAll(() => {
    origAudioContext = globalThis.AudioContext
    globalThis.AudioContext = mockAudioContext as unknown as typeof AudioContext
  })

  afterAll(() => {
    globalThis.AudioContext = origAudioContext
  })

  it('creates 3 oscillators at 1x/2x/3x the note frequency', () => {
    const synth = new PianoSynth()
    synth.play(60)
    expect(createdOscs).toHaveLength(3)
    expect(createdOscs[0].frequency.value).toBeCloseTo(midiToFreq(60), 1)
    expect(createdOscs[1].frequency.value).toBeCloseTo(midiToFreq(60) * 2, 1)
    expect(createdOscs[2].frequency.value).toBeCloseTo(midiToFreq(60) * 3, 1)
  })

  it('resumes a suspended AudioContext on play', () => {
    const synth = new PianoSynth()
    synth.play(72)
    expect(createdCtxs[0].resume).toHaveBeenCalled()
  })

  it('stopAll() closes the AudioContext', () => {
    const synth = new PianoSynth()
    synth.play(60)
    synth.stopAll()
    expect(createdCtxs[0].close).toHaveBeenCalled()
  })

  it('returns the same singleton instance', () => {
    expect(getPianoSynth()).toBe(getPianoSynth())
  })
})