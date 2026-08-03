import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseWav } from '../../dsp/wav-parser'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.resolve(__dirname, '../../../assets')

const SAMPLES = [
  { id: 'true', file: 'a_true_vocal.wav', expected: 'chest' },
  { id: 'mix', file: 'a_mix_vocal.wav', expected: 'mixed' },
  { id: 'false', file: 'a_false_vocal.wav', expected: 'falsetto' },
]

// 混声 sample momentarily thins (harmonicCount dips to 2) during phrasing → brief
// borderline falsetto at confidence 0.50. Wholesale reversal is the regression target.
const MIN_CORRECT_RATIO = 0.85

describe('register regression on labeled assets', () => {
  for (const { id, file, expected } of SAMPLES) {
    it(`classifies ${id} (${file}) as ${expected}`, () => {
      const buf = readFileSync(path.join(ASSETS, file))
      const wav = parseWav(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      const frames = AnalysisPipeline.analyze(wav.samples, wav.sampleRate, 'hybrid', true, true)
      const voiced = frames.filter(f => f.f0 > 0 && f.voiced)
      assert.ok(voiced.length > 0, 'should have voiced frames')

      const dist = {}
      for (const f of voiced) dist[f.register] = (dist[f.register] || 0) + 1
      const ratio = (dist[expected] || 0) / voiced.length
      assert.ok(
        ratio >= MIN_CORRECT_RATIO,
        `${id}: expected ${expected}, got ${JSON.stringify(dist)} (${(ratio * 100).toFixed(1)}% correct)`,
      )
    })
  }
})
