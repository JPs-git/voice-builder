import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RecordDock } from '../components/mobile/RecordDock'

describe('RecordDock', () => {
  it('reports actual height changes, exposes its mic ref and cleans up the observer', () => {
    let resize: () => void = () => {}
    const disconnect = vi.fn()
    const observer = vi.fn(function (callback: () => void) {
      resize = callback
      return { observe: vi.fn(), disconnect }
    })
    vi.stubGlobal('ResizeObserver', observer)
    let height = 76
    const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height }) as DOMRect)
    const onHeightChange = vi.fn()
    const ref = createRef<HTMLButtonElement>()
    const view = render(<RecordDock onRecord={() => {}} isCapturing={false} isRequesting={false} goalLabel="a" onGoalClick={() => {}} onHeightChange={onHeightChange} recordButtonRef={ref} />)
    expect(ref.current).toBe(screen.getByRole('button', { name: '开始录音' }))
    expect(onHeightChange).toHaveBeenLastCalledWith(76)
    height = 102
    act(() => resize())
    expect(onHeightChange).toHaveBeenLastCalledWith(102)
    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    measure.mockRestore()
    vi.unstubAllGlobals()
  })

  it('shows input level and gate state only during live capture, including the action dock', () => {
    const props = { onRecord: () => {}, isRequesting: false, goalLabel: 'a', onGoalClick: () => {}, onClear: () => {} }
    const { rerender } = render(<RecordDock {...props} isCapturing micInput={{ rms: 0.003, gateOpen: false }} />)
    expect(screen.getByTestId('dock-hint').textContent).toBe('输入偏弱')
    const meter = screen.getByRole('meter', { name: '麦克风输入电平' }) as HTMLMeterElement
    expect(meter.value).toBeGreaterThan(0)
    expect(meter.value).toBeLessThan(1)
    const quietLevel = meter.value
    expect(screen.getByTestId('dock-hint').getAttribute('data-input')).toBe('true')
    rerender(<RecordDock {...props} isCapturing micInput={{ rms: 0.014, gateOpen: true }} />)
    expect(screen.getByTestId('dock-hint').textContent).toBe('正在分析')
    expect((screen.getByRole('meter') as HTMLMeterElement).value).toBeGreaterThan(quietLevel)
    rerender(<RecordDock {...props} isCapturing micInput={{ rms: 0, gateOpen: false }} />)
    expect((screen.getByRole('meter') as HTMLMeterElement).value).toBe(0)
    rerender(<RecordDock {...props} isCapturing={false} micInput={{ rms: 0.014, gateOpen: true }} />)
    expect(screen.queryByRole('meter')).toBeNull()
    expect(screen.getByTestId('dock-hint').textContent).toBe('点击开始录音')
  })

  it('starts recording when the idle mic is clicked', () => {
    const onRecord = vi.fn()
    render(
      <RecordDock
        onRecord={onRecord}
        isCapturing={false}
        isRequesting={false}
        goalLabel="元音 a"
        onGoalClick={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('开始录音'))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  it('flips the mic to stop state while capturing', () => {
    const { rerender } = render(
      <RecordDock
        onRecord={() => {}}
        isCapturing={false}
        isRequesting={false}
        goalLabel="元音 a"
        onGoalClick={() => {}}
      />,
    )
    expect(screen.getByTestId('dock-hint').textContent).toBe('点击开始录音')

    rerender(
      <RecordDock
        onRecord={() => {}}
        isCapturing
        isRequesting={false}
        goalLabel="元音 a"
        onGoalClick={() => {}}
      />,
    )
    expect(screen.getByLabelText('停止录音')).toBeTruthy()
    expect(screen.queryByLabelText('开始录音')).toBeNull()
    expect(screen.getByTestId('dock-hint').textContent).toBe('正在录音')
    expect(screen.getByTestId('dock-timer')).toBeTruthy()
  })

  it('counts recording seconds while capturing', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <RecordDock onRecord={() => {}} isCapturing={false} isRequesting={false} goalLabel="a" onGoalClick={() => {}} />,
      )
      rerender(
        <RecordDock onRecord={() => {}} isCapturing isRequesting={false} goalLabel="a" onGoalClick={() => {}} />,
      )
      expect(screen.getByTestId('dock-timer').textContent).toBe('00:00')
      act(() => { vi.advanceTimersByTime(4000) })
      expect(screen.getByTestId('dock-timer').textContent).toBe('00:04')
    } finally {
      vi.useRealTimers()
    }
  })

  it('locks the mic while the microphone permission is pending', () => {
    const onRecord = vi.fn()
    render(
      <RecordDock
        onRecord={onRecord}
        isCapturing={false}
        isRequesting
        goalLabel="元音 a"
        onGoalClick={() => {}}
      />,
    )
    const mic = screen.getByLabelText('麦克风授权中') as HTMLButtonElement
    expect(mic.disabled).toBe(true)
    fireEvent.click(mic)
    expect(onRecord).not.toHaveBeenCalled()
  })

  it('renders a microphone glyph with a halo behind the idle mic', () => {
    render(
      <RecordDock
        onRecord={() => {}}
        isCapturing={false}
        isRequesting={false}
        goalLabel="元音 a"
        onGoalClick={() => {}}
      />,
    )
    const dock = document.querySelector('[data-portrait-dock="true"]')
    expect(dock?.querySelector('[data-testid="dock-mic-halo"]')).toBeTruthy()
    expect(dock?.querySelector('svg')).toBeTruthy()
  })

  it('shows the current goal and opens it on click', () => {
    const onGoalClick = vi.fn()
    render(
      <RecordDock
        onRecord={() => {}}
        isCapturing={false}
        isRequesting={false}
        goalLabel="元音 i"
        onGoalClick={onGoalClick}
      />,
    )
    expect(screen.getByTestId('dock-goal-label').textContent).toBe('元音 i')
    fireEvent.click(screen.getByTestId('dock-goal'))
    expect(onGoalClick).toHaveBeenCalledTimes(1)
  })
})
