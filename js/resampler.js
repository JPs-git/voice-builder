export class Resampler {
  constructor(inputRate, outputRate = 16000) {
    this.ratio = outputRate / inputRate
    this.buffer = new Float32Array(0)
  }

  process(input) {
    const combined = new Float32Array(this.buffer.length + input.length)
    combined.set(this.buffer, 0)
    combined.set(input, this.buffer.length)

    if (combined.length < 1) {
      return new Float32Array(0)
    }

    if (combined.length < Math.ceil(4 / this.ratio)) {
      this.buffer = combined
      return new Float32Array(0)
    }

    const outputLen = Math.ceil(combined.length * this.ratio) - 1
    const maxInterp = Math.ceil(combined.length * this.ratio)
    const output = new Float32Array(maxInterp)

    for (let i = 0; i < combined.length - 1; i++) {
      const startPos = i * this.ratio
      const endPos = (i + 1) * this.ratio
      const startIdx = Math.ceil(startPos)
      const endIdx = Math.ceil(endPos)

      for (let j = startIdx; j < endIdx && j < maxInterp; j++) {
        const pos = j / this.ratio
        const idx = Math.floor(pos)
        const frac = pos - idx
        if (idx + 1 < combined.length) {
          output[j] = combined[idx] + frac * (combined[idx + 1] - combined[idx])
        }
      }
    }

    const consumed = Math.floor(outputLen / this.ratio)
    this.buffer = combined.slice(consumed)

    return output.slice(0, outputLen)
  }
}
