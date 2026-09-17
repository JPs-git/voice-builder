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
