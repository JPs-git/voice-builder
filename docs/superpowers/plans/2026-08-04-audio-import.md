# 支持 MP3 / M4A 等压缩音频导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `useAnalysis.handleFileChange` so users can import MP3 / M4A (or any browser-decodable audio) for analysis, plus early 10s-length abort before full decode and a stereo channel-0 notice.

**Architecture:** Add `src/audio/audioDecoder.ts` with two injectable helpers: `probeAudioDuration(file)` reads container metadata via an `<audio>` element (rejects >10s before full decode, the "no thread occupation" requirement), and `decodeAudioFile(arrayBuffer)` uses `AudioContext.decodeAudioData` to produce PCM `Float32Array + sampleRate` (same shape as `parseWav`). `useAnalysis.handleFileChange` branches: WAV keeps the existing fast `parseWav` path; non-WAV goes probe → decode → resample. Both converge on shared commit logic. UI accepts `audio/*` and the import button says 「导入音频」.

**Tech Stack:** TypeScript, React 19, Zustand (`useAppStore`/`useToastStore`), Vitest + @testing-library/react (jsdom project), Web Audio API (`AudioContext.decodeAudioData`, `HTMLAudioElement`).

**Reference spec:** `docs/superpowers/specs/2026-08-04-audio-import-design.md`

---

## File Structure

- **Create** `src/audio/audioDecoder.ts` — `DecodedAudio` type, `AudioTooLongError`, `probeAudioDuration`, `decodeAudioFile`
- **Create** `src/__tests__/audioDecoder.test.ts` — unit tests (jsdom project)
- **Create** `src/__tests__/useAnalysis.test.ts` — `handleFileChange` WAV / non-WAV / too-long / stereo / unsupported tests
- **Modify** `src/hooks/useAnalysis.ts` — add `isImporting`, `commitImport`, refactor `handleFileChange`, extend `importErrorMessage`
- **Modify** `src/routes/AnalysisPage.tsx` — file input `accept=".wav"` → `accept="audio/*"`
- **Modify** `src/hooks/useToolbar.ts` — import button label「导入 WAV」→「导入音频」

**jsdom note (verified):** jsdom 25 has `Audio` and `DOMException`, but `URL.createObjectURL` / `revokeObjectURL` are `undefined`. Tests stub `URL` via `vi.stubGlobal`. `probeAudioDuration` and `useAnalysis` tests inject fake elements / mock modules respectively, so the real `new Audio()` default param is never evaluated under jsdom.

---

### Task 1: audioDecoder tests (TDD red)

**Files:**
- Test: `src/__tests__/audioDecoder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/audioDecoder.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioTooLongError, decodeAudioFile, probeAudioDuration } from '../audio/audioDecoder'

function stubUrl() {
  const createObjectURL = vi.fn(() => 'blob:fake')
  const revokeObjectURL = vi.fn()
  const url = globalThis.URL
  vi.stubGlobal('URL', { ...url, createObjectURL, revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

function fakeEl(duration: number) {
  return {
    preload: '',
    src: '',
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    duration,
  }
}

describe('probeAudioDuration', () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let el: ReturnType<typeof fakeEl>

  beforeEach(() => {
    const spies = stubUrl()
    revokeObjectURL = spies.revokeObjectURL
    el = fakeEl(8)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets preload=metadata and resolves with duration on loadedmetadata', async () => {
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement)
    expect(el.preload).toBe('metadata')
    expect(el.src).toBe('blob:fake')
    el.onloadedmetadata!()
    await expect(promise).resolves.toBe(8)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('rejects when metadata loading fails', async () => {
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement)
    el.onerror!()
    await expect(promise).rejects.toThrow(/Failed to load audio metadata/)
  })

  it('rejects when duration is not finite', async () => {
    el.duration = NaN
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement)
    el.onloadedmetadata!()
    await expect(promise).rejects.toThrow(/Failed to read audio duration/)
  })
})

describe('decodeAudioFile', () => {
  it('extracts channel 0 samples, sample rate, and channel count', async () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    const context = {
      decodeAudioData: vi.fn(async () => ({
        getChannelData: vi.fn((ch: number) => (ch === 0 ? samples : samples)),
        sampleRate: 44100,
        numberOfChannels: 2,
      })),
    } as unknown as AudioContext

    const result = await decodeAudioFile(new ArrayBuffer(8), context)
    expect(result.samples).toBe(samples)
    expect(result.sampleRate).toBe(44100)
    expect(result.numChannels).toBe(2)
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('propagates decode failures', async () => {
    const context = {
      decodeAudioData: vi.fn(async () => {
        throw new DOMException('Failed to decode audio data', 'EncodingError')
      }),
    } as unknown as AudioContext

    await expect(decodeAudioFile(new ArrayBuffer(8), context)).rejects.toThrow()
  })
})

describe('AudioTooLongError', () => {
  it('is an Error subclass', () => {
    expect(new AudioTooLongError()).toBeInstanceOf(Error)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/audioDecoder.test.ts`
