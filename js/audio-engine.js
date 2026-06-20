import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'
import { detectPitch } from './lpc.js'

export class AudioEngine {
  constructor() {
    this._audioContext = null
    this._stream = null
    this._source = null
    this._processor = null
    this.running = false
    this._recordedSamples = []
    this._resampler = null
    this._frameProcessor = null
    this._frameCount = 0
  }

  async startRecording() {
    if (this.running) return
    this._recordedSamples = []

    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._audioContext = new AudioContext()
    await this._audioContext.resume()

    this._source = this._audioContext.createMediaStreamSource(this._stream)
    this._processor = this._audioContext.createScriptProcessor(1024, 1, 1)
    this._processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      this._recordedSamples.push(new Float32Array(input))
    }
    this._source.connect(this._processor)
    this._processor.connect(this._audioContext.destination)

    this.running = true
  }

  stopRecording() {
    this.running = false

    const sampleRate = this._audioContext ? this._audioContext.sampleRate : 44100

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

    const totalLen = this._recordedSamples.reduce((sum, c) => sum + c.length, 0)
    const samples = new Float32Array(totalLen)
    let offset = 0
    for (const chunk of this._recordedSamples) {
      samples.set(chunk, offset)
      offset += chunk.length
    }
    this._recordedSamples = []

    return { samples, sampleRate }
  }

  async startStream(onFrame) {
    if (this.running) return
    this._frameCount = 0

    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._audioContext = new AudioContext()
    await this._audioContext.resume()
    const inputRate = this._audioContext.sampleRate

    this._resampler = new Resampler(inputRate, 16000)
    this._frameProcessor = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    this._frameProcessor.onFrame = (frame) => {
      const f0 = detectPitch(frame.samples, frame.sampleRate)
      this._frameCount++
      onFrame(f0, this._frameCount * 0.01)
    }

    this._source = this._audioContext.createMediaStreamSource(this._stream)
    this._processor = this._audioContext.createScriptProcessor(1024, 1, 1)
    this._processor.onaudioprocess = (event) => {
      const resampled = this._resampler.process(event.inputBuffer.getChannelData(0))
      if (resampled.length > 0) {
        this._frameProcessor.push(resampled)
      }
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
    this._resampler = null
    this._frameProcessor = null
    this._frameCount = 0
  }

  analyzePcm(samples, sampleRate) {
    const resampler = new Resampler(sampleRate, 16000)
    const resampled = resampler.process(samples)

    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })

    const f0Data = []
    fp.onFrame = (frame) => {
      const f0 = detectPitch(frame.samples, frame.sampleRate)
      f0Data.push({ time: frame.time, f0 })
    }

    fp.push(resampled)
    fp.push(new Float32Array(400))

    const lastFrame = f0Data.length > 0 ? f0Data[f0Data.length - 1] : null
    const duration = lastFrame ? lastFrame.time + 0.01 : 0
    const voiced = f0Data.filter(d => d.f0 != null).length

    return {
      f0Data,
      sampleRate: 16000,
      duration,
      totalFrames: f0Data.length,
      voicedFrames: voiced,
    }
  }
}
