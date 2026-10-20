import type { ChangeEvent } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useToastStore } from '../store/toastStore'
import { useAppStore } from '../store/appStore'
import { recordingBuffer } from '../audio/recordingBuffer'

const audioEngineMock = vi.hoisted(() => ({
  startCapture: vi.fn(),
  stopCapture: vi.fn(),
}))

vi.mock('../ts', () => ({
  getAudioEngine: () => audioEngineMock,
  resetAudioEngine: () => {},
}))

if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

if (typeof File.prototype.arrayBuffer !== 'function') {
  File.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

function resetStores() {
  useAppStore.getState().reset()
  useToastStore.setState({ toasts: [] })
  recordingBuffer.clear()
}

describe('explicit realtime suspension', () => {
  it('ignores a late permission result after leaving realtime', async () => {
    resetStores()
    let resolve!: () => void
    audioEngineMock.startCapture.mockImplementation(() => new Promise<void>(r => { resolve = r }))
    const { result } = renderHook(() => useAnalysis())
    let pending!: Promise<void>
    act(() => { pending = result.current.onRecord() })
    act(() => result.current.suspend())
    await act(async () => { resolve(); await pending })
    expect(result.current.isCapturing).toBe(false)
    expect(result.current.isRequesting).toBe(false)
    expect(useAppStore.getState().frames).toHaveLength(0)
  })

  it('keeps audio, target settings and time offset when suspended then resumed', async () => {
    resetStores()
    let callback!: (chunk:Float32Array, rate:number)=>void
    audioEngineMock.startCapture.mockImplementation(async cb => { callback=cb })
    const {result}=renderHook(()=>useAnalysis())
    await act(async()=>{await result.current.onRecord()})
    const tone=Float32Array.from({length:16000},(_,i)=>.02*Math.sin(2*Math.PI*200*i/16000))
    act(()=>callback(tone,16000))
    const before=useAppStore.getState().latestFrame!.time
    const bands=useAppStore.getState().bands
    act(()=>result.current.suspend())
    expect(recordingBuffer.read()).toEqual(tone)
    expect(useAppStore.getState().bands).toEqual(bands)
    await act(async()=>{await result.current.onRecord()})
    act(()=>callback(tone,16000))
    expect(useAppStore.getState().latestFrame!.time).toBeGreaterThan(before)
  })
})

describe('useAnalysis import error feedback', () => {
  beforeEach(() => resetStores())
  afterEach(() => resetStores())

  it('shows an error toast when importing a non-importable file', async () => {
    const { result } = renderHook(() => useAnalysis())

    const nonWav = new ArrayBuffer(64)
    new Uint8Array(nonWav).set([0x50, 0x4b, 0x03, 0x04], 0) // "PK\x03\x04" (ZIP magic)

    await act(async () => {
      await result.current.handleFileChange({
        target: { files: [new File([nonWav], 'test.zip')] },
      } as unknown as ChangeEvent<HTMLInputElement>)
    })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('error')
  })

  it('shows an error toast for a corrupted WAV buffer', async () => {
    const { result } = renderHook(() => useAnalysis())

    const corrupt = new ArrayBuffer(64)
    new Uint8Array(corrupt).set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
    new Uint8Array(corrupt).set([0x57, 0x41, 0x56, 0x45], 8) // WAVE

    await act(async () => {
      await result.current.handleFileChange({
        target: { files: [new File([corrupt], 'bad.wav')] },
      } as unknown as ChangeEvent<HTMLInputElement>)
    })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('error')
  })

  it('does not add frames when import fails', async () => {
    const { result } = renderHook(() => useAnalysis())

    const nonWav = new ArrayBuffer(64)
    await act(async () => {
      await result.current.handleFileChange({
        target: { files: [new File([nonWav], 'test.txt')] },
      } as unknown as ChangeEvent<HTMLInputElement>)
    })

    expect(useAppStore.getState().frames).toEqual([])
  })
})

describe('useAnalysis record/pause latestFrame', () => {
  let captureCallback: ((chunk: Float32Array, rate: number) => void) | null = null

  beforeEach(() => {
    resetStores()
    audioEngineMock.startCapture.mockReset()
    audioEngineMock.stopCapture.mockReset()
    captureCallback = null
    audioEngineMock.startCapture.mockImplementation(
      async (cb: (chunk: Float32Array, rate: number) => void) => {
        captureCallback = cb
      },
    )
  })
  afterEach(() => resetStores())

  it('detects quiet microphone input, preserves recording samples and resets the gate on restart', async () => {
    const { result } = renderHook(() => useAnalysis())
    await act(async () => { await result.current.onRecord() })
    const quiet = Float32Array.from({ length: 16000 }, (_, i) => 0.02 * Math.sin(2 * Math.PI * 200 * i / 16000))
    act(() => { captureCallback!(quiet, 16000) })
    expect(useAppStore.getState().frames.some(f => f.f0 === 200)).toBe(true)
    expect(useAppStore.getState().latestFrame?.rms).toBeCloseTo(0.014142, 5)
    expect(useAppStore.getState().latestFrame?.voiced).toBe(true)
    expect(recordingBuffer.read()).toEqual(quiet)
    act(() => { captureCallback!(new Float32Array(3200), 16000) })
    expect(useAppStore.getState().latestFrame?.voiced).toBe(false)
    await act(async () => { await result.current.onRecord() })
    expect(result.current.isCapturing).toBe(false)
    await act(async () => { await result.current.onRecord() })
    act(() => { captureCallback!(new Float32Array(800).fill(0.006), 16000) })
    expect(useAppStore.getState().latestFrame?.voiced).toBe(false)
    act(() => { result.current.onClear() })
    expect(useAppStore.getState().frames).toEqual([])
  })

  it('restores latestFrame to the last complete frame after pausing', async () => {
    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.onRecord()
    })
    expect(result.current.isCapturing).toBe(true)

    const rate = 16000
    const voiced = new Float32Array(rate)
    for (let i = 0; i < voiced.length; i++) {
      voiced[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / rate)
    }

    await act(async () => {
      for (let start = 0; start < voiced.length; start += 1024) {
        captureCallback!(voiced.slice(start, start + 1024), rate)
      }
    })

    const beforePause = useAppStore.getState()
    expect(beforePause.frames.length).toBeGreaterThan(0)
    const lastComplete = beforePause.latestFrame

    await act(async () => {
      await result.current.onRecord()
    })

    const after = useAppStore.getState()
    expect(result.current.isCapturing).toBe(false)
    expect(after.latestFrame).toBe(lastComplete)
    expect(after.frames.length).toBeGreaterThan(beforePause.frames.length)
  })
})
