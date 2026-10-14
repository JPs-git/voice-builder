import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TrainingGoalModal } from '../components/mobile/TrainingGoalModal'
import { useAppStore } from '../store/appStore'

function Harness() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>当前目标</button><TrainingGoalModal open={open} onClose={() => setOpen(false)} /></>
}

beforeEach(() => useAppStore.getState().reset())
afterEach(() => { cleanup(); vi.useRealTimers() })

it('opens a dialog without footer actions and restores the entry focus', () => {
  render(<Harness />)
  const entry = screen.getByRole('button', { name: '当前目标' })
  entry.focus()
  fireEvent.click(entry)
  expect(screen.getByRole('dialog', { name: '训练目标' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '完成' })).toBeNull()
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.click(screen.getByLabelText('关闭'))
  expect(document.activeElement).toBe(entry)
  expect(document.body.style.overflow).not.toBe('hidden')
})

it('submits a focused draft before closing with Escape', () => {
  render(<Harness />)
  fireEvent.click(screen.getByText('当前目标'))
  const input = screen.getByLabelText('F0下限')
  input.focus()
  fireEvent.change(input, { target: { value: '250' } })
  expect(useAppStore.getState().bands.f0.range[0]).toBe(200)
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(useAppStore.getState().bands.f0.range[0]).toBe(250)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps Tab within the modal', () => {
  render(<Harness />)
  fireEvent.click(screen.getByText('当前目标'))
  const first = screen.getByLabelText('关闭')
  first.focus()
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(screen.getByLabelText('F2上限滑块'))
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
  expect(document.activeElement).toBe(first)
})

it('keeps Escape available after Enter submits and blurs an input', () => {
  render(<Harness />)
  fireEvent.click(screen.getByText('当前目标'))
  const input = screen.getByLabelText('F0下限')
  input.focus()
  fireEvent.change(input, { target: { value: '250' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(useAppStore.getState().bands.f0.range[0]).toBe(250)
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps a new correction bubble through the same blur/focus transition, then dismisses on later focus', () => {
  vi.useFakeTimers()
  render(<Harness />)
  fireEvent.click(screen.getByText('当前目标'))
  const input = screen.getByLabelText('F2下限')
  fireEvent.change(input, { target: { value: '900' } })
  fireEvent.blur(input)
  fireEvent.focusIn(screen.getByLabelText('F2上限'))
  expect(screen.getByRole('status').textContent).toContain('F1 上限')
  act(() => vi.advanceTimersByTime(1))
  fireEvent.focusIn(screen.getByLabelText('重置所有预设'))
  expect(screen.queryByRole('status')).toBeNull()
})
