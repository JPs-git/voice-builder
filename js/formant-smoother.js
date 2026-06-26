const JUMP_THRESHOLD = 300
const DEAD_ZONE = 50

export class FormantSmoother {
  constructor(windowSize = 5) {
    this._windowSize = windowSize
    this._buffers = { f0: [], f1: [], f2: [], f3: [], f4: [] }
    this._lastOutput = {}
    this._lastFrame = undefined
  }

  push(frame) {
    const out = { ...frame }
    for (const key of ['f0', 'f1', 'f2', 'f3', 'f4']) {
      const value = frame[key]
      if (value == null) {
        this._buffers[key] = []
        this._lastOutput[key] = undefined
        out[key] = null
        continue
      }

      const last = this._lastOutput[key]
      if (last !== undefined && Math.abs(value - last) > JUMP_THRESHOLD) {
        this._buffers[key].push(value)
        if (this._buffers[key].length > this._windowSize) {
          this._buffers[key].shift()
        }
        if (this._buffers[key].length >= this._windowSize) {
          const sorted = [...this._buffers[key]].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          out[key] = Math.abs(value - median) < DEAD_ZONE ? value : last
        } else {
          out[key] = last
        }
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
        const median = sorted[Math.floor(sorted.length / 2)]
        out[key] = Math.abs(value - median) < DEAD_ZONE ? value : median
      }
    }

    if (this._lastFrame !== undefined) {
      const keys = ['f0', 'f1', 'f2', 'f3', 'f4']
      let ordered = true
      for (let i = 0; i < keys.length - 1; i++) {
        const a = out[keys[i]]
        const b = out[keys[i + 1]]
        if (a != null && b != null && a >= b) {
          ordered = false
          break
        }
      }
      if (!ordered) {
        for (const key of keys) {
          if (frame[key] != null && out[key] !== frame[key]) {
            this._lastOutput[key] = frame[key]
          }
          out[key] = this._lastFrame[key]
        }
        return out
      }
    }

    for (const key of ['f0', 'f1', 'f2', 'f3', 'f4']) {
      if (out[key] != null) this._lastOutput[key] = out[key]
    }
    if (out.f0 != null && out.f1 != null && out.f2 != null && out.f3 != null && out.f4 != null) {
      this._lastFrame = { f0: out.f0, f1: out.f1, f2: out.f2, f3: out.f3, f4: out.f4 }
    }
    return out
  }

  reset() {
    for (const key of Object.keys(this._buffers)) {
      this._buffers[key] = []
    }
    this._lastOutput = {}
    this._lastFrame = undefined
  }
}
