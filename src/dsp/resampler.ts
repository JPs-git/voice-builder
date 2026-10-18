export class Resampler {
  private ratio: number
  private buffer: Float32Array
  private inputLength = 0
  private outputIndex = 0

  constructor(inputRate: number, outputRate: number = 16000) {
    if (!Number.isFinite(inputRate) || inputRate <= 0) {
      throw new Error(`Invalid inputRate: ${inputRate}`)
    }
    this.ratio = outputRate / inputRate
    this.buffer = new Float32Array(0)
  }

  reset(): void {
    this.buffer = new Float32Array(0)
    this.inputLength = 0
    this.outputIndex = 0
  }

  process(input: Float32Array): Float32Array {
    if (input.length === 0) return new Float32Array(0)
    const bufferStart = this.inputLength - this.buffer.length
    this.inputLength += input.length
    const combined = new Float32Array(this.buffer.length + input.length)
    combined.set(this.buffer, 0)
    combined.set(input, this.buffer.length)

    if (combined.length < 1) {
      return new Float32Array(0)
    }

    if (this.ratio === 1) {
      this.buffer = new Float32Array(0)
      return combined
    }

    const capacity = Math.max(0, Math.ceil(this.inputLength * this.ratio) - this.outputIndex)
    const output = new Float32Array(capacity)
    let count = 0
    // Derive every position from absolute output index. Re-basing the phase at
    // each input chunk changes both interpolation values and output duration.
    while (count < capacity) {
      const position = this.outputIndex / this.ratio
      const left = Math.floor(position)
      const fraction = position - left
      if (left >= this.inputLength || (fraction > 0 && left + 1 >= this.inputLength)) break
      const local = left - bufferStart
      const a = combined[local]
      output[count++] = fraction === 0 ? a : a + fraction * (combined[local + 1] - a)
      this.outputIndex++
    }
    const consumed = Math.min(combined.length, Math.floor(this.outputIndex / this.ratio) - bufferStart)
    this.buffer = combined.slice(consumed)

    return output.slice(0, count)
  }
}
