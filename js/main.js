import { AudioEngine } from './audio-engine.js'
import { AnalysisPipeline } from './analysis-pipeline.js'
import { PowerSpectrumRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'
import { parseWav } from './wav-parser.js'

const spectrumContainer = document.getElementById('powerSpectrum')
const formantContainer = document.getElementById('formantChart')
const btnRecord = document.getElementById('btnRecord')

const audioEngine = new AudioEngine()
const powerSpectrum = new PowerSpectrumRenderer(spectrumContainer)
const formantChart = new FormantChartRenderer(formantContainer)

const wavInfo = document.getElementById('wavInfo')
const wavInput = document.getElementById('wavInput')

let livePipeline = null

function clearAll() {
  if (livePipeline) { livePipeline.reset(); livePipeline = null }
  powerSpectrum.clear()
  formantChart.clear()
  wavInfo.textContent = ''
}

btnRecord.addEventListener('click', async () => {
  if (audioEngine.running) {
    audioEngine.stopStream()
    if (livePipeline) { livePipeline.flush(); livePipeline.reset(); livePipeline = null }
    btnRecord.textContent = '录制'
  } else {
    clearAll()
    livePipeline = new AnalysisPipeline({
      onFrame: (frame) => {
        powerSpectrum.pushFrame(frame.magnitudes, frame.time)
        formantChart.pushFrame(frame, frame.time)
      },
    })

    try {
      await audioEngine.startStream((chunk, rate) => livePipeline.pushChunk(chunk, rate))
      btnRecord.textContent = '停止'
    } catch (err) {
      console.error('Stream start failed:', err)
    }
  }
})

formantChart._onClick = (frame) => {
  console.log(`点击帧 time=${frame.time.toFixed(2)}s  F0=${frame.f0}  F1=${frame.f1}  F2=${frame.f2}  F3=${frame.f3}  F4=${frame.f4}`)
}

wavInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (audioEngine.running) {
    audioEngine.stopStream()
    btnRecord.textContent = '录制'
  }

  clearAll()
  wavInfo.textContent = '分析中...'

  try {
    const arrayBuffer = await file.arrayBuffer()
    const parsed = parseWav(arrayBuffer)
    const frames = AnalysisPipeline.analyze(parsed.samples, parsed.sampleRate)

    powerSpectrum.displayAll(frames)
    formantChart.displayAll(frames)

    const voiced = frames.filter(f => f.voiced).length
    wavInfo.textContent = `${voiced}/${frames.length} voiced  [× 关闭]`
  } catch (err) {
    wavInfo.textContent = `错误: ${err.message}`
    console.error('WAV analysis failed:', err)
  }
})

wavInfo.addEventListener('click', () => {
  if (formantChart.batchMode) {
    clearAll()
  }
})
