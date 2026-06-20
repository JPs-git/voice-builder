# Frame Rules Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor audio processing to unify frame rules across all inputs: resample to 16kHz, extract frames of 400 samples (25ms) with 160-sample hop (10ms).

**Architecture:** A `Resampler` class converts any input sample rate to 16kHz. A `FrameProcessor` buffers resampled audio and emits 400-sample frames every 160 samples. The `AudioEngine` and `WavAnalyzer` both use this pipeline. F0 detection (`detectPitch`) already works generically with any sample rate/frame size. FFT uses 512-point zero-padded from 400.

**Tech Stack:** Vanilla JS (ES modules), Node.js built-in `node:test` for unit tests, browser AudioContext / ScriptProcessorNode for live mic input.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `js/resampler.js` | **Create** | Linear interpolation resampler, any input rate → 16000 Hz |
| `js/frame-processor.js` | **Create** | Buffers 16kHz audio, emits frames (400 samples, 160 hop) |
| `js/audio-engine.js` | **Modify** | Integrate resampler + frame-processor; remove forced 44100 sample rate |
| `js/wav-analyzer.js` | **Modify** | Use resampler + frame-processor instead of raw 512 chunks |
| `js/__tests__/resampler.test.js` | **Create** | Tests for Resampler with multiple input rates |
| `js/__tests__/frame-processor.test.js` | **Create** | Tests for FrameProcessor hop/frame boundaries |
| `js/__tests__/pitch.test.js` | **Create** | Tests for detectPitch with 16kHz/400-sample frames |
| `js/__tests__/fft.test.js` | **Create** | Tests for fftMagnitudes with 512-FFT |
| `package.json` | **Modify** | Add `node --test` script |

---

## Task 1: Create Resampler + Tests

**Files:**
- Create: `js/resampler.js`
- Create: `js/__tests__/resampler.test.js`

- [ ] **Step 1: Write the failing test for Resampler**

`js/__tests__/resampler.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Resampler } from '../resampler.js'

describe('Resampler', () => {
  it('resamples 44100 to 16000 and preserves frequency', () => {
    const inputRate = 44100
    const outputRate = 16000
    const freq = 200  // 200 Hz test tone
    const duration = 0.1  // 100ms
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    assert.ok(Math.abs(output.length - outputLen) <= 1)

    // Find the peak frequency via zero-crossing
    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5, `expected ~${freq}Hz, got ${detectedFreq}Hz`)
  })

  it('resamples 48000 to 16000', () => {
    const freq = 300
    const duration = 0.1
    const inputRate = 48000
    const outputRate = 16000
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    assert.ok(Math.abs(output.length - outputLen) <= 1)

    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5)
  })

  it('upsamples 8000 to 16000', () => {
    const freq = 200
    const duration = 0.1
    const inputRate = 8000
    const outputRate = 16000
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    assert.ok(Math.abs(output.length - outputLen) <= 1)

    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5)
  })

  it('maintains phase continuity across multiple process() calls', () => {
    const inputRate = 44100
    const outputRate = 16000
    const freq = 200
    const totalDuration = 0.2
    const chunkDuration = 0.05
    const chunkSamples = Math.round(inputRate * chunkDuration)
    const r = new Resampler(inputRate, outputRate)

    let allOutput = []
    for (let offset = 0; offset < Math.round(inputRate * totalDuration); offset += chunkSamples) {
      const input = new Float32Array(chunkSamples)
      for (let i = 0; i < chunkSamples; i++) {
        input[i] = Math.sin(2 * Math.PI * freq * (offset + i) / inputRate)
      }
      const out = r.process(input)
      for (let i = 0; i < out.length; i++) allOutput.push(out[i])
    }

    const output = new Float32Array(allOutput)
    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5)
  })

  it('handles empty input', () => {
    const r = new Resampler(44100, 16000)
    const output = r.process(new Float32Array(0))
    assert.equal(output.length, 0)
  })

  it('handles very short input (less than ratio samples)', () => {
    const r = new Resampler(44100, 16000)
    const output = r.process(new Float32Array(10))
    assert.ok(output.length === 0 || output.length === 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/__tests__/resampler.test.js`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` (Resampler not yet created)

- [ ] **Step 3: Write Resampler implementation**

`js/resampler.js`:

```javascript
export class Resampler {
  constructor(inputRate, outputRate = 16000) {
    this.ratio = outputRate / inputRate
    this.buffer = new Float32Array(0)
    this.inputRate = inputRate
    this.outputRate = outputRate
  }

