// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { parseWav } from '../../dsp/wav-parser'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'

const ASSETS = path.resolve(__dirname, '../../../assets')

function loadPraat(vowel: string): { t: number; f1: number; f2: number }[] {
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

describe.skip('Praat regression', () => {
  for (const { id } of VOWELS) {
    it(`${id}: F1/F2 error < 10% on stable region (hybrid + smoother)`, () => {
      const fileBuf = readFileSync(path.join(ASSETS, `${id}.wav`))
      const arrayBuf = fileBuf.buffer.slice(
        fileBuf.byteOffset,
        fileBuf.byteOffset + fileBuf.byteLength,
      )
      const wav = parseWav(arrayBuf)
      const frames = AnalysisPipeline.analyze(wav.samples, wav.sampleRate, 'hybrid', true)
      const ref = loadPraat(id)
      const voiced = frames.filter(f => f.f0 != null && f.f0 > 0 && f.f1 != null && f.f1 > 0 && f.f2 != null && f.f2 > 0)

      expect(voiced.length).toBeGreaterThanOrEqual(5)

      const start = Math.floor(voiced.length * 0.2)
      const end = Math.floor(voiced.length * 0.9)
      const stable = voiced.slice(start, end)
      expect(stable.length).toBeGreaterThanOrEqual(3)

      let f1ErrSum = 0, f2ErrSum = 0
      for (const f of stable) {
        const nearest = ref.reduce((best, praat) =>
          Math.abs(praat.t - f.time) < Math.abs(best.t - f.time) ? praat : best)
        f1ErrSum += Math.abs(f.f1! - nearest.f1) / nearest.f1
        f2ErrSum += Math.abs(f.f2! - nearest.f2) / nearest.f2
      }
      const f1Err = f1ErrSum / stable.length * 100
      const f2Err = f2ErrSum / stable.length * 100

      expect(f1Err).toBeLessThan(10)
      expect(f2Err).toBeLessThan(10)
    })
  }
})
