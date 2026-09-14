import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PianoSynth, getPianoSynth } from '../audio/PianoSynth'
import { midiToFreq } from '../utils/pitch'

const createdOscs: any[] = []
const createdGains: any[] = []
const createdCtxs: any[] = []

function mockAudioContext() {
  createdOscs.length = 0
  createdGains.length = 0
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
  const gain = () => {
    const g: any = {
      gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
    createdGains.push(g)
    return g
  }
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

  it('rebuilds the AudioContext when the browser closed it', () => {
    const synth = new PianoSynth()
    synth.play(60)
    const closedCtx = createdCtxs[0]
    closedCtx.state = 'closed'
    synth.play(72)
    const rebuiltCtx = createdCtxs[0]
    expect(rebuiltCtx).not.toBe(closedCtx)
    expect(rebuiltCtx.createOscillator).toHaveBeenCalledTimes(3)
    expect(closedCtx.createOscillator).toHaveBeenCalledTimes(3)
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

  it('disconnects the entry gain after all 3 oscillators end', () => {
    const synth = new PianoSynth()
    synth.play(60)
    const masterGain = createdGains[0]
    for (let i = 0; i < 3; i++) createdOscs[i].onended()
    expect(masterGain.disconnect).toHaveBeenCalledTimes(1)
  })

  it('releases overlapping same-note plays independently', () => {
    const synth = new PianoSynth()
    synth.play(60) // master = createdGains[0], oscs 0-2
    synth.play(60) // master = createdGains[4], oscs 3-5
    // end first note's oscs -> only its own master is disconnected
    for (let i = 0; i < 3; i++) createdOscs[i].onended()
    expect(createdGains[0].disconnect).toHaveBeenCalledTimes(1)
    expect(createdGains[4].disconnect).not.toHaveBeenCalled()
    // end second note's oscs -> its master is disconnected too
    for (let i = 3; i < 6; i++) createdOscs[i].onended()
    expect(createdGains[4].disconnect).toHaveBeenCalledTimes(1)
  })

  it('stopAll stops all oscs, disconnects gains, and closes the context', () => {
    const synth = new PianoSynth()
    synth.play(60)
    synth.play(64)
    synth.stopAll()
    expect(createdOscs.length).toBe(6)
    for (let i = 0; i < 6; i++) expect(createdOscs[i].stop).toHaveBeenCalled()
    expect(createdGains[0].disconnect).toHaveBeenCalled()
    expect(createdGains[4].disconnect).toHaveBeenCalled()
    expect(createdCtxs[0].close).toHaveBeenCalled()
  })
})