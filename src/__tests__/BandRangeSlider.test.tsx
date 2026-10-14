import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BandRangeSlider } from '../components/mobile/BandRangeSlider'
import { useAppStore } from '../store/appStore'

beforeEach(() => {
  useAppStore.getState().reset()
  useAppStore.getState().switchPreset('vowel-i')
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.getAttribute('role') === 'slider' ? 14 : 250
    const left = this.getAttribute('role') === 'slider' ? Number(this.getAttribute('aria-valuenow')) / 3500 * 250 - 7 : 0
    return { width, height: 52, left, right: left + width, top: 0, bottom: 52, x: left, y: 0, toJSON() {} }
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('BandRangeSlider', () => {
  it('does not move a narrow preset backwards on the first rightward pointer movement', () => {
    const change = vi.fn()
    render(<BandRangeSlider bandKey="f1" value={[280, 380]} onChange={change} onBoundary={vi.fn()} />)
    const track = screen.getByRole('group', { name: 'F1范围滑杆' })
    Object.defineProperties(track, {
      setPointerCapture: { value: vi.fn() }, hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
    })
    fireEvent.pointerDown(screen.getByLabelText('F1下限滑块'), { button: 0, clientX: 20, clientY: 26 })
    fireEvent.pointerMove(track, { clientX: 21, clientY: 26 })
    for (const [, value] of change.mock.calls) expect(value).toBeGreaterThanOrEqual(280)
    fireEvent.pointerMove(track, { clientX: 18, clientY: 26 })
    expect(change).toHaveBeenCalledWith(0, 250)
  })
  it('increments the lower thumb of a narrow preset by one keyboard step', () => {
    const change = vi.fn()
    render(<BandRangeSlider bandKey="f1" value={[280, 380]} onChange={change} onBoundary={vi.fn()} />)
    fireEvent.keyDown(screen.getByLabelText('F1下限滑块'), { key: 'ArrowRight' })
    expect(change).toHaveBeenCalledWith(0, 290)
  })
  it('decrements the upper thumb of a narrow preset by one keyboard step', () => {
    const change = vi.fn()
    render(<BandRangeSlider bandKey="f1" value={[280, 380]} onChange={change} onBoundary={vi.fn()} />)
    fireEvent.keyDown(screen.getByLabelText('F1上限滑块'), { key: 'ArrowLeft' })
    expect(change).toHaveBeenCalledWith(1, 370)
  })
  it('stops silently at the own minimum gap', () => {
    const change = vi.fn()
    const boundary = vi.fn()
    render(<BandRangeSlider bandKey="f1" value={[280, 330]} onChange={change} onBoundary={boundary} />)
    fireEvent.keyDown(screen.getByLabelText('F1下限滑块'), { key: 'ArrowRight' })
    expect(change).not.toHaveBeenCalled()
    expect(boundary).toHaveBeenCalledWith(0, '')
  })
  it('does not notify at a visible frequency endpoint', () => {
    const boundary = vi.fn()
    render(<BandRangeSlider bandKey="f0" value={[200, 490]} onChange={vi.fn()} onBoundary={boundary} />)
    fireEvent.keyDown(screen.getByLabelText('F0上限滑块'), { key: 'End' })
    expect(boundary).toHaveBeenCalledWith(1, '')
  })
  it('explains the cross-formant boundary', () => {
    const boundary = vi.fn()
    render(<BandRangeSlider bandKey="f1" value={[280, 380]} onChange={vi.fn()} onBoundary={boundary} />)
    fireEvent.keyDown(screen.getByLabelText('F1上限滑块'), { key: 'End' })
    expect(boundary).toHaveBeenCalledWith(1, expect.stringContaining('F2 下限'))
  })
})
