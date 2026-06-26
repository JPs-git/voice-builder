import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { parseWav } from '../wav-parser.js'
import { AnalysisPipeline } from '../analysis-pipeline.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.resolve(__dirname, '../../assets')

function loadPraat(vowel) {
  const raw = readFileSync(path.join(ASSETS, `info_${vowel}.txt`), 'utf-8')
  return raw.trim().split('\n').slice(1).map(l => {
    const p = l.trim().split(/\s+/)
    return { t: +p[0], f1: +p[1], f2: +p[2] }
  }).filter(p => p.f1 > 20 && p.f2 > 20)
}

const VOWELS = [
  { id: 'a', f1Ref: 850, f2Ref: 1220 },
  { id: 'o', f1Ref: 430, f2Ref: 870 },
  { id: 'e', f1Ref: 620, f2Ref: 1300 },
  { id: 'i', f1Ref: 310, f2Ref: 2310 },
  { id: 'u', f1Ref: 350, f2Ref: 720 },
  { id: 'yu', f1Ref: 330, f2Ref: 2050 },
]

describe('Praat regression: hybrid accuracy on 6 isolated vowels', () => {
  for (const { id, f1Ref, f2Ref } of VOWELS) {
    it(`${id}: F1/F2 error < 10% on stable region (hybrid + smoother)`, () => {
      const buf = readFileSync(path.join(ASSETS, `${id}.wav`))
      const wav = parseWav(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      const frames = AnalysisPipeline.analyze(wav.samples, wav.sampleRate, 'hybrid', true)
      const ref = loadPraat(id)
      const voiced = frames.filter(f => f.f0 > 0 && f.f1 > 0 && f.f2 > 0)

      assert.ok(voiced.length >= 5, `[${id}] need >=5 voiced frames, got ${voiced.length}`)

      const start = Math.floor(voiced.length * 0.2)
      const end = Math.floor(voiced.length * 0.9)
      const stable = voiced.slice(start, end)
      assert.ok(stable.length >= 3, `[${id}] stable region too small (${stable.length})`)

      let f1ErrSum = 0, f2ErrSum = 0
      for (const f of stable) {
        const nearest = ref.reduce((best, praat) => Math.abs(praat.t - f.time) < Math.abs(best.t - f.time) ? praat : best)
        f1ErrSum += Math.abs(f.f1 - nearest.f1) / nearest.f1
        f2ErrSum += Math.abs(f.f2 - nearest.f2) / nearest.f2
      }
      const f1Err = f1ErrSum / stable.length * 100
      const f2Err = f2ErrSum / stable.length * 100

      assert.ok(f1Err < 10, `[${id}] F1 error: ${f1Err.toFixed(1)}% ≥ 10%`)
      assert.ok(f2Err < 10, `[${id}] F2 error: ${f2Err.toFixed(1)}% ≥ 10%`)
    })
  }
})
