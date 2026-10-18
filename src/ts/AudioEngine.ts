export interface AudioEngineOptions {
  sampleRate?: number
}

export class AudioEngine {
  private _audioContext: AudioContext | null = null
  private _stream: MediaStream | null = null
  private _source: MediaStreamAudioSourceNode | null = null
  private _processor: ScriptProcessorNode | null = null
  private _silentGain: GainNode | null = null
  private _sampleRate: number
  private _isCapturing: boolean = false
  private _captureGeneration = 0

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

  async startCapture(onChunk: (chunk: Float32Array, rate: number) => void, signal?: AbortSignal): Promise<void> {
    if (this._isCapturing) return
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
    const generation = ++this._captureGeneration
    let stream: MediaStream | null = null
    const current = () => generation === this._captureGeneration && !signal?.aborted
    const abort = () => { if (generation === this._captureGeneration) this.stopCapture() }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      // Disable browser processing to preserve the original voice signal.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      if (!current()) throw new DOMException('已取消', 'AbortError')
      const ctx = this.audioContext
      await ctx.resume()
      if (!current()) throw new DOMException('已取消', 'AbortError')
      this._stream = stream
      this._source = ctx.createMediaStreamSource(stream)
      this._processor = ctx.createScriptProcessor(1024, 1, 1)
      this._processor.onaudioprocess = event => {
        if (current()) onChunk(event.inputBuffer.getChannelData(0), ctx.sampleRate)
      }
      this._source.connect(this._processor)
      const silentGain = ctx.createGain()
      silentGain.gain.value = 0
      this._processor.connect(silentGain)
      silentGain.connect(ctx.destination)
      this._silentGain = silentGain
      this._isCapturing = true
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop())
      if (generation === this._captureGeneration) this.stopCapture()
      throw error
    } finally {
      signal?.removeEventListener('abort', abort)
    }
  }

  stopCapture(): void {
    this._captureGeneration++
    this._isCapturing = false
    if (this._processor) {
      this._processor.disconnect()
      this._processor = null
    }
    if (this._silentGain) {
      this._silentGain.disconnect()
      this._silentGain = null
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

  createPlaybackSource(samples: Float32Array, sampleRate: number = this._sampleRate): {
    source: AudioBufferSourceNode
    totalDuration: number
  } {
    const ctx = this.audioContext
    ctx.resume()
    const buffer = ctx.createBuffer(1, samples.length, sampleRate)
    buffer.getChannelData(0).set(samples)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    return {
      source,
      totalDuration: samples.length / sampleRate,
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
