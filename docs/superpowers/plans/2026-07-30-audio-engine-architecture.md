# Audio Engine 架构重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 TypeScript 重构 AudioEngine，拆分 RingBuffer、AudioEngine 类、单例、usePlayback hook

**Architecture:** RingBuffer 负责固定容量环形缓冲区，AudioEngine 管理 AudioContext/Mic/Stream，单例通过模块级 `let instance` 实现，Playback 封装为 React Hook

**Tech Stack:** TypeScript, Vitest, React Hooks

---

## 文件结构

**新增:**
- `src/ts/RingBuffer.ts` — 纯数据类，固定容量环形缓冲区
- `src/ts/AudioEngine.ts` — 音频引擎，AudioContext + Mic 流 + RingBuffer
- `src/ts/index.ts` — 导出 `getAudioEngine()` / `resetAudioEngine()`
- `src/hooks/usePlayback.ts` — React Hook，封装播放控制
- `src/__tests__/RingBuffer.test.ts` — RingBuffer 单元测试
- `src/__tests__/AudioEngine.test.ts` — AudioEngine 单元测试
- `src/__tests__/usePlayback.test.ts` — usePlayback 单元测试

**删除:**
- `js/audio-engine.js`

**修改:**
- `src/routes/AnalysisPage.tsx` — 使用新 API

---

### Task 1: RingBuffer

**Files:**
- Create: `src/ts/RingBuffer.ts`
- Test: `src/__tests__/RingBuffer.test.ts`

- [ ] **Step 1: Write RingBuffer failing test**

```typescript
// src/__tests__/RingBuffer.test.ts
import { describe, it, expect } from 'vitest'
import { RingBuffer } from '../ts/RingBuffer'

describe('RingBuffer', () => {
  it('writes and reads less than capacity', () => {
    const buf = new RingBuffer(10)
    buf.write(new Float32Array([1, 2, 3]))
    const result = buf.read()
    expect(result.length).toBe(3)
    expect(Array.from(result)).toEqual([1, 2, 3])
  })

  it('writes exactly to capacity', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3, 4, 5]))
    expect(Array.from(buf.read())).toEqual([1, 2, 3, 4, 5])
  })

  it('drops oldest data when over capacity', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3]))
    buf.write(new Float32Array([4, 5, 6, 7]))
    // kept: [3, 4, 5, 6, 7]
    expect(Array.from(buf.read())).toEqual([3, 4, 5, 6, 7])
  })

  it('wraps around correctly across multiple writes', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3, 4]))
    buf.write(new Float32Array([5, 6, 7, 8, 9]))
    // kept: last 5 [5,6,7,8,9]
    expect(Array.from(buf.read())).toEqual([5, 6, 7, 8, 9])
    buf.write(new Float32Array([10, 11]))
    // kept: last 5 [7,8,9,10,11]
    expect(Array.from(buf.read())).toEqual([7, 8, 9, 10, 11])
  })

  it('handles write larger than total capacity', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]))
    // kept: [4,5,6,7,8]
    expect(Array.from(buf.read())).toEqual([4, 5, 6, 7, 8])
  })

  it('returns empty array when no data written', () => {
    const buf = new RingBuffer(10)
    expect(buf.read().length).toBe(0)
  })

  it('clears buffer', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3]))
    buf.clear()
    expect(buf.read().length).toBe(0)
    expect(buf.size).toBe(0)
  })

  it('reports correct size and capacity', () => {
    const buf = new RingBuffer(5)
    expect(buf.capacity).toBe(5)
    expect(buf.size).toBe(0)
    buf.write(new Float32Array([1, 2, 3]))
    expect(buf.size).toBe(3)
    buf.write(new Float32Array([4, 5, 6]))
    expect(buf.size).toBe(5)
  })

  it('read returns a copy, not a reference', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3]))
    const a = buf.read()
    const b = buf.read()
    a[0] = 99
    expect(b[0]).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/RingBuffer.test.ts`
