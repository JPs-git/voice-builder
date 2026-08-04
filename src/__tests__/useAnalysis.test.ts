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