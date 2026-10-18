import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parseWav } from '../../dsp/wav-parser'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'

describe('quiet recorded vowels with microphone floor noise', () => {
  it.each(['a', 'o', 'e', 'i', 'u', 'yu'])('retains pitch and formants for quiet vowel %s', vowel => {
    const buffer = readFileSync(new URL(`../../../assets/${vowel}.wav`, import.meta.url))
    const wav = parseWav(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    const reference = AnalysisPipeline.analyze(wav.samples, wav.sampleRate, 'hybrid')
    const peakRms = Math.max(...reference.map(f => f.rms ?? 0))
    const scale = 0.02 / peakRms
    let seed = 42
    const quiet = Float32Array.from(wav.samples, sample => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return sample * scale + (seed / 4294967296 * 2 - 1) * Math.sqrt(3) * 0.001
    })
    const actual = AnalysisPipeline.analyze(quiet, wav.sampleRate, 'hybrid')
    const core = reference.map((f, i) => ({ f, result: actual[i] }))
      .filter(({ f }) => (f.rms ?? 0) >= peakRms * 0.6 && f.f0 !== null && f.f1 !== null && f.f2 !== null)
    expect(core.length).toBeGreaterThan(10)
    expect(core.filter(({ f, result }) => result.voiced && result.f0 !== null && result.f1 !== null && result.f2 !== null
      && Math.abs(result.f0 - f.f0!) / f.f0! < 0.1).length / core.length).toBeGreaterThan(0.9)
  })
})
