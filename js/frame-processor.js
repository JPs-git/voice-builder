export class FrameProcessor {
  constructor({ sampleRate = 16000, frameSize = 400, hopSize = 160 } = {}) {
    this.sampleRate = sampleRate
    this.frameSize = frameSize
    this.hopSize = hopSize
    this.buffer = new Float32Array(0)
    this.onFrame = null
  }

  push(input) {
    const combined = new Float32Array(this.buffer.length + input.length)
    combined.set(this.buffer, 0)
    combined.set(input, this.buffer.length)

    let offset = 0
    const framesToExtract = []

    while (offset + this.frameSize <= combined.length) {
      const frame = new Float32Array(this.frameSize)
      for (let i = 0; i < this.frameSize; i++) {
        frame[i] = combined[offset + i]
      }
      framesToExtract.push({
        samples: frame,
        time: offset / this.sampleRate,
        sampleRate: this.sampleRate,
      })
      offset += this.hopSize
    }

    this.buffer = combined.slice(offset)

    if (this.onFrame) {
      for (const f of framesToExtract) {
        this.onFrame(f)
      }
    }

    return framesToExtract
  }

  reset() {
    this.buffer = new Float32Array(0)
  }
}
