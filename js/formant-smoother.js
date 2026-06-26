export class FormantSmoother {
  constructor(windowSize = 5) {
    this._windowSize = windowSize
    this._buffers = { f0: [], f1: [], f2: [], f3: [], f4: [] }
  }

  push(frame) {
    const out = { ...frame }
    for (const key of ['f0', 'f1', 'f2', 'f3', 'f4']) {
      const value = frame[key]
      if (value == null) {
        this._buffers[key] = []
        out[key] = null
        continue
      }
      this._buffers[key].push(value)
      if (this._buffers[key].length > this._windowSize) {
        this._buffers[key].shift()
      }
      if (this._buffers[key].length < this._windowSize) {
        out[key] = value
      } else {
        const sorted = [...this._buffers[key]].sort((a, b) => a - b)
        out[key] = sorted[Math.floor(sorted.length / 2)]
      }
    }
    return out
  }

  reset() {
    for (const key of Object.keys(this._buffers)) {
      this._buffers[key] = []
    }
  }
}
