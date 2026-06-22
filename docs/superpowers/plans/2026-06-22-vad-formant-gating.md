# VAD Formant Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Voice Activity Detector that gates LPC/Pitch analysis so noise frames produce null for all formants (F0-F4).

**Architecture:** New `VoiceActivityDetector` class computes frame RMS energy against a fixed threshold. Pipeline checks VAD before running LPC/Pitch; unvoiced frames skip analysis entirely and output null formants. FFT always runs for spectrogram continuity.

**Tech Stack:** Vanilla JS (ES modules), Node built-in test runner (`node:test`)

---

### Task 1: Create VAD module + tests

**Files:**
- Create: `js/vad.js`
- Create: `js/__tests__/vad.test.js`

- [ ] **Step 1: Write the tests first**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VoiceActivityDetector } from '../vad.js'

describe('VoiceActivityDetector', () => {
  it('returns voiced=false for silence (all zeros)', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.008 })
    const samples = new Float32Array(400)
    const result = vad.compute(samples)
    assert.equal(result.voiced, false)
    assert.equal(result.rms, 0)
  })

  it('returns voiced=false for low amplitude below threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = 0.05
    const result = vad.compute(samples)
    assert.equal(result.voiced, false)
  })

  it('returns voiced=true for amplitude at threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = 0.1
    const result = vad.compute(samples)
    assert.equal(result.voiced, true)
    assert.ok(Math.abs(result.rms - 0.1) < 0.001)
  })

  it('returns voiced=true for amplitude above threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.008 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = Math.sin(2 * Math.PI * 200 * i / 16000)
    const result = vad.compute(samples)
    assert.equal(result.voiced, true)
    assert.ok(result.rms > 0.008)
  })

  it('uses default threshold of 0.008', () => {
    const vad = new VoiceActivityDetector()
    assert.equal(vad._threshold, 0.008)
  })

  it('accepts custom threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.05 })
    assert.equal(vad._threshold, 0.05)
  })

  it('compute() is stateless — same input returns same output', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.008 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = 0.05
    const r1 = vad.compute(samples)
    const r2 = vad.compute(samples)
    assert.equal(r1.voiced, r2.voiced)
    assert.equal(r1.rms, r2.rms)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/__tests__/vad.test.js`
Expected: FAIL with "Cannot find module '../vad.js'"

- [ ] **Step 3: Write minimal implementation**

```js
export class VoiceActivityDetector {
  constructor({ threshold = 0.008 } = {}) {
    this._threshold = threshold
  }

  compute(samples) {
    let sumSq = 0
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSq / samples.length)
    return { voiced: rms >= this._threshold, rms }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/__tests__/vad.test.js`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add js/vad.js js/__tests__/vad.test.js
git commit -m "feat: add VoiceActivityDetector with RMS energy threshold"
```

---

### Task 2: Integrate VAD into AnalysisPipeline

**Files:**
- Modify: `js/analysis-pipeline.js`

- [ ] **Step 1: Add import and constructor parameter**

Replace `import { detectPitch, extractFormants } from './lpc.js'` with import also including VAD, and update constructor:

```js
import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'
import { fftMagnitudes } from './fft.js'
import { detectPitch, extractFormants } from './lpc.js'
import { VoiceActivityDetector } from './vad.js'

export class AnalysisPipeline {
  constructor({ onFrame, vadThreshold } = {}) {
    this._resampler = null
    this._frameProcessor = null
    this.onFrame = onFrame
    this._frameCount = 0
    this._vad = new VoiceActivityDetector({ threshold: vadThreshold ?? 0.008 })
  }
```

- [ ] **Step 2: Gate LPC/Pitch in the onFrame callback**

Modify the callback inside `pushChunk()`:

```js
this._frameProcessor.onFrame = (frame) => {
  const { voiced } = this._vad.compute(frame.samples)
  let f0 = null
  let formants = []
  if (voiced) {
    f0 = detectPitch(frame.samples, frame.sampleRate)
    const result = extractFormants(frame.samples, frame.sampleRate)
    formants = result.formants
  }
  const magnitudes = fftMagnitudes(frame.samples, 512)
  this._frameCount++
  const output = {
    f0,
    f1: formants[0]?.freq ?? null,
    f2: formants[1]?.freq ?? null,
    f3: formants[2]?.freq ?? null,
    f4: formants[3]?.freq ?? null,
    time: this._frameCount * 0.01,
    magnitudes,
    voiced,
  }
  if (this.onFrame) this.onFrame(output)
}
```

- [ ] **Step 3: Run existing tests to verify**

Run: `node --test js/__tests__/analysis-pipeline.test.js`
Expected: PASS (all 6 tests) — note that voiced count in test 2 may change slightly due to VAD

- [ ] **Step 4: Commit**

```bash
git add js/analysis-pipeline.js
git commit -m "feat: integrate VAD gating into analysis pipeline"
```

---

### Task 3: Update main.js voiced counting

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Change voiced count to use `.voiced` field**

Line 100, change:
```js
const voiced = frames.filter(f => f.f0 != null).length
```
to:
```js
const voiced = frames.filter(f => f.voiced).length
```

- [ ] **Step 2: Verify no other `.voiced` or `.f0` counting patterns exist**

Run: `rg "f\.f0\s*!=\s*null" js/` — should show no matches (only the line we just changed)

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix: update voiced count to use voiced field"
```

---

### Task 4: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `node --test js/__tests__/*.test.js`
Expected: PASS (all)

- [ ] **Step 2: Verify dev server still starts**

Run: `npx vite build` (or `npm run build`)
Expected: Build succeeds without errors

- [ ] **Step 3: Commit if needed**

```bash
git add -A
git commit -m "chore: update tests for VAD integration"
```
