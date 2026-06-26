import { readFileSync } from 'fs'
import { parseWav } from './js/wav-parser.js'
import { AnalysisPipeline } from './js/analysis-pipeline.js'

// Load WAV
const buf = readFileSync('assets/aoe.wav')
const wav = parseWav(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
let samples = wav.samples
let rate = wav.sampleRate

// Run both methods
const framesCep = AnalysisPipeline.analyze(samples, rate, 'cepstral', true)
const framesLpc = AnalysisPipeline.analyze(samples, rate, 'lpc', true)

// Parse Praat data
const praatRaw = readFileSync('assets/info_aoe.txt', 'utf-8')
const praatLines = praatRaw.trim().split('\n').slice(1)
const praat = praatLines.map(line => {
  const parts = line.trim().split(/\s+/)
  return { t: +parts[0], f1: +parts[1], f2: +parts[2], f3: +parts[3], f4: +parts[4] }
}).filter(p => p.f1 > 0 && p.f2 > 0)

// Helper: find nearest Praat frame by time
function nearestPraat(t) {
  let best = praat[0]
  let bestDist = Math.abs(praat[0].t - t)
  for (const p of praat) {
    const d = Math.abs(p.t - t)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

// Collect comparison into 0.3s windows
const windowSize = 0.3
const segments = []
let t = 0
while (t < framesCep[framesCep.length - 1].time) {
  const cep = framesCep.filter(f => f.time >= t && f.time < t + windowSize)
  const lpc = framesLpc.filter(f => f.time >= t && f.time < t + windowSize)
  const pra = praat.filter(p => p.t >= t && p.t < t + windowSize)
  if (cep.length >= 3 && pra.length >= 3) {
    const cepF1 = cep.reduce((s, f) => s + f.f1, 0) / cep.length
    const cepF2 = cep.reduce((s, f) => s + f.f2, 0) / cep.length
    const lpcF1 = lpc.reduce((s, f) => s + f.f1, 0) / lpc.length
    const lpcF2 = lpc.reduce((s, f) => s + f.f2, 0) / lpc.length
    const praF1 = pra.reduce((s, p) => s + p.f1, 0) / pra.length
    const praF2 = pra.reduce((s, p) => s + p.f2, 0) / pra.length
    const cepF1Err = Math.abs(cepF1 - praF1)
    const cepF2Err = Math.abs(cepF2 - praF2)
    const lpcF1Err = Math.abs(lpcF1 - praF1)
    const lpcF2Err = Math.abs(lpcF2 - praF2)
    segments.push({ t, windowSize, n: cep.length, praF1, praF2, cepF1, cepF2, lpcF1, lpcF2, cepF1Err, cepF2Err, lpcF1Err, lpcF2Err })
  }
  t += 0.3
}

// Find bad segments (F1 error > 150Hz or F2 error > 300Hz)
const bad = segments.filter(s => s.cepF2Err > 300 || s.lpcF2Err > 300)

console.log('=== 全时段对比 (0.3s 窗口均值) ===')
console.log('')
console.log('时段         |  Praat        | 倒谱法         | LPC           | 差异(倒谱/LPC)')
console.log('             |  F1    F2     |  F1    F2      |  F1    F2     |  F1       F2')
console.log('-' .repeat(95))
for (const s of segments) {
  const flagCep = s.cepF2Err > 300 || s.cepF1Err > 150 ? ' ←' : ''
  const flagLpc = s.lpcF2Err > 300 || s.lpcF1Err > 150 ? ' ←' : ''
  const line = `${s.t.toFixed(2)}-${(s.t+windowSize).toFixed(2)}s ` +
    `| ${s.praF1.toFixed(0).padStart(5)} ${s.praF2.toFixed(0).padStart(6)} ` +
    `| ${s.cepF1.toFixed(0).padStart(5)} ${s.cepF2.toFixed(0).padStart(6)} ` +
    `| ${s.lpcF1.toFixed(0).padStart(5)} ${s.lpcF2.toFixed(0).padStart(6)} ` +
    `| ${s.cepF1Err.toFixed(0).padStart(4)}/${s.lpcF1Err.toFixed(0).padStart(4)} ` +
    `${s.cepF2Err.toFixed(0).padStart(5)}/${s.lpcF2Err.toFixed(0).padStart(4)}` +
    (flagCep || flagLpc ? ` ${flagCep}${flagLpc}` : '')
  console.log(line)
}

console.log('')
console.log('=== 异常段落 (F2 误差 > 300Hz) ===')
console.log('')
for (const s of bad) {
  console.log(`[${s.t.toFixed(2)}-${(s.t+windowSize).toFixed(2)}s] ` +
    `Praat F1/F2=${s.praF1.toFixed(0)}/${s.praF2.toFixed(0)}  ` +
    `Cep: ${s.cepF1.toFixed(0)}/${s.cepF2.toFixed(0)}  ` +
    `LPC: ${s.lpcF1.toFixed(0)}/${s.lpcF2.toFixed(0)}`)
}

// Find specific frames where F2 jumps (our smoother's 300Hz threshold test)
console.log('')
console.log('=== 逐帧异常: F2 跳变 > 300Hz (平滑器触发) ===')
console.log('')
for (let i = 1; i < framesCep.length; i++) {
  const jump = Math.abs((framesCep[i].f2 ?? 0) - (framesCep[i-1].f2 ?? 0))
  if (jump > 300 && framesCep[i].f2 != null && framesCep[i-1].f2 != null) {
    const ref = nearestPraat(framesCep[i].time)
    console.log(`t=${framesCep[i].time.toFixed(3)}s  F2跳变=${jump.toFixed(0)}Hz  ` +
      `F1=${framesCep[i].f1?.toFixed(0)} F2=${framesCep[i].f2?.toFixed(0)}  ` +
      `Praat F1/F2=${ref.f1.toFixed(0)}/${ref.f2.toFixed(0)}`)
  }
}
