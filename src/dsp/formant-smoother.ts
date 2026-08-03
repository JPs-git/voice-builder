const JUMP_THRESHOLD = 300
const DEAD_ZONE = 50

type FormantKey = 'f0' | 'f1' | 'f2'

export interface SmootherFrame {
  time: number
  f0: number | null
  f1: number | null
  f2: number | null
  f3?: number | null
  f4?: number | null
  voiced?: boolean
  magnitudes?: Float32Array
  register?: import('../types').VoiceRegister | null
  registerConfidence?: number | null
}

export class FormantSmoother {
  private _windowSize: number
  private _buffers: Record<FormantKey, number[]>
  private _lastOutput: Partial<Record<FormantKey, number>>
  private _lastFrame: { f0: number; f1: number; f2: number } | undefined

  constructor(windowSize: number = 5) {
    this._windowSize = windowSize
    this._buffers = { f0: [], f1: [], f2: [] }
    this._lastOutput = {}
    this._lastFrame = undefined
  }

  push(frame: SmootherFrame): SmootherFrame {
    const out = { ...frame }
    for (const key of ['f0', 'f1', 'f2'] as FormantKey[]) {
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
      const keys: FormantKey[] = ['f0', 'f1', 'f2']
      let ordered = true
      for (let i = 0; i < keys.length - 1; i++) {
        const a = out[keys[i]] as number | null
        const b = out[keys[i + 1]] as number | null
        if (a != null && b != null && a >= b) {
          ordered = false
          break
        }
      }
      if (!ordered) {
        for (const key of keys) {
          if (frame[key] != null && out[key] !== frame[key]) {
            this._lastOutput[key] = frame[key] as number
          }
          out[key] = this._lastFrame[key]
        }
        return out
      }
    }

    for (const key of ['f0', 'f1', 'f2'] as FormantKey[]) {
      if (out[key] != null) this._lastOutput[key] = out[key] as number
    }
    if (out.f0 != null && out.f1 != null && out.f2 != null) {
      this._lastFrame = { f0: out.f0, f1: out.f1, f2: out.f2 }
    }
    return out
  }

  reset(): void {
    for (const key of Object.keys(this._buffers)) {
      this._buffers[key as FormantKey] = []
    }
    this._lastOutput = {}
    this._lastFrame = undefined
  }
}
