import { AudioEngine } from './audio-engine.js'
import { SpectrogramRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'
import { analyzeWavF0 } from './wav-analyzer.js'

const spectrogramCanvas = document.getElementById('spectrogram')
const formantCanvas = document.getElementById('formantChart')
const btnRecord = document.getElementById('btnRecord')

const audioEngine = new AudioEngine()
const spectrogram = new SpectrogramRenderer(spectrogramCanvas)
const formantChart = new FormantChartRenderer(formantCanvas)

const f0Label = document.getElementById('f0Label')
const wavInfo = document.getElementById('wavInfo')

btnRecord.addEventListener('click', async () => {
  if (audioEngine.running) {
    audioEngine.stopStream()
    formantChart._canvasSnapshot = formantChart.ctx.getImageData(
      0, 0, formantChart.canvas.width, formantChart.canvas.height)
    btnRecord.textContent = '录制'
  } else {
    formantChart._canvasSnapshot = null
    spectrogram.clear()
    formantChart.clear()
    formantChart.clearWavTrace()
    wavInfo.textContent = ''
    f0Label.textContent = 'F0: -- Hz'

    try {
      await audioEngine.startStream(({ f0, time, magnitudes }) => {
        spectrogram.pushFrame(magnitudes, time)
        formantChart.pushFrame({ f0 }, time)
        f0Label.textContent = f0 != null ? `F0: ${Math.round(f0)} Hz` : 'F0: -- Hz'
      })
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
  const lastIdx = data.length - 1
  const idx = Math.max(0, lastIdx - (w - 1 - clickX))
  const frame = data[Math.min(idx, lastIdx)]
  if (!frame) return

  if (formantChart._canvasSnapshot) {
    formantChart.ctx.putImageData(formantChart._canvasSnapshot, 0, 0)
  }
  formantChart.showVerticalLine(clickX, frame)
  f0Label.textContent = frame.f0 != null ? `F0: ${Math.round(frame.f0)} Hz` : 'F0: -- Hz'
})

document.getElementById('wavInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  wavInfo.textContent = '分析中...'
  try {
    const result = await analyzeWavF0(file)
    formantChart.showWavF0Trace(result.f0Data, result.fileName, result.duration)
    wavInfo.textContent = `${result.voicedFrames}/${result.totalFrames} voiced  [× 关闭]`
  } catch (err) {
    wavInfo.textContent = `错误: ${err.message}`
    console.error('WAV analysis failed:', err)
  }
})

wavInfo.addEventListener('click', () => {
  if (formantChart._wavMode) {
    formantChart.clearWavTrace()
    wavInfo.textContent = ''
  }
})
