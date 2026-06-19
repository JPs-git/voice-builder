import { fftMagnitudes } from './fft.js'
import { extractFormants } from './lpc.js'

export class AudioEngine {
  constructor() {
    this._audioContext = null
    this._stream = null
    this._source = null
    this._processor = null
    this._gainNode = null
    this.running = false
    this._ringBuffer = []
    this._bufferSamples = 0
    this.maxDuration = 60
    this.sampleRate = 44100
    this.chunkSize = 512
    this.onCombinedFrame = null
    this._latestFrame = null
    this._lastFrameTime = -1
    this._rafId = null
  }

  async start() {
    if (this.running) return
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      this._audioContext = new AudioContext({ sampleRate: this.sampleRate })
      await this._audioContext.resume()

      this._source = this._audioContext.createMediaStreamSource(this._stream)

      this._processor = this._audioContext.createScriptProcessor(this.chunkSize, 1, 1)
      this._processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)

        // FFT — zero-padded to 1024 for frequency resolution
        const magnitudes = fftMagnitudes(input, 1024)

        // LPC — on same PCM chunk
        const result = extractFormants(input, this._audioContext.sampleRate)

        // Ring buffer (copy — input buffer is reused by browser)
        const samples = new Float32Array(input)
        this._ringBuffer.push({ samples, time: this._audioContext.currentTime })
        this._bufferSamples += samples.length
        const maxSamples = this.sampleRate * this.maxDuration
        while (this._bufferSamples > maxSamples && this._ringBuffer.length > 0) {
          const removed = this._ringBuffer.shift()
          this._bufferSamples -= removed.samples.length
        }

        // Store combined frame for rAF loop to pick up
        const formants = result.formants
        this._latestFrame = {
          magnitudes,
          f0: result.f0,
          f1: formants[0]?.freq ?? null,
          f2: formants[1]?.freq ?? null,
          f3: formants[2]?.freq ?? null,
          f4: formants[3]?.freq ?? null,
          time: this._audioContext.currentTime,
        }
      }

      // Ensure ScriptProcessorNode fires by connecting through a 0-gain node
      this._gainNode = this._audioContext.createGain()
      this._gainNode.gain.value = 0
      this._source.connect(this._processor)
      this._processor.connect(this._gainNode)
      this._gainNode.connect(this._audioContext.destination)

      const loop = () => {
        if (!this.running) return
        const frame = this._latestFrame
        if (frame && frame.time !== this._lastFrameTime) {
          this._lastFrameTime = frame.time
          if (this.onCombinedFrame) {
            this.onCombinedFrame(frame)
          }
        }
        this._rafId = requestAnimationFrame(loop)
      }

      this.running = true
      this._rafId = requestAnimationFrame(loop)
    } catch (err) {
      if (this._stream) {
        this._stream.getTracks().forEach(t => t.stop())
        this._stream = null
      }
      if (this._audioContext) {
        this._audioContext.close()
        this._audioContext = null
      }
      this._source = null
      this._processor = null
      this._gainNode = null
      this._rafId = null
      this.running = false
      throw err
    }
  }

  stop() {
    this.running = false
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop())
      this._stream = null
    }
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
    this._source = null
    this._processor = null
    this._gainNode = null
    this._ringBuffer = []
    this._bufferSamples = 0
    this._latestFrame = null
    this._lastFrameTime = -1
  }

  get audioContext() { return this._audioContext }
  get stream() { return this._stream }

  getPCMBuffer() {
    let totalLength = 0
    for (const chunk of this._ringBuffer) {
      totalLength += chunk.samples.length
    }
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this._ringBuffer) {
      result.set(chunk.samples, offset)
      offset += chunk.samples.length
    }
    return result
  }
}
