export class PlaybackManager {
  constructor(audioEngine, spectrogramRenderer, formantChartRenderer) {
    this.audioEngine = audioEngine
    this.spectrogram = spectrogramRenderer
    this.formantChart = formantChartRenderer
    this.paused = false
    this._boundClick = null
    this._canvasSnapshot = null
    this.onResume = null
  }

  pause() {
    this.paused = true
    this.audioEngine.stop()
    // Save canvas state for click overlay
    this._saveSnapshot()
    this._enableClickInspect()
  }

  async resume() {
    this.paused = false
    this._canvasSnapshot = null
    await this.audioEngine.start()
    if (this.onResume) await this.onResume()
    this._disableClickInspect()
  }

  _saveSnapshot() {
    const c = this.formantChart.canvas
    this._canvasSnapshot = c.getContext('2d').getImageData(0, 0, c.width, c.height)
  }

  _restoreSnapshot() {
    if (!this._canvasSnapshot) return
    const c = this.formantChart.canvas
    c.getContext('2d').putImageData(this._canvasSnapshot, 0, 0)
  }

  _enableClickInspect() {
    if (this._boundClick) return

    this._boundClick = (e) => {
      const chart = this.formantChart
      const rect = chart.canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const ratio = clickX / rect.width
      const canvasX = Math.round(ratio * chart.canvas.width)
      const data = chart.data
      if (data.length < 2) return

      const timeStart = data[0].time
      const timeEnd = data[data.length - 1].time
      const clickTime = timeStart + ratio * (timeEnd - timeStart)

      let idx = 0
      let minDist = Infinity
      for (let i = 0; i < data.length; i++) {
        const d = Math.abs(data[i].time - clickTime)
        if (d < minDist) { minDist = d; idx = i }
      }

      this._restoreSnapshot()
      const f0 = chart.showVerticalLine(canvasX, data[idx])
      const labelEl = document.getElementById('f0Label')
      if (labelEl) {
        labelEl.textContent = f0 != null ? `F0: ${Math.round(f0)} Hz` : 'F0: -- Hz'
      }
    }

    this.formantChart.canvas.addEventListener('click', this._boundClick)
  }

  _disableClickInspect() {
    if (!this._boundClick) return
    this.formantChart.canvas.removeEventListener('click', this._boundClick)
    this._boundClick = null
  }

  toggle() {
    if (this.paused) this.resume()
    else this.pause()
  }

  destroy() {
    this._disableClickInspect()
  }
}