Expected: FAIL — module `../audio/audioDecoder` does not exist / `Failed to resolve import`.

---

### Task 2: audioDecoder implementation

**Files:**
- Create: `src/audio/audioDecoder.ts`

- [ ] **Step 1: Write the implementation**

Create `src/audio/audioDecoder.ts`:

```ts
import { getAudioEngine } from '../ts'

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
  numChannels: number
}

export class AudioTooLongError extends Error {
  constructor() {
    super('AudioTooLongError')
    this.name = 'AudioTooLongError'
  }
}

// Reads container metadata only (via an <audio> element) — does NOT full-decode.
// Pass `el` (e.g. a real Audio) only in tests; default constructs a new Audio.
export function probeAudioDuration(
  file: Blob,
  el: HTMLAudioElement = new Audio(),
): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = el.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Failed to read audio duration'))
      } else {
        resolve(duration)
      }
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load audio metadata'))
    }
    el.src = url
  })
}

// Full decode: AudioContext.decodeAudioData → Float32Array PCM (channel 0).
// Pass `context` only in tests; defaults to the AudioEngine singleton context.
export async function decodeAudioFile(
  arrayBuffer: ArrayBuffer,
  context: AudioContext = getAudioEngine().audioContext,
): Promise<DecodedAudio> {
  const buffer = await context.decodeAudioData(arrayBuffer)
  return {
    samples: buffer.getChannelData(0),
    sampleRate: buffer.sampleRate,
    numChannels: buffer.numberOfChannels,
  }
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/__tests__/audioDecoder.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/audio/audioDecoder.ts src/__tests__/audioDecoder.test.ts
git commit -m "feat(import): add audioDecoder (probeAudioDuration + decodeAudioData)"
```

---

### Task 3: useAnalysis handleFileChange tests (TDD red)

