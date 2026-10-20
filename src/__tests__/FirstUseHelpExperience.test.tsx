import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../routes/AppShell'
import { AnalysisPage } from '../routes/AnalysisPage'
import { PracticePage } from '../routes/PracticePage'
import { useAppStore } from '../store/appStore'
import { useIntroHintStore } from '../store/introHintStore'

const { audio, state } = vi.hoisted(() => ({ audio: vi.fn(), state: { capturing: false, requesting: false, playing: false, data: false } }))
const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('../analytics/analytics', async original => ({
  ...await original<typeof import('../analytics/analytics')>(),
  track, getAnalyticsPage: () => 'analysis',
}))
vi.mock('../hooks/useToolbar', () => ({ useToolbar: (config: () => void, help: () => void, about: () => void) => ({
  cursorTime: -1, hasData: state.data, isCapturing: state.capturing, isRequesting: state.requesting,
  fileInputRef: { current: null }, handleFileChange: vi.fn(),
  toolItems: [
    { id: 'record', label: '开始录音', icon: '●', variant: 'primary', disabled: state.requesting },
    { id: 'help', label: '帮助', icon: '?', variant: 'ghost' },
    { id: 'config', label: '配置', icon: '⚙', variant: 'ghost' },
    { id: 'about', label: '关于', icon: 'ⓘ', variant: 'ghost' },
    { id: 'playback', label: state.playing ? '停止' : '回放', icon: '▶', variant: 'ghost' },
  ],
  handleClickTool: (id: string) => id === 'help' ? help() : id === 'config' ? config() : id === 'about' ? about() : audio(id),
}) }))
vi.mock('../hooks/useECharts', () => ({ useECharts: () => ({ chartRef: { current: null }, setOption: vi.fn(), getInstance: () => null }) }))
vi.mock('../audio/PianoSynth', () => ({ getPianoSynth: () => ({ play: vi.fn(), stopAll: vi.fn() }) }))

