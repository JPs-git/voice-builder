import { fftMagnitudes } from './fft.js'
import { extractFormants } from './lpc.js'
import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'

export class AudioEngine {
  constructor() {
    this._audioContext = null
    this._stream = null
    this._source = null
    this._processor = null
    this._gainNode = null
    this.running = false
    this._ringBuffer = []

    this._resampler = null
    this._frameProcessor = null
    this._frameCount = 0

    this.onCombinedFrame = null
    this._latestFrame = null
    this._lastFrameTime = -1
    this._rafId = null
  }

  async start() {
    if (this.running) return
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      this._audioContext = new AudioContext()
      await this._audioContext.resume()
      const inputRate = this._audioContext.sampleRate

      this._resampler = new Resampler(inputRate, 16000)
      this._frameProcessor = new FrameProcessor({
        sampleRate: 16000,
        frameSize: 400,
        hopSize: 160,
      })
      this._frameProcessor.onFrame = (frame) => {
        const magnitudes = fftMagnitudes(frame.samples, 512)
        const result = extractFormants(frame.samples, frame.sampleRate)
        const formants = result.formants
        this._frameCount++
        this._latestFrame = {
          magnitudes,
          f0: result.f0,
          f1: formants[0]?.freq ?? null,
          f2: formants[1]?.freq ?? null,
          f3: formants[2]?.freq ?? null,
          f4: formants[3]?.freq ?? null,
          time: this._frameCount * 0.01,
        }
      }

      this._source = this._audioContext.createMediaStreamSource(this._stream)

      this._processor = this._audioContext.createScriptProcessor(1024, 1, 1)
      this._processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)

        const resampled = this._resampler.process(input)
        if (resampled.length > 0) {
          this._frameProcessor.push(resampled)
        }

        const samples = new Float32Array(input)
        this._ringBuffer.push({ samples, time: this._audioContext.currentTime })
      }

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
    this._resampler = null
    this._frameProcessor = null
    this._frameCount = 0
    this._ringBuffer = []
    this._latestFrame = null
    this._lastFrameTime = -1
  }

  get audioContext() { return this._audioContext }
  get stream() { return this._stream }
}
