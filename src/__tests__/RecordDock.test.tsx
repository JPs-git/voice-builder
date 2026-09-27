import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordDock } from '../components/mobile/RecordDock'

describe('RecordDock', () => {
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
    expect(screen.getByTestId('dock-hint').textContent).toBe('再次点击停止')
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
