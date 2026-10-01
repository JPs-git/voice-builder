import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { extractFormants } from '../../dsp/lpc'
import { extractFormantsCepstral } from '../../dsp/cepstral'

const voicedFrame = Float32Array.from({ length: 800 },
  (_, i) => .6 * Math.sin(2 * Math.PI * 220 * i / 16000))
const extractors = [
  ['lpc', extractFormants],
  ['cepstral', extractFormantsCepstral],
]

describe('precomputed pitch contract', () => {
  for (const [name, extract] of extractors) {
    it(name + ' preserves a computed null instead of estimating pitch again', () => {
      const result = extract(voicedFrame, 16000, 2, null)
      assert.equal(result.f0, null)
    })

    it(name + ' uses supplied pitch and keeps formant extraction unchanged', () => {
      const original = extract(voicedFrame, 16000, 2)
      const supplied = extract(voicedFrame, 16000, 2, 123)
      assert.equal(supplied.f0, 123)
      assert.deepEqual(supplied.formants, original.formants)
    })

    it(name + ' still estimates pitch when omitted or explicitly undefined', () => {
      const omitted = extract(voicedFrame, 16000, 2)
      const explicit = extract(voicedFrame, 16000, 2, undefined)
      assert.ok(omitted.f0 > 210 && omitted.f0 < 230)
      assert.deepEqual(explicit, omitted)
    })
  }
})
import { vi } from 'vitest'
import * as lpc from '../../dsp/lpc'
import * as cepstral from '../../dsp/cepstral'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'

describe('pipeline reuses pitch at extraction boundaries', () => {
  for (const [mode, module, functionName] of [
    ['lpc', lpc, 'extractFormants'],
    ['cepstral', cepstral, 'extractFormantsCepstral'],
    ['hybrid', lpc, 'extractFormants'],
  ]) {
    it(mode + ' passes the pitch already computed on the same voiced frame', () => {
      const spy = vi.spyOn(module, functionName)
      try {
        const frames = []
        const pipeline = new AnalysisPipeline({
          formantMethod: mode, formantSmoothing: false, onFrame: frame => frames.push(frame),
        })
        pipeline.pushChunk(voicedFrame, 16000)
        assert.ok(spy.mock.calls.length > 0)
        for (const call of spy.mock.calls) assert.equal(call[3], 219.17808219178082)
        assert.ok(frames.length > 0)
        assert.equal(frames[0].f0, 219.17808219178082)
      } finally {
        spy.mockRestore()
      }
    })
  }
})