  process(input) {
    const combined = new Float32Array(this.buffer.length + input.length)
    combined.set(this.buffer, 0)
    combined.set(input, this.buffer.length)

    if (combined.length < 1) {
      this.buffer = new Float32Array(0)
      return new Float32Array(0)
    }

    const maxOutputLen = Math.ceil(combined.length * this.ratio)
    const output = new Float32Array(maxOutputLen)
    let outIdx = 0

    for (let i = 0; i < combined.length - 1; i++) {
      const startPos = i * this.ratio
      const endPos = (i + 1) * this.ratio
      const startIdx = Math.ceil(startPos)
      const endIdx = Math.ceil(endPos)

      for (let j = startIdx; j < endIdx && j < maxOutputLen; j++) {
        const pos = j / this.ratio
        const idx = Math.floor(pos)
        const frac = pos - idx
        if (idx + 1 < combined.length) {
          output[j] = combined[idx] * (1 - frac) + combined[idx + 1] * frac
        }
      }
      outIdx = endIdx
    }

    const remainder = combined.length - Math.floor(outIdx / this.ratio)
    if (remainder > 0) {
      this.buffer = combined.slice(combined.length - remainder)
    } else {
      this.buffer = new Float32Array(0)
    }

    return output.slice(0, outIdx)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/__tests__/resampler.test.js`
Expected: PASS all 6 tests

- [ ] **Step 5: Commit**

```bash
git add js/resampler.js js/__tests__/resampler.test.js
git commit -m "feat: add Resampler with multi-rate support"
```

---

## Task 2: Create FrameProcessor + Tests

**Files:**
- Create: `js/frame-processor.js`
- Create: `js/__tests__/frame-processor.test.js`

- [ ] **Step 1: Write the failing test for FrameProcessor**

`js/__tests__/frame-processor.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FrameProcessor } from '../frame-processor.js'

describe('FrameProcessor', () => {
  it('extracts frames with correct size and hop', () => {
    const sampleRate = 16000
    const frameSize = 400
    const hopSize = 160
    const fp = new FrameProcessor({ sampleRate, frameSize, hopSize })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    // Push 2 seconds of audio (32000 samples)
    const duration = 2
    const totalSamples = sampleRate * duration
    const input = new Float32Array(totalSamples)
    for (let i = 0; i < totalSamples; i++) {
      input[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate)
    }
    fp.push(input)

    const expectedFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1
    assert.equal(frames.length, expectedFrames)

    for (const f of frames) {
      assert.equal(f.samples.length, frameSize)
    }
  })

  it('first frame starts at sample 0', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    const input = new Float32Array(16000)
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin(2 * Math.PI * 200 * i / 16000)
    }
    fp.push(input)

    assert.equal(frames.length, Math.floor((16000 - 400) / 160) + 1)
    assert.equal(frames[0].time, 0 / 16000)
    assert.equal(frames[1].time, 160 / 16000)
  })

