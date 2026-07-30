import { RingBuffer } from './RingBuffer'

export interface AudioEngineOptions {
  sampleRate?: number
  maxDurationSec?: number
}

export class AudioEngine {
  private _audioContext: AudioContext | null = null
  private _stream: MediaStream | null = null
  private _source: MediaStreamAudioSourceNode | null = null
  private _processor: ScriptProcessorNode | null = null
  private _ringBuffer: RingBuffer
  private _sampleRate: number
  private _maxDurationSec: number
  private _isStreaming: boolean = false

  constructor(options: AudioEngineOptions = {}) {
    this._sampleRate = options.sampleRate ?? 16000
    this._maxDurationSec = options.maxDurationSec ?? 10
    const capacity = this._sampleRate * this._maxDurationSec
    this._ringBuffer = new RingBuffer(capacity)
  }

  get sampleRate(): number { return this._sampleRate }
  get isStreaming(): boolean { return this._isStreaming }
  get audioContext(): AudioContext {
    if (!this._audioContext) {
      this._audioContext = new AudioContext({ sampleRate: this._sampleRate })
    }
    return this._audioContext
  }

  async startStream(onChunk: (chunk: Float32Array, rate: number) => void): Promise<void> {
    if (this._isStreaming) return

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._stream = stream

    const ctx = this.audioContext
    await ctx.resume()

    this._source = ctx.createMediaStreamSource(stream)
    this._processor = ctx.createScriptProcessor(1024, 1, 1)
    this._processor.onaudioprocess = (event) => {
      const chunk = event.inputBuffer.getChannelData(0)
      this._ringBuffer.write(chunk)
      onChunk(chunk, this._sampleRate)
    }
    this._source.connect(this._processor)
    this._processor.connect(ctx.destination)

    this._isStreaming = true
  }

  stopStream(): void {
    this._isStreaming = false
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

  getBuffer(): Float32Array {
    return this._ringBuffer.read()
  }

  importBuffer(samples: Float32Array): void {
    const maxSamples = this._sampleRate * this._maxDurationSec
    const data = samples.length > maxSamples
      ? samples.slice(0, maxSamples)
      : samples
    this._ringBuffer.clear()
    this._ringBuffer.write(data)
  }

  clear(): void {
    this._ringBuffer.clear()
  }

  destroy(): void {
    this.stopStream()
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
    this.clear()
  }
}
