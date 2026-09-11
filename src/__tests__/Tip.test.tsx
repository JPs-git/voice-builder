import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Tip } from '../components/Tip'

function mockHoverCapable(enabled: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: hover)' ? enabled : false,
      media: query,
    })),
  })
}

describe('Tip', () => {
  beforeEach(() => {
    mockHoverCapable(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders an info button and hides content initially', () => {
    render(<Tip content="这是提示内容" />)
    expect(screen.getByRole('button', { name: '说明' })).toBeTruthy()
    expect(screen.queryByText('这是提示内容')).toBeNull()
  })

  it('shows content on mouse enter and hides on mouse leave', () => {
    render(<Tip content="这是提示内容" />)
    const button = screen.getByRole('button', { name: '说明' })

    fireEvent.mouseEnter(button)
    expect(screen.getByText('这是提示内容')).toBeTruthy()

    fireEvent.mouseLeave(button)
    expect(screen.queryByText('这是提示内容')).toBeNull()
  })

  it('toggles content on click', () => {
    render(<Tip content="这是提示内容" />)
    const button = screen.getByRole('button', { name: '说明' })

    fireEvent.click(button)
    expect(screen.getByText('这是提示内容')).toBeTruthy()

    fireEvent.click(button)
    expect(screen.queryByText('这是提示内容')).toBeNull()
  })

  it('on touch-only device: click toggles, mouse enter does not affect', () => {
    mockHoverCapable(false)
    render(<Tip content="这是提示内容" />)
    const button = screen.getByRole('button', { name: '说明' })

    expect(screen.queryByText('这是提示内容')).toBeNull()
    fireEvent.mouseEnter(button)
    expect(screen.queryByText('这是提示内容')).toBeNull()

    fireEvent.click(button)
    expect(screen.getByText('这是提示内容')).toBeTruthy()

    fireEvent.click(button)
    expect(screen.queryByText('这是提示内容')).toBeNull()
  })
})