function TestApp() {
  return <MemoryRouter><Routes><Route element={<AppShell />}>
    <Route index element={<AnalysisPage />} /><Route path="practice" element={<PracticePage />} />
  </Route></Routes></MemoryRouter>
}
let resizeLayout: (portrait: boolean) => void
beforeEach(() => {
  localStorage.clear()
  useIntroHintStore.setState({ handled: false })
  useAppStore.getState().reset()
  Object.assign(state, { capturing: false, requesting: false, playing: false, data: false })
  audio.mockClear()
  track.mockClear()
  const listeners = new Set<(event: { matches: boolean }) => void>()
  const mql = { matches: true, addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener), removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener) }
  vi.stubGlobal('matchMedia', () => mql)
  resizeLayout = portrait => act(() => { mql.matches = portrait; listeners.forEach(listener => listener({ matches: portrait })) })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 76 } as DOMRect)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('first-use help integration', () => {
  it.each([true, false])('records each real help opening once across all entry points (portrait=%s)', portrait => {
    render(<TestApp />)
    resizeLayout(portrait)
    fireEvent.click(screen.getByRole('button', { name: '查看说明' }))
    expect(track).toHaveBeenLastCalledWith('help_open', { page: 'analysis', topic: 'quick-start' })
    fireEvent.click(screen.getByRole('button', { name: '读图与反馈' }))
    expect(track).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('button', { name: '基频图说明' }))
    expect(track).toHaveBeenLastCalledWith('help_open', { page: 'analysis', topic: 'charts' })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '帮助' }))
    expect(track).toHaveBeenCalledTimes(3)
    expect(track).toHaveBeenLastCalledWith('help_open', { page: 'analysis', topic: 'quick-start' })
  })
  it.each([true, false])('uses contextual controls and one first-use banner on both pages (portrait=%s)', portrait => {
    render(<TestApp />)
    resizeLayout(portrait)
    expect(screen.queryByRole('button', { name: '查看上手步骤' })).toBeNull()
    expect(screen.getAllByRole('region', { name: '首次使用帮助' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: '音高参考' }))
    expect(screen.queryByRole('button', { name: '了解音高参考' })).toBeNull()
    expect(screen.getByRole('button', { name: '音高图说明' })).toBeTruthy()
    expect(screen.getAllByRole('region', { name: '首次使用帮助' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '关闭首次使用提示' }))
    resizeLayout(!portrait)
    act(() => useAppStore.getState().clearFrames())
    expect(screen.queryByRole('region', { name: '首次使用帮助' })).toBeNull()
    expect(audio).not.toHaveBeenCalled()
  })
  it.each([true, false])('restores current-layout focus after help crosses the breakpoint (starts portrait=%s)', portrait => {
    render(<TestApp />)
    resizeLayout(portrait)
    const original = screen.getByRole('button', { name: '基频图说明' })
    original.focus(); fireEvent.click(original)
    const topic = screen.getByRole('button', { name: '读图与反馈' })
    topic.focus()
    resizeLayout(!portrait)
    expect(document.activeElement).toBe(topic)
    expect(topic.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '更多操作' }))
    expect(audio).not.toHaveBeenCalled()
  })

  it.each([true, false])('uses help or More if current recording button is disabled (starts portrait=%s)', portrait => {
    const view = render(<TestApp />)
    resizeLayout(portrait)
    const original = screen.getByRole('button', { name: '基频图说明' })
    original.focus(); fireEvent.click(original)
    state.requesting = true
    view.rerender(<TestApp />)
    resizeLayout(!portrait)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '更多操作' }))
    expect(audio).not.toHaveBeenCalled()
  })

  it('clears the unmounted portrait goal overlay when switching to landscape', () => {
    render(<TestApp />)
    fireEvent.click(screen.getByRole('button', { name: '回到训练目标' }))
    expect(screen.getByRole('dialog', { name: '训练目标' })).toBeTruthy()
    resizeLayout(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('region', { name: '首次使用帮助' })).toBeTruthy()
  })
  it('uses one banner across portrait pages and removes both empty-state actions', () => {
    render(<TestApp />)
    expect(screen.getAllByRole('region', { name: '首次使用帮助' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '查看上手步骤' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '音高参考' }))
    expect(screen.getAllByRole('region', { name: '首次使用帮助' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '了解音高参考' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '关闭首次使用提示' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '开始录音' }))
    act(() => useAppStore.getState().clearFrames())
    fireEvent.click(screen.getByRole('link', { name: '实时分析' }))
    resizeLayout(false); resizeLayout(true)
    expect(screen.queryByRole('region', { name: '首次使用帮助' })).toBeNull()
    expect(audio).not.toHaveBeenCalled()
  })

  it('opens the document and restores the banner trigger without treating reading as completion', () => {
    render(<TestApp />)
    const trigger = screen.getByRole('button', { name: '查看说明' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '使用说明' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '快速上手' }).getAttribute('aria-pressed')).toBe('true')
    expect(trigger.isConnected).toBe(true)
    expect(screen.queryByRole('region', { name: '首次使用帮助' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.activeElement).toBe(trigger)
    expect(screen.getByRole('region', { name: '首次使用帮助' })).toBeTruthy()
    expect(useIntroHintStore.getState().handled).toBe(false)
    expect(audio).not.toHaveBeenCalled()
  })

  it('returns focus to More if successful analysis removes the trigger while help is open', () => {
    render(<TestApp />)
    const trigger = screen.getByRole('button', { name: '查看说明' })
    trigger.focus(); fireEvent.click(trigger)
    act(() => useAppStore.getState().setFrames([{ time: 1, f0: 200, f1: null, f2: null }]))
    expect(trigger.isConnected).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '更多操作' }))
    expect(screen.queryByRole('region', { name: '首次使用帮助' })).toBeNull()
  })

  it('returns focus to More when invalid imported data suppresses the connected trigger', () => {
    const view = render(<TestApp />)
    const trigger = screen.getByRole('button', { name: '查看说明' })
    trigger.focus(); fireEvent.click(trigger)
    state.data = true
    view.rerender(<TestApp />)
    expect(trigger.isConnected).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '更多操作' }))
    expect(useIntroHintStore.getState().handled).toBe(false)
  })

  it.each([
    [true, 'capturing'], [false, 'capturing'], [true, 'requesting'], [false, 'requesting'],
    [true, 'playing'], [false, 'playing'], [true, 'data'], [false, 'data'],
  ] as const)('temporarily hides in portrait=%s for %s without completing', (portrait, flag) => {
    const view = render(<TestApp />)
    resizeLayout(portrait)
    state[flag] = true
    view.rerender(<TestApp />)
    expect(screen.queryByRole('region', { name: '首次使用帮助' })).toBeNull()
    expect(useIntroHintStore.getState().handled).toBe(false)
    state[flag] = false
    view.rerender(<TestApp />)
    expect(screen.getByRole('region', { name: '首次使用帮助' })).toBeTruthy()
  })

  it('completes on analysis performed in landscape and stays hidden after returning to portrait', () => {
    render(<TestApp />)
    resizeLayout(false)
    expect(screen.getByRole('region', { name: '首次使用帮助' })).toBeTruthy()
    act(() => useAppStore.getState().setFrames([{ time: 1, f0: 200, f1: null, f2: null }]))
    act(() => useAppStore.getState().clearFrames())
    resizeLayout(true)
    expect(screen.queryByRole('region', { name: '首次使用帮助' })).toBeNull()
  })
})
