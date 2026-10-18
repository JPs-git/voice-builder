import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAnalysis } from '../hooks/useAnalysis'
import { recordingBuffer } from '../audio/recordingBuffer'
import { initAnalytics, setAnalyticsDisabled } from '../analytics/analytics'

const mocks = vi.hoisted(() => ({ inject: vi.fn(), startCapture: vi.fn(), stopCapture: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ inject: mocks.inject }))
vi.mock('../ts', () => ({ getAudioEngine: () => ({ startCapture: mocks.startCapture, stopCapture: mocks.stopCapture }) }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it('stops both analytics channels without interrupting recording or discarding samples', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true')
  vi.stubEnv('VITE_VERCEL_ANALYTICS_ENABLED', 'true')
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', '94db1cb1-74f4-4a40-ad6c-962362670409')
  vi.stubEnv('VITE_UMAMI_DOMAINS', 'voice.starbow.top')
  vi.stubGlobal('navigator', { doNotTrack: null })
  vi.stubGlobal('location', new URL('https://voice.starbow.top/'))
  localStorage.clear()
  recordingBuffer.clear()
  mocks.startCapture.mockResolvedValue(undefined)
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
  setAnalyticsDisabled(true)
  expect(analysis.result.current.isCapturing).toBe(true)
  expect(recordingBuffer.read()).toEqual(samples)
  expect(mocks.stopCapture).toHaveBeenCalledTimes(stops)
  expect(window.voiceBuilderAnalyticsBeforeSend!('event', { url: '/' })).toBe(false)
  expect(mocks.inject.mock.calls[0][0].beforeSend({ type: 'pageview', url: location.href })).toBeNull()
  act(() => capture(new Float32Array(16000), 16000))
  expect(sent).toHaveBeenCalledTimes(1)
  expect(recordingBuffer.read().length).toBeGreaterThan(samples.length)
})
