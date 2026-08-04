import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { recordingBuffer } from '../audio/recordingBuffer'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.resolve(__dirname, '../../assets')

function loadAsset(name: string): Buffer {
  return readFileSync(path.join(ASSETS, name))
}

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
    expect(toastMessages()).toContain('音频不能超过 10 秒，请裁剪后重试。')
  })

  it('shows browser-unsupported toast when decodeAudioData fails', async () => {
    mocks.isWavFile.mockReturnValue(false)
    mocks.probeAudioDuration.mockResolvedValue(5)
    mocks.decodeAudioFile.mockRejectedValue(new DOMException('Failed to decode audio data', 'EncodingError'))

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [nonWavFile()] } } as never)
    })

    expect(toastMessages()).toContain('浏览器不支持该音频格式或文件已损坏，请尝试 wav/mp3/m4a。')
  })
})

describe('real mp3/m4a file routing', () => {
  const SAMPLES = new Float32Array([0.1, 0.2, 0.3])

  beforeEach(() => {
    useAppStore.getState().reset()
    useToastStore.setState({ toasts: [] })
    recordingBuffer.clear()
    vi.resetAllMocks()
  })

  it('mp3 file goes through probeAudioDuration then decodeAudioFile', async () => {
    mocks.probeAudioDuration.mockResolvedValue(3)
    mocks.decodeAudioFile.mockResolvedValue({ samples: SAMPLES, sampleRate: 16000, numChannels: 1 })
    mocks.analyze.mockReturnValue([{ time: 0, f0: 220 }])

    const mp3Buf = new Uint8Array(loadAsset('a.mp3'))
    const file = new File([mp3Buf], 'a.mp3', { type: 'audio/mpeg' })

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [file] } } as never)
    })

    expect(mocks.parseWav).not.toHaveBeenCalled()
    expect(mocks.probeAudioDuration).toHaveBeenCalled()
    expect(mocks.decodeAudioFile).toHaveBeenCalled()
    expect(mocks.analyze).toHaveBeenCalled()
    expect(useAppStore.getState().frames).toHaveLength(1)
  })

  it('m4a file goes through probeAudioDuration then decodeAudioFile', async () => {
    mocks.probeAudioDuration.mockResolvedValue(3)
    mocks.decodeAudioFile.mockResolvedValue({ samples: SAMPLES, sampleRate: 16000, numChannels: 1 })
    mocks.analyze.mockReturnValue([{ time: 0, f0: 220 }])

    const m4aBuf = new Uint8Array(loadAsset('a.m4a'))
    const file = new File([m4aBuf], 'a.m4a', { type: 'audio/mp4' })

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [file] } } as never)
    })

    expect(mocks.parseWav).not.toHaveBeenCalled()
    expect(mocks.probeAudioDuration).toHaveBeenCalled()
    expect(mocks.decodeAudioFile).toHaveBeenCalled()
    expect(mocks.analyze).toHaveBeenCalled()
    expect(useAppStore.getState().frames).toHaveLength(1)
  })

  it('mp3 >10s is rejected before decoding', async () => {
    mocks.probeAudioDuration.mockResolvedValue(15)

    const mp3Buf = new Uint8Array(loadAsset('a.mp3'))
    const file = new File([mp3Buf], 'a.mp3', { type: 'audio/mpeg' })

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [file] } } as never)
    })

    expect(mocks.decodeAudioFile).not.toHaveBeenCalled()
    expect(mocks.analyze).not.toHaveBeenCalled()
    expect(toastMessages()).toContain('音频不能超过 10 秒，请裁剪后重试。')
  })

  it('mp3 decode failure shows browser-unsupported toast', async () => {
    mocks.probeAudioDuration.mockResolvedValue(3)
    mocks.decodeAudioFile.mockRejectedValue(new DOMException('Failed to decode audio data', 'EncodingError'))

    const mp3Buf = new Uint8Array(loadAsset('a.mp3'))
    const file = new File([mp3Buf], 'a.mp3', { type: 'audio/mpeg' })

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.handleFileChange({ target: { files: [file] } } as never)
    })

    expect(toastMessages()).toContain('浏览器不支持该音频格式或文件已损坏，请尝试 wav/mp3/m4a。')
  })
})