**Files:**
- Test: `src/__tests__/useAnalysis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/useAnalysis.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { recordingBuffer } from '../audio/recordingBuffer'

const mocks = vi.hoisted(() => ({
  isWavFile: vi.fn(),
  parseWav: vi.fn(),
  analyze: vi.fn(),
  probeAudioDuration: vi.fn(),
  decodeAudioFile: vi.fn(),
}))

vi.mock('../dsp', () => ({
  isWavFile: mocks.isWavFile,
  parseWav: mocks.parseWav,
  Resampler: class { process(x: Float32Array) { return x } },
  AnalysisPipeline: class { static analyze(...a: unknown[]) { return mocks.analyze(...a) } },
}))

vi.mock('../audio/audioDecoder', () => ({
  AudioTooLongError: class AudioTooLongError extends Error {},
  probeAudioDuration: mocks.probeAudioDuration,
  decodeAudioFile: mocks.decodeAudioFile,
}))

function wavFile() {
  return {
    slice: vi.fn(() => ({ arrayBuffer: async () => new ArrayBuffer(12) })),
    arrayBuffer: async () => new ArrayBuffer(1024),
  }
}

function nonWavFile() {
  return {
    slice: vi.fn(() => ({ arrayBuffer: async () => new ArrayBuffer(12) })),
    arrayBuffer: async () => new ArrayBuffer(1024),
  }
}

function toastMessages() {
  return useToastStore.getState().toasts.map((t) => t.message)
}

beforeEach(() => {
  useAppStore.getState().reset()
  useToastStore.setState({ toasts: [] })
  recordingBuffer.clear()
  vi.clearAllMocks()
})

describe('handleFileChange', () => {
  it('routes WAV files through parseWav', async () => {
    mocks.isWavFile.mockReturnValue(true)
    mocks.parseWav.mockReturnValue({ samples: new Float32Array([0.1, 0.2]), sampleRate: 16000, numChannels: 1 })
    mocks.analyze.mockReturnValue([{ time: 0, f0: 220 }])

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [wavFile()] } } as never)
    })

    expect(mocks.parseWav).toHaveBeenCalled()
    expect(mocks.probeAudioDuration).not.toHaveBeenCalled()
    expect(mocks.analyze).toHaveBeenCalled()
    expect(useAppStore.getState().frames).toHaveLength(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('shows a stereo notice when numChannels > 1', async () => {
    mocks.isWavFile.mockReturnValue(true)
    mocks.parseWav.mockReturnValue({ samples: new Float32Array([0.1]), sampleRate: 16000, numChannels: 2 })
    mocks.analyze.mockReturnValue([])

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [wavFile()] } } as never)
    })

    expect(toastMessages()).toContain('该音频为双声道，仅使用第 0 声道进行分析')
  })

  it('routes non-WAV files through probeAudioDuration then decodeAudioFile', async () => {
    mocks.isWavFile.mockReturnValue(false)
    mocks.probeAudioDuration.mockResolvedValue(5)
    mocks.decodeAudioFile.mockResolvedValue({ samples: new Float32Array([0.1, 0.2]), sampleRate: 16000, numChannels: 1 })
    mocks.analyze.mockReturnValue([])

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [nonWavFile()] } } as never)
    })

    expect(mocks.probeAudioDuration).toHaveBeenCalled()
    expect(mocks.decodeAudioFile).toHaveBeenCalled()
    expect(mocks.analyze).toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('rejects >10s audio before decoding or analyzing', async () => {
    mocks.isWavFile.mockReturnValue(false)
    mocks.probeAudioDuration.mockResolvedValue(15)

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [nonWavFile()] } } as never)
    })

    expect(mocks.decodeAudioFile).not.toHaveBeenCalled()
    expect(mocks.analyze).not.toHaveBeenCalled()
    expect(useAppStore.getState().frames).toHaveLength(0)
    expect(toastMessages()).toContain('音频不能超过 10 秒，请裁剪后重试')
  })

  it('shows browser-unsupported toast when decodeAudioData fails', async () => {
    mocks.isWavFile.mockReturnValue(false)
    mocks.probeAudioDuration.mockResolvedValue(5)
    mocks.decodeAudioFile.mockRejectedValue(new DOMException('Failed to decode audio data', 'EncodingError'))

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [nonWavFile()] } } as never)
    })

    expect(toastMessages()).toContain('浏览器不支持该音频格式或文件已损坏，请尝试 wav/mp3/m4a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/useAnalysis.test.ts`
Expected: FAIL — current `handleFileChange` reads the full file then rejects non-WAV with「不支持的文件格式」, so non-WAV / too-long / unsupported tests fail and no stereo notice is emitted.

---

### Task 4: useAnalysis refactor

**Files:**
- Modify: `src/hooks/useAnalysis.ts`

- [ ] **Step 1: Replace imports & message mapping**

Edit `src/hooks/useAnalysis.ts`:

Replace the `importErrorMessage` function (currently lines ~9-21) with a module-level constant plus the extended function:

```ts
const STEREO_NOTICE = '该音频为双声道，仅使用第 0 声道进行分析'

function importErrorMessage(err: unknown): string {
  if (err instanceof AudioTooLongError) {
    return '音频不能超过 10 秒，请裁剪后重试。'
  }
  if (err instanceof DOMException) {
    return '浏览器不支持该音频格式或文件已损坏，请尝试 wav/mp3/m4a。'
  }
  const message = err instanceof Error ? err.message : ''
  if (/Not a RIFF file|Not a WAV file/.test(message)) {
    return '不支持的文件格式，请选择 .wav 文件。'
  }
  if (/chunk not found/.test(message)) {
    return '文件已损坏或不是有效的 WAV 文件。'
  }
  if (/Unsupported bitsPerSample/.test(message)) {
    return '不支持的编码，仅支持 8/16/24/32 位 PCM。'
  }
  if (/Failed to load audio metadata|Failed to read audio duration/.test(message)) {
    return '无法读取音频信息，请检查文件。'
  }
  return '导入失败，请检查文件后重试。'
}
```

