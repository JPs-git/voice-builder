import { AudioEngine } from './audio-engine.js'
import { AnalysisPipeline } from './analysis-pipeline.js'
import { SpectrogramRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'
import { parseWav } from './wav-parser.js'

const spectrogramCanvas = document.getElementById('spectrogram')
const formantCanvas = document.getElementById('formantChart')
const btnRecord = document.getElementById('btnRecord')

const audioEngine = new AudioEngine()
const spectrogram = new SpectrogramRenderer(spectrogramCanvas)
const formantChart = new FormantChartRenderer(formantCanvas)

const f0Label = document.getElementById('f0Label')
const f1Label = document.getElementById('f1Label')
const f2Label = document.getElementById('f2Label')
const f3Label = document.getElementById('f3Label')
const f4Label = document.getElementById('f4Label')
const wavInfo = document.getElementById('wavInfo')

let livePipeline = null

function updateFormantLabels(f) {
  const labels = [
    { el: f0Label, prefix: 'F0: ' },
    { el: f1Label, prefix: 'F1: ' },
    { el: f2Label, prefix: 'F2: ' },
    { el: f3Label, prefix: 'F3: ' },
    { el: f4Label, prefix: 'F4: ' },
  ]
  const set = (el, prefix, val) => {
    if (!el) return
    el.textContent = val != null ? `${prefix}${Math.round(val)} Hz` : `${prefix}-- Hz`
  }
  for (const { el, prefix } of labels) {
    const val = f ? f[prefix.toLowerCase().slice(0, 2)] : null
    set(el, prefix, val)
  }
}

function clearAll() {
  if (livePipeline) { livePipeline.reset(); livePipeline = null }
  spectrogram.clear()
  formantChart.clear()
  wavInfo.textContent = ''
  updateFormantLabels(null)
}

btnRecord.addEventListener('click', async () => {
  if (audioEngine.running) {
    audioEngine.stopStream()
    if (livePipeline) { livePipeline.flush(); livePipeline.reset(); livePipeline = null }
    formantChart.saveSnapshot()
    btnRecord.textContent = '录制'
  } else {
    clearAll()
    livePipeline = new AnalysisPipeline({
      onFrame: (frame) => {
        spectrogram.pushFrame(frame.magnitudes, frame.time)
        formantChart.pushFrame(frame, frame.time)
        updateFormantLabels(frame)
      },
    })

    try {
      await audioEngine.startStream((chunk, rate) => livePipeline.pushChunk(chunk, rate))
      btnRecord.textContent = '停止'
    } catch (err) {
      f0Label.textContent = '麦克风初始化失败'
      console.error('Stream start failed:', err)
    }
  }
})

formantCanvas.addEventListener('click', (e) => {
  const data = formantChart.data
  if (data.length < 2) return

  const rect = formantCanvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const clickX = Math.round((e.clientX - rect.left) * dpr)
  const w = formantChart.canvas.width

  let idx
  if (formantChart.batchMode) {
    idx = Math.round((clickX / w) * data.length)
    idx = Math.max(0, Math.min(idx, data.length - 1))
  } else {
    const dataStartX = w - data.length
    if (clickX < dataStartX) return
    idx = Math.min(clickX - dataStartX, data.length - 1)
  }

  const frame = data[idx]
  if (!frame) return

  console.log(`点击帧 id=${idx}  F0=${frame.f0}  F1=${frame.f1}  F2=${frame.f2}  F3=${frame.f3}  F4=${frame.f4}`)

  formantChart.restoreSnapshot()
  formantChart.showVerticalLine(clickX, frame)
  updateFormantLabels(frame)
})

document.getElementById('wavInput').addEventListener('change', async (e) => {
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

    spectrogram.displayAll(frames)
    formantChart.displayAll(frames)

    const voiced = frames.filter(f => f.f0 != null).length
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
