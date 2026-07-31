import { describe, it, expect } from 'vitest'
import { FrameProcessor } from '../../dsp/frame-processor'

describe('FrameProcessor', () => {
  it('extracts frames with correct hop', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const input = new Float32Array(800)
    input.fill(0.1)
    const frames = fp.push(input)
    // 800 samples with frameSize 400 and hopSize 160:
    // frame 0: samples 0-399, frame 1: 160-559, frame 2: 320-719
    // frame 3 would need 480-879 but only 800 available (offset=480, needs 400, 480+400=880 > 800)
    expect(frames.length).toBe(3)
    expect(frames[0].sampleRate).toBe(16000)
  })

  it('accumulates across multiple push() calls', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    fp.push(new Float32Array(300))
    const frames = fp.push(new Float32Array(300))
    // 600 total, frame 0 at 0-399, no more
    expect(frames.length).toBeGreaterThanOrEqual(1)
  })

  it('handles empty input', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    expect(fp.push(new Float32Array(0)).length).toBe(0)
  })
})
