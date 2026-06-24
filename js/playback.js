export class PlaybackManager {
  constructor(audioEngine, spectrogram, formantChart) {
    this.audioEngine = audioEngine
    this.spectrogram = spectrogram
    this.formantChart = formantChart
  }

  start(sessionFrames, onEnd) {
    if (sessionFrames.length < 2) return
    this.spectrogram.setCursorTime(0)
    this.formantChart.setCursorTime(0)

    this.audioEngine.startPlayback((time) => {
      this.spectrogram.setCursorTime(time)
      this.formantChart.setCursorTime(time)
    }, () => {
      this.spectrogram.setCursorTime(-1)
      this.formantChart.setCursorTime(-1)
      if (onEnd) onEnd()
    })
  }

  stop() {
    this.audioEngine.stopPlayback()
    this.spectrogram.setCursorTime(-1)
    this.formantChart.setCursorTime(-1)
  }
}
