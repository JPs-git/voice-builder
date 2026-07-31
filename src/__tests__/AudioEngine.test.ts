import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioEngine } from '../ts/AudioEngine'
import { getAudioEngine, resetAudioEngine } from '../ts'

// Mock AudioContext for createPlaybackSource tests
const MockAudioContext = vi.fn(() => ({
  sampleRate: 16000,
  resume: vi.fn(),
  close: vi.fn(),
  createBuffer: vi.fn((_channels: number, length: number, _rate: number) => ({
    getChannelData: vi.fn(() => new Float32Array(length)),
    length,
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createScriptProcessor: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  })),
  destination: {},
}))

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    engine = new AudioEngine({ sampleRate: 16000 })
  })

  afterEach(() => {
    engine.destroy()
    vi.unstubAllGlobals()
  })

  it('initializes with default sample rate', () => {
    expect(engine.sampleRate).toBe(16000)
  })

  it('isCapturing is false initially', () => {
    expect(engine.isCapturing).toBe(false)
  })

  it('startCapture rejects if no getUserMedia (server-side test)', async () => {
    await expect(engine.startCapture(() => {})).rejects.toThrow()
  })

  it('createPlaybackSource returns source and totalDuration', () => {
    const samples = new Float32Array(16000)  // 1 second at 16kHz
    samples.fill(0.5)
    const { source, totalDuration } = engine.createPlaybackSource(samples)
    expect(source).toBeDefined()
    expect(totalDuration).toBe(1)
  })

  it('createPlaybackSource duration scales with sample count', () => {
    const samples = new Float32Array(8000)  // 0.5 seconds
    const { totalDuration } = engine.createPlaybackSource(samples)
    expect(totalDuration).toBe(0.5)
  })
})

describe('AudioEngine singleton', () => {
  afterEach(() => {
    resetAudioEngine()
  })

  it('getAudioEngine returns the same instance', () => {
    const a = getAudioEngine()
    const b = getAudioEngine()
    expect(a).toBe(b)
  })

  it('resetAudioEngine destroys and nullifies instance', () => {
    const a = getAudioEngine()
    resetAudioEngine()
    const b = getAudioEngine()
    expect(a).not.toBe(b)
  })
})
