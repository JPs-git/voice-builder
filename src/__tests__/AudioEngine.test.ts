import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AudioEngine } from '../ts/AudioEngine'

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    engine = new AudioEngine({ sampleRate: 16000, maxDurationSec: 10 })
  })

  afterEach(() => {
    engine.destroy()
  })

  it('initializes with default sample rate', () => {
    expect(engine.sampleRate).toBe(16000)
  })

  it('importBuffer stores samples truncated to maxDuration', () => {
    const samples = new Float32Array(160000)
    samples.fill(0.5)
    engine.importBuffer(samples)
    expect(engine.getBuffer().length).toBe(160000)
  })

  it('importBuffer truncates samples longer than maxDuration', () => {
    const samples = new Float32Array(200000)
    samples.fill(0.5)
    engine.importBuffer(samples)
    expect(engine.getBuffer().length).toBe(160000)
  })

  it('importBuffer replaces previous buffer content', () => {
    engine.importBuffer(new Float32Array(100).fill(0.1))
    expect(engine.getBuffer().length).toBe(100)
    engine.importBuffer(new Float32Array(200).fill(0.2))
    expect(engine.getBuffer().length).toBe(200)
  })

  it('clear empties the buffer', () => {
    engine.importBuffer(new Float32Array(100).fill(0.5))
    engine.clear()
    expect(engine.getBuffer().length).toBe(0)
  })

  it('isStreaming is false initially', () => {
    expect(engine.isStreaming).toBe(false)
  })

  it('getBuffer returns a copy', () => {
    engine.importBuffer(new Float32Array([1, 2, 3]))
    const a = engine.getBuffer()
    const b = engine.getBuffer()
    a[0] = 99
    expect(b[0]).toBe(1)
  })

  it('startStream rejects if no getUserMedia (server-side test)', async () => {
    await expect(engine.startStream(() => {})).rejects.toThrow()
  })
})
