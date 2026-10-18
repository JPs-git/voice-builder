import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AboutModal } from '../components/AboutModal'
import { useAnalysis } from '../hooks/useAnalysis'
import { recordingBuffer } from '../audio/recordingBuffer'
import { getAnalyticsDisabled, initAnalytics, setAnalyticsDisabled } from '../analytics/analytics'

const mocks = vi.hoisted(() => ({ inject: vi.fn(), startCapture: vi.fn(), stopCapture: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ inject: mocks.inject }))
vi.mock('../ts', () => ({ getAudioEngine: () => ({ startCapture: mocks.startCapture, stopCapture: mocks.stopCapture }) }))

beforeEach(() => {
  vi.stubEnv('PROD', false)
  vi.stubGlobal('navigator', { doNotTrack: null })
  localStorage.clear()
  setAnalyticsDisabled(false)
  mocks.startCapture.mockReset().mockResolvedValue(undefined)
  mocks.stopCapture.mockClear()
  recordingBuffer.clear()
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('anonymous analytics controls', () => {
  it('explains the collection boundary and immediately saves an accessible opt-out', () => {
    render(<AboutModal open onClose={() => {}} />)
    const checkbox = screen.getByRole('checkbox', { name: '匿名使用统计' }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    expect(screen.getByText(/录音和声音分析数据只在本机处理/)).toBeTruthy()
    checkbox.focus()
    expect(document.activeElement).toBe(checkbox)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    expect(getAnalyticsDisabled()).toBe(true)
    expect(localStorage.getItem('voicebuilder-analytics-disabled')).toBe('true')
  })

  it('preserves the preference after closing and reopening the dialog', () => {
    const view = render(<AboutModal open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: '匿名使用统计' }))
    view.rerender(<AboutModal open={false} onClose={() => {}} />)
    view.rerender(<AboutModal open onClose={() => {}} />)
    expect((screen.getByRole('checkbox', { name: '匿名使用统计' }) as HTMLInputElement).checked).toBe(false)
  })

  it('reflects a cross-tab preference update', () => {
    render(<AboutModal open onClose={() => {}} />)
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'voicebuilder-analytics-disabled', newValue: 'true', storageArea: localStorage })))
    expect((screen.getByRole('checkbox', { name: '匿名使用统计' }) as HTMLInputElement).checked).toBe(false)
  })

  it('does not allow the checkbox to override browser DNT', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    render(<AboutModal open onClose={() => {}} />)
    const checkbox = screen.getByRole('checkbox', { name: '匿名使用统计' }) as HTMLInputElement
    expect(checkbox.disabled).toBe(true)
    expect(checkbox.checked).toBe(false)
    expect(screen.getByText(/浏览器的 Do Not Track 设置已关闭统计/)).toBeTruthy()
  })

  it('applies a toggle in memory and explains when storage cannot save it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<AboutModal open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: '匿名使用统计' }))
    expect(getAnalyticsDisabled()).toBe(true)
    expect(screen.getByText(/当前浏览器无法保存偏好/)).toBeTruthy()
  })

  it('stops both channels while a recording continues with its samples intact', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true')
    vi.stubEnv('VITE_VERCEL_ANALYTICS_ENABLED', 'true')
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', '94db1cb1-74f4-4a40-ad6c-962362670409')
    vi.stubEnv('VITE_UMAMI_DOMAINS', 'voice.starbow.top')
    vi.stubGlobal('location', new URL('https://voice.starbow.top/'))
    initAnalytics()
    const sent = vi.fn()
    window.umami = { track: sent }
    document.querySelector('script[data-website-id]')!.dispatchEvent(new Event('load'))
    const analysis = renderHook(() => useAnalysis())
    await act(async () => { await analysis.result.current.onRecord() })
    const capture = mocks.startCapture.mock.calls[0][0] as (samples: Float32Array, rate: number) => void
    act(() => capture(new Float32Array([0.1, 0.2]), 16000))
    const samples = recordingBuffer.read()
    const stops = mocks.stopCapture.mock.calls.length
    render(<AboutModal open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: '匿名使用统计' }))
    expect(analysis.result.current.isCapturing).toBe(true)
    expect(recordingBuffer.read()).toEqual(samples)
    expect(mocks.stopCapture).toHaveBeenCalledTimes(stops)
    expect(window.voiceBuilderAnalyticsBeforeSend!('event', { url: '/' })).toBe(false)
    expect(mocks.inject.mock.calls[0][0].beforeSend({ type: 'pageview', url: location.href })).toBeNull()
    act(() => capture(new Float32Array(16000), 16000))
    expect(sent).toHaveBeenCalledTimes(1)
    expect(recordingBuffer.read().length).toBeGreaterThan(samples.length)
  })
})
