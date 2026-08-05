import type { ChangeEvent } from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useToastStore } from '../store/toastStore'
import { useAppStore } from '../store/appStore'
import { recordingBuffer } from '../audio/recordingBuffer'

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
