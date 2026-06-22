export class AudioEngine {
  constructor() {
    this._audioContext = null
    this._stream = null
    this._source = null
    this._processor = null
    this.running = false
  }

  async startStream(onChunk) {
    if (this.running) return

    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._audioContext = new AudioContext({ sampleRate: 16000 })
    await this._audioContext.resume()

    this._source = this._audioContext.createMediaStreamSource(this._stream)
    this._processor = this._audioContext.createScriptProcessor(1024, 1, 1)
    this._processor.onaudioprocess = (event) => {
      onChunk(event.inputBuffer.getChannelData(0), this._audioContext.sampleRate)
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
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
  }
}
