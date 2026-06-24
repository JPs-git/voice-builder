export class AudioEngine {
  constructor() {
    this._audioContext = null
    this._stream = null
    this._source = null
    this._processor = null
    this._playbackSource = null
    this._playbackRAF = null
    this._isPlaying = false
    this._recordedChunks = []
    this._recordingSampleRate = 16000
    this._importedData = null
    this.running = false
  }

  async startStream(onChunk) {
    if (this.running) return

    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (!this._audioContext) {
      this._audioContext = new AudioContext({ sampleRate: 16000 })
    }
    await this._audioContext.resume()

    this._source = this._audioContext.createMediaStreamSource(this._stream)
    this._processor = this._audioContext.createScriptProcessor(1024, 1, 1)
    this._processor.onaudioprocess = (event) => {
      const chunk = event.inputBuffer.getChannelData(0)
      this._recordedChunks.push(new Float32Array(chunk))
      onChunk(chunk, this._audioContext.sampleRate)
    }
    this._source.connect(this._processor)
    this._processor.connect(this._audioContext.destination)

    this.running = true
  }

  stopStream() {
    this.running = false

    if (this._processor) {
      this._processor.disconnect()
      this._processor = null
    }
    if (this._source) {
      this._source.disconnect()
      this._source = null
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop())
      this._stream = null
    }
  }

  get isPlaying() {
    return this._isPlaying
  }

  _mergeBuffers() {
    let sources = []
    if (this._importedData) sources.push(this._importedData)
    sources = [...sources, ...this._recordedChunks]
    if (sources.length === 0) return new Float32Array(0)
    const totalLen = sources.reduce((s, c) => s + c.length, 0)
    const merged = new Float32Array(totalLen)
    let offset = 0
    for (const c of sources) { merged.set(c, offset); offset += c.length }
    return merged
  }

  getRecordedBuffer() {
    return { samples: this._mergeBuffers(), sampleRate: this._recordingSampleRate }
  }

  setImportedBuffer(samples) {
    this._importedData = samples
    this._recordingSampleRate = 16000
  }

  trimBufferToDuration(durationSec) {
    if (this._importedData) return
    const targetSamples = Math.round(durationSec * this._recordingSampleRate)
    let totalSamples = 0
    for (const c of this._recordedChunks) totalSamples += c.length
    if (totalSamples <= targetSamples) return
    const toRemove = totalSamples - targetSamples
    let removed = 0
    while (removed < toRemove && this._recordedChunks.length > 0) {
      const chunk = this._recordedChunks[0]
      if (removed + chunk.length <= toRemove) {
        removed += chunk.length
        this._recordedChunks.shift()
      } else {
        const keepFrom = toRemove - removed
        this._recordedChunks[0] = chunk.slice(keepFrom)
        removed = toRemove
      }
    }
  }

  clearRecordedBuffer() {
    this._recordedChunks = []
    this._importedData = null
  }

  startPlayback(onProgress, onEnd) {
    if (this._isPlaying) return
    if (!this._audioContext) {
      this._audioContext = new AudioContext({ sampleRate: 16000 })
    }
    const samples = this._mergeBuffers()
    if (samples.length === 0) return

    this._audioContext.resume()
    const buffer = this._audioContext.createBuffer(1, samples.length, this._recordingSampleRate)
    buffer.getChannelData(0).set(samples)

    this._playbackSource = this._audioContext.createBufferSource()
    this._playbackSource.buffer = buffer
    this._playbackSource.connect(this._audioContext.destination)

    const startTime = this._audioContext.currentTime
    const totalDuration = samples.length / this._recordingSampleRate
    this._isPlaying = true

    this._playbackSource.onended = () => {
      this._isPlaying = false
      if (this._playbackRAF) { cancelAnimationFrame(this._playbackRAF); this._playbackRAF = null }
      if (onEnd) onEnd()
    }

    this._playbackSource.start()

    const tick = () => {
      if (!this._isPlaying) return
      const elapsed = Math.min(this._audioContext.currentTime - startTime, totalDuration)
      onProgress(elapsed)
      if (elapsed < totalDuration) {
        this._playbackRAF = requestAnimationFrame(tick)
      }
    }
    this._playbackRAF = requestAnimationFrame(tick)
  }

  stopPlayback() {
    if (this._playbackSource) {
      try { this._playbackSource.stop() } catch (e) { /* already ended */ }
      this._playbackSource.disconnect()
      this._playbackSource = null
    }
    this._isPlaying = false
    if (this._playbackRAF) { cancelAnimationFrame(this._playbackRAF); this._playbackRAF = null }
  }

  destroy() {
    this.stopPlayback()
    this.stopStream()
    if (this._audioContext) { this._audioContext.close(); this._audioContext = null }
    this.clearRecordedBuffer()
  }
}