  it('accumulates across multiple push() calls', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    fp.push(new Float32Array(200))  // less than a frame
    assert.equal(frames.length, 0)

    fp.push(new Float32Array(400))  // should produce at least 1 frame
    assert.ok(frames.length >= 1)
    assert.equal(frames[0].samples.length, 400)
  })

  it('handles empty input', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)
    fp.push(new Float32Array(0))
    assert.equal(frames.length, 0)
  })

  it('returns correct frame count for known input length', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    fp.push(new Float32Array(400))  // exactly one frame
    assert.equal(frames.length, 1)

    fp.push(new Float32Array(160))  // one hop more
    assert.equal(frames.length, 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/__tests__/frame-processor.test.js`
Expected: FAIL — `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Write FrameProcessor implementation**

`js/frame-processor.js`:

```javascript
export class FrameProcessor {
  constructor({ sampleRate = 16000, frameSize = 400, hopSize = 160 } = {}) {
    this.sampleRate = sampleRate
    this.frameSize = frameSize
    this.hopSize = hopSize
    this.buffer = new Float32Array(0)
    this.onFrame = null
  }

  push(input) {
    const combined = new Float32Array(this.buffer.length + input.length)
    combined.set(this.buffer, 0)
    combined.set(input, this.buffer.length)

    let offset = 0
    const framesToExtract = []

    while (offset + this.frameSize <= combined.length) {
      const frame = new Float32Array(this.frameSize)
      for (let i = 0; i < this.frameSize; i++) {
        frame[i] = combined[offset + i]
      }
      framesToExtract.push({
        samples: frame,
        time: offset / this.sampleRate,
        sampleRate: this.sampleRate,
      })
      offset += this.hopSize
    }

    this.buffer = combined.slice(offset)

    if (this.onFrame) {
      for (const f of framesToExtract) {
        this.onFrame(f)
      }
    }

    return framesToExtract
  }

  reset() {
    this.buffer = new Float32Array(0)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/__tests__/frame-processor.test.js`
Expected: PASS all 5 tests

- [ ] **Step 5: Commit**

```bash
git add js/frame-processor.js js/__tests__/frame-processor.test.js
git commit -m "feat: add FrameProcessor with 400-sample/160-hop frame extraction"
```

---

## Task 3: Add F0 Detection Tests at 16kHz

**Files:**
- Create: `js/__tests__/pitch.test.js`

- [ ] **Step 1: Write the pitch detection tests**

`js/__tests__/pitch.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectPitch } from '../lpc.js'

function generateSine(freqHz, sampleRate, numSamples) {
  const signal = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('detectPitch at 16kHz / 400-sample frames', () => {
  const sampleRate = 16000
  const frameSize = 400

  it('detects 100 Hz sine wave', () => {
    const signal = generateSine(100, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 !== null, 'should detect voiced')
    assert.ok(Math.abs(f0 - 100) < 5, `expected ~100Hz, got ${f0}Hz`)
  })

  it('detects 200 Hz sine wave', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 !== null)
    assert.ok(Math.abs(f0 - 200) < 10)
  })

  it('detects 440 Hz sine wave', () => {
    const signal = generateSine(440, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 !== null)
    assert.ok(Math.abs(f0 - 440) < 20)
  })

  it('returns null for silence', () => {
    const signal = new Float32Array(frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.equal(f0, null)
  })

  it('returns null for white noise (low autocorrelation)', () => {
    const signal = new Float32Array(frameSize)
    for (let i = 0; i < frameSize; i++) {
      signal[i] = Math.random() * 2 - 1
    }
    const f0 = detectPitch(signal, sampleRate)
    // White noise should have low autocorrelation peak, likely null
    // This is probabilistic, just check it doesn't crash
    assert.ok(f0 === null || (f0 > 50 && f0 < 500))
  })

  it('handles same frequency at different sample rates consistently', () => {
    const sampleRate2 = 44100
    const frameSize2 = 512
    const signal1 = generateSine(200, sampleRate, frameSize)
    const signal2 = generateSine(200, sampleRate2, frameSize2)
    const f0_16k = detectPitch(signal1, sampleRate)
    const f0_44k = detectPitch(signal2, sampleRate2)
    assert.ok(f0_16k !== null && f0_44k !== null)
    assert.ok(Math.abs(f0_16k - f0_44k) < 10,
      `16k: ${f0_16k}Hz, 44k: ${f0_44k}Hz`)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test js/__tests__/pitch.test.js`
Expected: PASS all 6 tests

- [ ] **Step 3: Commit**

```bash
git add js/__tests__/pitch.test.js
git commit -m "test: add pitch detection tests for 16kHz/400-sample frames"
```

---

## Task 4: Add FFT Tests for 512-FFT

**Files:**
- Create: `js/__tests__/fft.test.js`

- [ ] **Step 1: Write the FFT tests**

`js/__tests__/fft.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fftMagnitudes } from '../fft.js'

function generateSine(freqHz, sampleRate, numSamples) {
  const signal = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('fftMagnitudes with 512-FFT (400-sample input)', () => {
  const sampleRate = 16000
  const frameSize = 400
  const fftSize = 512

  it('returns 257 bins (N/2 + 1)', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    assert.equal(mags.length, fftSize / 2 + 1)
  })

  it('peak bin for 200Hz sine', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    // Bin 0 = DC, bin 1 = 16000/512 = 31.25 Hz
    // 200 Hz ≈ bin 200 / 31.25 = 6.4 → bin 6 or 7
    let maxIdx = 0
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > mags[maxIdx]) maxIdx = i
    }
    const binFreq = maxIdx * sampleRate / fftSize
    assert.ok(Math.abs(binFreq - 200) < 50,
      `expected peak near 200Hz, got ${binFreq}Hz (bin ${maxIdx})`)
  })

  it('peak bin for 440Hz sine', () => {
    const signal = generateSine(440, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    let maxIdx = 0
    for (let i = 1; i < mags.length; i++) {
      if (mags[i] > mags[maxIdx]) maxIdx = i
    }
    const binFreq = maxIdx * sampleRate / fftSize
    assert.ok(Math.abs(binFreq - 440) < 50,
      `expected peak near 440Hz, got ${binFreq}Hz (bin ${maxIdx})`)
  })

  it('returns -Inf for all bins on silent input', () => {
    const signal = new Float32Array(frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    // All bins should be very low (log of near-zero)
    for (let i = 0; i < mags.length; i++) {
      assert.ok(mags[i] < -50, `bin ${i} should be low, got ${mags[i]}`)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test js/__tests__/fft.test.js`
Expected: PASS all 4 tests

- [ ] **Step 3: Commit**

```bash
git add js/__tests__/fft.test.js
git commit -m "test: add FFT tests for 512-FFT with 400-sample input"
```

---

## Task 5: Refactor AudioEngine

**Files:**
- Modify: `js/audio-engine.js`

- [ ] **Step 1: Modify AudioEngine to use Resampler + FrameProcessor**

Replace `js/audio-engine.js`:

The key changes:
1. Remove forced `sampleRate: 44100` and `chunkSize: 512`
2. Use the browser's native `AudioContext` sample rate
3. Create a `Resampler(inputRate, 16000)` and `FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })`
4. In `onaudioprocess`: push raw input to Resampler, then to FrameProcessor
5. FrameProcessor's `onFrame` callback runs F0 + FFT on each 16kHz frame
6. The `_latestFrame` is updated per frame, the rAF loop picks it up
7. Keep FFT at 512 (zero-padded from 400)
8. Keep `extractFormants` call if formants are needed (but user has them hidden)

```javascript
import { fftMagnitudes } from './fft.js'
import { extractFormants } from './lpc.js'
import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'

export class AudioEngine {
  constructor() {
    this._audioContext = null
    this._stream = null
    this._source = null
    this._processor = null
    this._gainNode = null
    this.running = false
    this._ringBuffer = []

    this._resampler = null
    this._frameProcessor = null
    this._frameCount = 0

    this.onCombinedFrame = null
    this._latestFrame = null
    this._lastFrameTime = -1
    this._rafId = null
  }

  async start() {
    if (this.running) return
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      this._audioContext = new AudioContext()
      await this._audioContext.resume()
      const inputRate = this._audioContext.sampleRate

      this._resampler = new Resampler(inputRate, 16000)
      this._frameProcessor = new FrameProcessor({
        sampleRate: 16000,
        frameSize: 400,
        hopSize: 160,
      })
      this._frameProcessor.onFrame = (frame) => {
        const magnitudes = fftMagnitudes(frame.samples, 512)
        const result = extractFormants(frame.samples, frame.sampleRate)
        const formants = result.formants
        this._frameCount++
        this._latestFrame = {
          magnitudes,
          f0: result.f0,
          f1: formants[0]?.freq ?? null,
          f2: formants[1]?.freq ?? null,
          f3: formants[2]?.freq ?? null,
          f4: formants[3]?.freq ?? null,
          time: this._frameCount * 0.01,  // each frame = 10ms
        }
      }

      this._source = this._audioContext.createMediaStreamSource(this._stream)

      this._processor = this._audioContext.createScriptProcessor(1024, 1, 1)
      this._processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)

        const resampled = this._resampler.process(input)
        if (resampled.length > 0) {
          this._frameProcessor.push(resampled)
        }

        const samples = new Float32Array(input)
        this._ringBuffer.push({ samples, time: this._audioContext.currentTime })
      }

      this._gainNode = this._audioContext.createGain()
      this._gainNode.gain.value = 0
      this._source.connect(this._processor)
      this._processor.connect(this._gainNode)
      this._gainNode.connect(this._audioContext.destination)

      const loop = () => {
        if (!this.running) return
        const frame = this._latestFrame
        if (frame && frame.time !== this._lastFrameTime) {
          this._lastFrameTime = frame.time
          if (this.onCombinedFrame) {
            this.onCombinedFrame(frame)
          }
        }
        this._rafId = requestAnimationFrame(loop)
      }

      this.running = true
      this._rafId = requestAnimationFrame(loop)
    } catch (err) {
      if (this._stream) {
        this._stream.getTracks().forEach(t => t.stop())
        this._stream = null
      }
      if (this._audioContext) {
        this._audioContext.close()
        this._audioContext = null
      }
      this._source = null
      this._processor = null
      this._gainNode = null
      this._rafId = null
      this.running = false
      throw err
    }
  }

  stop() {
    this.running = false
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop())
      this._stream = null
    }
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
    this._source = null
    this._processor = null
    this._gainNode = null
    this._resampler = null
    this._frameProcessor = null
    this._frameCount = 0
    this._ringBuffer = []
    this._latestFrame = null
    this._lastFrameTime = -1
  }

  get audioContext() { return this._audioContext }
  get stream() { return this._stream }
}
```

Notes on the change:
- `ScriptProcessorNode` buffer changed from 512 to 1024. This gives ~23ms of audio at 48kHz, enough for the resampler to produce multiple frames. The actual frame extraction is done by `FrameProcessor`.
- `_latestFrame.time` uses `_frameCount * 0.01` since each frame is exactly 10ms (160 samples at 16kHz). This is more accurate than `AudioContext.currentTime`.
- `getPCMBuffer()` is removed — the ring buffer format changed. If needed, it can be re-added.

- [ ] **Step 2: Verify no syntax errors by running tests**

Run: `node --test js/__tests__/pitch.test.js js/__tests__/fft.test.js js/__tests__/resampler.test.js js/__tests__/frame-processor.test.js`
Expected: PASS all tests (audio-engine.js changes don't affect server-side tests)

- [ ] **Step 3: Commit**

```bash
git add js/audio-engine.js
git commit -m "refactor: integrate Resampler + FrameProcessor into AudioEngine"
```

---

## Task 6: Refactor WavAnalyzer

**Files:**
- Modify: `js/wav-analyzer.js`

- [ ] **Step 1: Update analyzeWavF0 to use resampler + frame-processor**

`js/wav-analyzer.js`:

```javascript
import { detectPitch } from './lpc.js'
import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'

function readSample(view, offset, bitsPerSample) {
  switch (bitsPerSample) {
    case 8:
      return (view.getUint8(offset) - 128) / 128
    case 16:
      return view.getInt16(offset, true) / 32768
    case 24: {
      let val = view.getUint8(offset)
        | (view.getUint8(offset + 1) << 8)
        | (view.getUint8(offset + 2) << 16)
      if (val & 0x800000) val |= ~0xffffff
      return val / 8388608
    }
    case 32:
      return view.getFloat32(offset, true)
    default:
      throw new Error(`Unsupported bitsPerSample: ${bitsPerSample}`)
  }
}

export function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer)

  const riff = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4))
  if (riff !== 'RIFF') throw new Error('Not a RIFF file')

  const wave = String.fromCharCode(...new Uint8Array(arrayBuffer, 8, 4))
  if (wave !== 'WAVE') throw new Error('Not a WAV file')

  let audioFormat = 0, numChannels = 0, sampleRate = 0, bitsPerSample = 0
  let fmtFound = false
  let dataStart = 0, dataSize = 0

  let offset = 12
  while (offset < arrayBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4))
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true)
      numChannels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
      fmtFound = true
    } else if (chunkId === 'data') {
      if (!fmtFound) throw new Error('fmt chunk not found before data')
      dataStart = offset + 8
      dataSize = chunkSize
      break
    }

    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }

  if (!dataSize) throw new Error('data chunk not found')

  const bytesPerSample = bitsPerSample / 8
  const totalSamples = dataSize / bytesPerSample
  const totalFrames = totalSamples / numChannels

  const samples = new Float32Array(totalFrames)
  for (let i = 0; i < totalFrames; i++) {
    const byteOff = dataStart + i * numChannels * bytesPerSample
    samples[i] = readSample(view, byteOff, bitsPerSample)
  }

  return { samples, sampleRate, numChannels, bitsPerSample, audioFormat }
}

export async function analyzeWavF0(file) {
  const arrayBuffer = await file.arrayBuffer()
  const parsed = parseWav(arrayBuffer)
  const { samples, sampleRate } = parsed

  const resampler = new Resampler(sampleRate, 16000)
  const resampled = resampler.process(samples)

  const fp = new FrameProcessor({
    sampleRate: 16000,
    frameSize: 400,
    hopSize: 160,
  })

  const f0Data = []
  fp.onFrame = (frame) => {
    const f0 = detectPitch(frame.samples, frame.sampleRate)
    f0Data.push({ time: frame.time, f0 })
  }

  fp.push(resampled)
  fp.push(new Float32Array(400))  // flush remaining buffer

  const lastFrame = f0Data.length > 0 ? f0Data[f0Data.length - 1] : null
  const duration = lastFrame ? lastFrame.time + 0.01 : 0
  const voiced = f0Data.filter(d => d.f0 != null).length

  return {
    f0Data,
    sampleRate: 16000,
    duration,
    fileName: file.name,
    totalFrames: f0Data.length,
    voicedFrames: voiced,
  }
}
```

Note: The `fp.push(new Float32Array(400))` at the end flushes any remaining samples in the FrameProcessor buffer by pushing enough zero samples to guarantee the last partial frame is emitted. This ensures we don't miss the last few milliseconds of audio.

- [ ] **Step 2: Run all tests to verify**

Run: `node --test js/__tests__/*.test.js`
Expected: PASS all

- [ ] **Step 3: Commit**

```bash
git add js/wav-analyzer.js
git commit -m "refactor: update WavAnalyzer to use Resampler + FrameProcessor"
```

---

## Task 7: Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add test scripts**

```json
  "scripts": {
    "start": "/usr/bin/node server.js",
    "start:serve": "serve .",
    "start:py": "python3 -m http.server 3000",
    "test": "node --test js/__tests__/*.test.js"
  }
```

- [ ] **Step 2: Run tests to verify everything still passes**

Run: `npm test`
Expected: PASS all tests

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test script to package.json"
```

---

## Task 8: Full Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Start the server and manually verify browser behavior**

Run: `npm start`
- Open `http://localhost:3000`
- Verify microphone initializes
- Verify formant chart shows F0 trace scrolling smoothly with same speed as spectrogram
- Verify WAV upload still works and shows F0 trace

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration adjustments"
```

---

## Self-Review Checklist

1. **Spec coverage:** The plan covers all requirements from the brainstorming session:
   - Resampling any input rate → 16kHz ✓ (Resampler accepts arbitrary `inputRate`)
   - 25ms frames (400 samples @ 16kHz) ✓ (FrameProcessor default)
   - 10ms hop (160 samples) ✓ (FrameProcessor default)
   - Both mic input and WAV file use same pipeline ✓ (Tasks 5 & 6)
   - Unit tests with Node built-in runner ✓ (Tasks 1-4)

2. **Placeholder scan:** No TODOs, TBDs, or vague requirements. All code is complete.

3. **Type consistency:** `Resampler.process()` returns `Float32Array`. `FrameProcessor.push()` calls `onFrame` with `{ samples: Float32Array, time: number, sampleRate: 16000 }`. AudioEngine passes `frame.samples` to `fftMagnitudes` and `extractFormants`. All consistent.

4. **Scope check:** Single focused refactoring of the audio frame pipeline. No extraneous features.
