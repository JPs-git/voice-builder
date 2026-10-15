import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFirstUseHelp } from '../hooks/useFirstUseHelp'
import { useIntroHintStore, INTRO_HINT_KEY } from '../store/introHintStore'
import { useAppStore } from '../store/appStore'

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  useIntroHintStore.setState({ handled: false })
  useAppStore.getState().reset()
})

describe('first-use help eligibility', () => {
  it('remembers dismissal across rehydration and clearing audio', async () => {
    const { result } = renderHook(useFirstUseHelp)
    expect(result.current.eligible).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.eligible).toBe(false)
    expect(localStorage.getItem(INTRO_HINT_KEY)).toContain('"handled":true')
    act(() => useIntroHintStore.setState({ handled: false }))
    localStorage.setItem(INTRO_HINT_KEY, JSON.stringify({ state: { handled: true }, version: 0 }))
    await act(() => useIntroHintStore.persist.rehydrate())
    act(() => useAppStore.getState().clearFrames())
    expect(result.current.eligible).toBe(false)
  })

  it.each([0, -1, null, NaN, Infinity])('does not complete on invalid value %s', value => {
    const { result } = renderHook(useFirstUseHelp)
    act(() => useAppStore.getState().setFrames([{ time: 0, f0: value, f1: value, f2: value }]))
    expect(result.current.eligible).toBe(true)
  })

  it.each(['f0', 'f1', 'f2'] as const)('completes when %s has a valid value', key => {
    const { result } = renderHook(useFirstUseHelp)
    act(() => useAppStore.getState().setFrames([{ time: 0, f0: null, f1: null, f2: null, [key]: 200 }]))
    expect(result.current.eligible).toBe(false)
    act(() => useAppStore.getState().clearFrames())
    expect(result.current.eligible).toBe(false)
  })

  it('tolerates corrupt and unavailable storage while keeping session dismissal', async () => {
    localStorage.setItem(INTRO_HINT_KEY, 'broken json')
    await act(() => useIntroHintStore.persist.rehydrate())
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    await act(() => useIntroHintStore.persist.rehydrate())
    get.mockRestore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const view = renderHook(useFirstUseHelp)
    expect(view.result.current.eligible).toBe(true)
    act(() => view.result.current.dismiss())
    view.unmount()
    expect(renderHook(useFirstUseHelp).result.current.eligible).toBe(false)
  })
})