Expected: FAIL with "RingBuffer is not defined" (file doesn't exist yet)

- [ ] **Step 3: Write RingBuffer implementation**

```typescript
// src/ts/RingBuffer.ts
export class RingBuffer {
  private buffer: Float32Array
  private _capacity: number
  private writePos: number = 0

  constructor(capacity: number) {
    this._capacity = capacity
    this.buffer = new Float32Array(capacity)
  }

  get capacity(): number {
    return this._capacity
  }

  get size(): number {
    return Math.min(this.writePos, this._capacity)
  }

  write(samples: Float32Array): void {
    let offset = 0
    while (offset < samples.length) {
      const idx = this.writePos % this._capacity
      const available = this._capacity - idx
      const toWrite = Math.min(samples.length - offset, available)
      this.buffer.set(samples.subarray(offset, offset + toWrite), idx)
      this.writePos += toWrite
      offset += toWrite
    }
  }

  read(): Float32Array {
    const size = this.size
    if (size === 0) return new Float32Array(0)
    if (this.writePos < this._capacity) {
      return this.buffer.slice(0, size)
    }
    const idx = this.writePos % this._capacity
    const result = new Float32Array(this._capacity)
    const firstPart = this._capacity - idx
    result.set(this.buffer.subarray(idx))
    result.set(this.buffer.subarray(0, idx), firstPart)
    return result
  }

  clear(): void {
    this.buffer.fill(0)
    this.writePos = 0
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/RingBuffer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ts/RingBuffer.ts src/__tests__/RingBuffer.test.ts
git commit -m "feat: add RingBuffer class"
```

---

### Task 2: AudioEngine

**Files:**
- Create: `src/ts/AudioEngine.ts`
- Create: `src/ts/index.ts`
- Test: `src/__tests__/AudioEngine.test.ts`

- [ ] **Step 1: Write AudioEngine test (failing)**

```typescript
// src/__tests__/AudioEngine.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AudioEngine } from '../ts/AudioEngine'

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    engine = new AudioEngine({ sampleRate: 16000, maxDurationSec: 10 })
  })

  afterEach(() => {
    engine.destroy()
  })

  it('initializes with default sample rate', () => {
    expect(engine.sampleRate).toBe(16000)
  })

  it('importBuffer stores samples truncated to maxDuration', () => {
    const samples = new Float32Array(160000) // 10 seconds
    samples.fill(0.5)
    engine.importBuffer(samples)
    expect(engine.getBuffer().length).toBe(160000)
  })

  it('importBuffer truncates samples longer than maxDuration', () => {
    const samples = new Float32Array(200000) // > 10 seconds
    samples.fill(0.5)
    engine.importBuffer(samples)
    expect(engine.getBuffer().length).toBe(160000)
  })

  it('importBuffer replaces previous buffer content', () => {
    engine.importBuffer(new Float32Array(100).fill(0.1))
    expect(engine.getBuffer().length).toBe(100)
    engine.importBuffer(new Float32Array(200).fill(0.2))
    expect(engine.getBuffer().length).toBe(200)
  })

  it('clear empties the buffer', () => {
    engine.importBuffer(new Float32Array(100).fill(0.5))
    engine.clear()
    expect(engine.getBuffer().length).toBe(0)
  })

  it('isStreaming is false initially', () => {
    expect(engine.isStreaming).toBe(false)
  })

  it('getBuffer returns a copy', () => {
    engine.importBuffer(new Float32Array([1, 2, 3]))
    const a = engine.getBuffer()
    const b = engine.getBuffer()
    a[0] = 99
    expect(b[0]).toBe(1)
  })

  it('startStream rejects if no getUserMedia (server-side test)', async () => {
    await expect(engine.startStream(() => {})).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AudioEngine.test.ts`
Expected: FAIL (file doesn't exist yet)

- [ ] **Step 3: Write AudioEngine implementation**

```typescript
// src/ts/AudioEngine.ts
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
```

- [ ] **Step 4: Create singleton index.ts**

```typescript
// src/ts/index.ts
import { AudioEngine, type AudioEngineOptions } from './AudioEngine'

export { AudioEngine, type AudioEngineOptions }

let instance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!instance) {
    instance = new AudioEngine()
  }
  return instance
}

export function resetAudioEngine(): void {
  instance?.destroy()
  instance = null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AudioEngine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ts/AudioEngine.ts src/ts/index.ts src/__tests__/AudioEngine.test.ts
git commit -m "feat: add AudioEngine class and singleton export"
```

---

### Task 3: usePlayback hook

**Files:**
- Create: `src/hooks/usePlayback.ts`
- Test: `src/__tests__/usePlayback.test.ts`

- [ ] **Step 1: Write usePlayback failing test**

```typescript
// src/__tests__/usePlayback.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayback } from '../hooks/usePlayback'
import { getAudioEngine, resetAudioEngine } from '../ts'

describe('usePlayback', () => {
  beforeEach(() => {
    resetAudioEngine()
  })

  it('returns play/stop functions and isPlaying state', () => {
    const { result } = renderHook(() => usePlayback())
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.stop).toBe('function')
    expect(result.current.isPlaying).toBe(false)
  })

  it('play does nothing when buffer is empty', () => {
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('stop after play sets isPlaying to false', () => {
    const ae = getAudioEngine()
    ae.importBuffer(new Float32Array([0.1, 0.2, 0.3]))
    const { result } = renderHook(() => usePlayback())
    // can't actually play without AudioContext, but stop should work
    act(() => { result.current.stop() })
    expect(result.current.isPlaying).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/usePlayback.test.ts`
Expected: FAIL (usePlayback not found)

- [ ] **Step 3: Write usePlayback implementation**

```typescript
// src/hooks/usePlayback.ts
import { useState, useRef, useCallback } from 'react'
import { getAudioEngine } from '../ts'

export function usePlayback() {
  const [isPlaying, setIsPlaying] = useState(false)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const totalDurationRef = useRef(0)

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const play = useCallback((onProgress?: (elapsed: number) => void, onEnd?: () => void) => {
    const ae = getAudioEngine()
    const audioCtx = ae.audioContext
    const samples = ae.getBuffer()
    if (samples.length === 0) return

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    audioCtx.resume()
    const buffer = audioCtx.createBuffer(1, samples.length, ae.sampleRate)
    buffer.getChannelData(0).set(samples)

    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(audioCtx.destination)

    const totalDuration = samples.length / ae.sampleRate
    totalDurationRef.current = totalDuration
    startTimeRef.current = audioCtx.currentTime

    source.onended = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      sourceRef.current = null
      setIsPlaying(false)
      if (onEnd) onEnd()
    }

    source.start()
    sourceRef.current = source
    setIsPlaying(true)

    const tick = () => {
      if (!sourceRef.current) return
      const elapsed = Math.min(audioCtx.currentTime - startTimeRef.current, totalDuration)
      if (onProgress) onProgress(elapsed)
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [stop])

  return { play, stop, isPlaying }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/usePlayback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePlayback.ts src/__tests__/usePlayback.test.ts
git commit -m "feat: add usePlayback hook"
```

---

### Task 4: Migrate AnalysisPage.tsx

**Files:**
- Modify: `src/routes/AnalysisPage.tsx`
- Delete: `js/audio-engine.js`

- [ ] **Step 1: Update imports in AnalysisPage.tsx**

Replace:
```typescript
import { AudioEngine } from '../../js/audio-engine.js'
```
With:
```typescript
import { getAudioEngine } from '../ts'
import { usePlayback } from '../hooks/usePlayback'
```

Remove unused import:
```typescript
import { parseWav } from '../../js/wav-parser.js'
import { Resampler } from '../../js/resampler.js'
```
(These are used in `onWavSelected`, keep them)

- [ ] **Step 2: Remove `audioRef` ref and initialization**

Remove:
```typescript
const audioRef = useRef<InstanceType<typeof AudioEngine> | null>(null)
// ...
useEffect(() => {
  audioRef.current = new AudioEngine()
}, [])
```

Add hook call:
```typescript
const { play: startPlayback, stop: stopPlayback, isPlaying } = usePlayback()
```

- [ ] **Step 3: Replace all `audioRef.current` references with `getAudioEngine()`**

Every `audioRef.current!.xxx` becomes `getAudioEngine().xxx`:

| Old | New |
|---|---|
| `audioRef.current?.xxx` | `getAudioEngine().xxx` |
| `const ae = audioRef.current; if (!ae) return` | `const ae = getAudioEngine()` |
| `ae.startStream(...)` | `ae.startStream(...)` (no change) |
| `ae.stopStream()` | `ae.stopStream()` (no change) |
| `ae.clearRecordedBuffer()` | `ae.clear()` |
| `ae.setImportedBuffer(samples)` | `ae.importBuffer(samples)` |
| `ae.isPlaying` | `isPlaying` (from hook) |
| `ae.startPlayback(...)` | `startPlayback(...)` (from hook) |
| `ae.stopPlayback()` | `stopPlayback()` (from hook) |
| `(ae as any)._recordingSampleRate` | `ae.sampleRate` |
| `ae.trimBufferToDuration(...)` | **remove** (RingBuffer handles this) |
| `ae.getRecordedBuffer()` | `ae.getBuffer()` |

- [ ] **Step 4: Replace `setIsPlaying` local state with hook's `isPlaying`**

Remove local state `const [isPlaying, setIsPlaying] = useState(false)` and all `setIsPlaying(...)` calls — use `isPlaying` from `usePlayback` instead.

- [ ] **Step 5: Update `onPlayback` callback**

Old:
```typescript
const onPlayback = useCallback(() => {
    const ae = audioRef.current
    if (!ae) return
    if (ae.isPlaying) {
      ae.stopPlayback()
      f0Ref.current?.setCursorTime(-1)
      formantRef.current?.setCursorTime(-1)
      setIsPlaying(false)
      return
    }
    // ...phase handling...
    ae.startPlayback(
      (elapsed) => { f0Ref.current?.setCursorTime(elapsed + firstTime) },
      () => { f0Ref.current?.setCursorTime(-1); formantRef.current?.setCursorTime(-1); setIsPlaying(false) }
    )
    setIsPlaying(true)
  }, [...])
```

New:
```typescript
const onPlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback()
      f0Ref.current?.setCursorTime(-1)
      formantRef.current?.setCursorTime(-1)
      return
    }
    if (state.phase === 'recording') {
      getAudioEngine().stopStream()
      if (pipelineRef.current) {
        pipelineRef.current.flush()
        const totalFrames = state.frameCount + pipelineRef.current.frameCount
        dispatch({ type: 'SET_FRAME_COUNT', count: totalFrames })
        pipelineRef.current.reset()
        pipelineRef.current = null
      }
      if (sessionFramesRef.current.length > WINDOW_FRAMES) {
        sessionFramesRef.current.splice(0, sessionFramesRef.current.length - WINDOW_FRAMES)
      }
      dispatch({ type: 'SET_PHASE', phase: 'paused' })
    }
    const firstTime = sessionFramesRef.current[0]?.time ?? 0
    startPlayback(
      (elapsed) => {
        f0Ref.current?.setCursorTime(elapsed + firstTime)
        formantRef.current?.setCursorTime(elapsed + firstTime)
      },
      () => {
        f0Ref.current?.setCursorTime(-1)
        formantRef.current?.setCursorTime(-1)
      }
    )
  }, [isPlaying, state.phase, state.frameCount, dispatch, startPlayback, stopPlayback])
```

- [ ] **Step 6: Update `clearAll` callback**

Old:
```typescript
const clearAll = useCallback(() => {
    const ae = audioRef.current
    if (!ae) return
    pipelineRef.current?.reset()
    pipelineRef.current = null
    ae.stopPlayback()
    setIsPlaying(false)
    ae.stopStream()
    ae.clearRecordedBuffer()
    // ...
  }, [dispatch])
```

New:
```typescript
const clearAll = useCallback(() => {
    const ae = getAudioEngine()
    pipelineRef.current?.reset()
    pipelineRef.current = null
    stopPlayback()
    ae.stopStream()
    ae.clear()
    f0Ref.current?.clear()
    formantRef.current?.clear()
    f0Ref.current?.setCursorTime(-1)
    formantRef.current?.setCursorTime(-1)
    sessionFramesRef.current = []
    dispatch({ type: 'RESET' })
  }, [dispatch, stopPlayback])
```

- [ ] **Step 7: Update `onRecord` callback**

Old references to `ae.isPlaying` → `isPlaying`, `ae.stopPlayback()` → `stopPlayback()`
Old `ae.clearRecordedBuffer()` → `ae.clear()`

- [ ] **Step 8: Update `onWavSelected` callback**

Old:
```typescript
ae.setImportedBuffer(samples)
;(ae as any)._recordingSampleRate = rate
```

New:
```typescript
ae.importBuffer(samples)
// importBuffer uses engine's sampleRate (16000), no need to set separately
```

Remove `trimBufferToDuration` call and the MAX_SAMPLES check if it duplicates importBuffer's truncation (keep the alert for user feedback though).

- [ ] **Step 9: Remove old js/audio-engine.js**

```bash
git rm js/audio-engine.js
```

- [ ] **Step 10: Run all tests**

Run: `npm test`
Expected: PASS (all DSP tests + React tests)

- [ ] **Step 11: Commit**

```bash
git add src/routes/AnalysisPage.tsx
git rm js/audio-engine.js
git commit -m "refactor: migrate AnalysisPage to new AudioEngine API"
```

---

## Self-Review Checklist

1. **Spec coverage:** All spec requirements covered — RingBuffer (Task 1), AudioEngine class (Task 2), singleton pattern (Task 2 Step 4), usePlayback hook (Task 3), AnalysisPage migration (Task 4), delete old file (Task 4 Step 9).
2. **Placeholder scan:** No TBDs, TODOs, or incomplete sections.
3. **Type consistency:** `RingBuffer.read()` returns `Float32Array` consistently; `AudioEngine.getBuffer()` returns `Float32Array`; `usePlayback.play()` accepts optional callbacks matching old API.
4. **Scope check:** Single subsystem (audio engine). Appropriate for one plan.