Update the imports (line 6) to also pull from the new decoder module:

```ts
import { AnalysisPipeline, parseWav, isWavFile, Resampler } from '../dsp'
import { AudioTooLongError, decodeAudioFile, probeAudioDuration } from '../audio/audioDecoder'
```

- [ ] **Step 2: Add isImporting state**

Inside `useAnalysis()`, next to the other `useState` calls (around line 30), add:

```ts
  const [isImporting, setIsImporting] = useState(false)
```

- [ ] **Step 3: Add commitImport helper**

After the `onAudioChunk` callback (around line 63), add:

```ts
  const commitImport = useCallback((samples: Float32Array) => {
    const maxSamples = 16000 * 10
    if (samples.length > maxSamples) {
      throw new AudioTooLongError()
    }
    const config = useAppStore.getState().config
    const frames = AnalysisPipeline.analyze(
      samples, 16000, config.formantMethod, config.formantSmoothing,
    )
    recordingBuffer.clear()
    recordingBuffer.write(samples)
    useAppStore.getState().clearFrames()
    useAppStore.getState().setFrames(frames)
    dataSourceRef.current = 'file'
    setDataSource('file')
    frameOffsetRef.current = 0
  }, [])
```

- [ ] **Step 4: Replace handleFileChange**

Replace the entire `handleFileChange` callback (currently lines ~128-181) with:

```ts
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (isImporting) return

    setIsImporting(true)
    stopRecording(false)

    try {
      const head = await file.slice(0, 12).arrayBuffer()

      if (isWavFile(head)) {
        // WAV fast path: unchanged behavior
        const buf = await file.arrayBuffer()
        const parsed = parseWav(buf)
        if (parsed.numChannels > 1) {
          useToastStore.getState().showToast('info', STEREO_NOTICE)
        }
        if (parsed.samples.length / parsed.sampleRate > 10) {
          throw new AudioTooLongError()
        }
        let samples = parsed.samples
        if (parsed.sampleRate !== 16000) {
          samples = new Resampler(parsed.sampleRate, 16000).process(samples)
        }
        commitImport(samples)
        return
      }

      // Compressed audio: probe duration (metadata only) BEFORE decoding,
      // so >10s files are rejected without full decode or heap churn.
      const duration = await probeAudioDuration(file)
      if (duration > 10) {
        throw new AudioTooLongError()
      }

      const buf = await file.arrayBuffer()
      const decoded = await decodeAudioFile(buf)
      if (decoded.numChannels > 1) {
        useToastStore.getState().showToast('info', STEREO_NOTICE)
      }
      let samples = decoded.samples
      if (decoded.sampleRate !== 16000) {
        samples = new Resampler(decoded.sampleRate, 16000).process(samples)
      }
      commitImport(samples)
    } catch (err) {
      console.error('Audio import failed:', err)
      useToastStore.getState().showToast('error', importErrorMessage(err))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [stopRecording, commitImport, isImporting])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/useAnalysis.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS (all existing + new).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAnalysis.ts src/__tests__/useAnalysis.test.ts
git commit -m "feat(import): support mp3/m4a with early 10s abort and stereo notice"
```

---

### Task 5: UI changes

**Files:**
- Modify: `src/routes/AnalysisPage.tsx`
- Modify: `src/hooks/useToolbar.ts`

- [ ] **Step 1: Broaden file accept**

Edit `src/routes/AnalysisPage.tsx:107`:

```tsx
<input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
```

(change `accept=".wav"` → `accept="audio/*"`).

- [ ] **Step 2: Update import button label**

Edit `src/hooks/useToolbar.ts:104`:

```ts
      label: '导入音频',
```

(change `label: '导入 WAV',` → `label: '导入音频',`).

- [ ] **Step 3: Verify tests + typecheck + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all 180+ tests pass, no type errors, build succeeds to `dist/`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/AnalysisPage.tsx src/hooks/useToolbar.ts
git commit -m "feat(import): accept audio/* and rename import button to 导入音频"
```