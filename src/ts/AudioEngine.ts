export interface AudioEngineOptions {
  sampleRate?: number
}

export class AudioEngine {
  private _audioContext: AudioContext | null = null
  private _stream: MediaStream | null = null
  private _source: MediaStreamAudioSourceNode | null = null
  private _processor: ScriptProcessorNode | null = null
  private _sampleRate: number
  private _isCapturing: boolean = false

  constructor(options: AudioEngineOptions = {}) {
    this._sampleRate = options.sampleRate ?? 16000
  }

  get sampleRate(): number { return this._sampleRate }
  get isCapturing(): boolean { return this._isCapturing }
  get audioContext(): AudioContext {
    if (!this._audioContext) {
      this._audioContext = new AudioContext({ sampleRate: this._sampleRate })
    }
    return this._audioContext
  }

  async startCapture(onChunk: (chunk: Float32Array, rate: number) => void): Promise<void> {
    if (this._isCapturing) return

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._stream = stream

    const ctx = this.audioContext
    await ctx.resume()

    this._source = ctx.createMediaStreamSource(stream)
    this._processor = ctx.createScriptProcessor(1024, 1, 1)
    this._processor.onaudioprocess = (event) => {
      const chunk = event.inputBuffer.getChannelData(0)
      onChunk(chunk, ctx.sampleRate)
    }
    this._source.connect(this._processor)

    this._isCapturing = true
  }

  stopCapture(): void {
    this._isCapturing = false
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

  createPlaybackSource(samples: Float32Array): {
    source: AudioBufferSourceNode
    totalDuration: number
  } {
    const ctx = this.audioContext
    ctx.resume()
    const buffer = ctx.createBuffer(1, samples.length, this._sampleRate)
    buffer.getChannelData(0).set(samples)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    return {
      source,
      totalDuration: samples.length / this._sampleRate,
    }
  }

  destroy(): void {
    this.stopCapture()
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
  }
}
