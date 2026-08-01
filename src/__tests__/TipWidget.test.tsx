import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TipWidget } from '../components/TipWidget'
import styles from '../components/TipWidget.module.css'

const TIPS = ['第一条提示', '第二条提示']

function card() {
  return screen.getByText(/第[一二]条提示/).parentElement as HTMLDivElement
}

describe('TipWidget', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts hidden and selects a different random tip when first shown', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9)
    render(<TipWidget tips={TIPS} interval={1000} />)

    expect(card().classList.contains(styles.cardHidden)).toBe(true)

    act(() => vi.advanceTimersByTime(1000))

    expect(card().classList.contains(styles.cardHidden)).toBe(false)
    expect(screen.getByText('第二条提示')).toBeTruthy()
  })

  it('alternates between visible and hidden without changing the tip while hiding', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9)
    render(<TipWidget tips={TIPS} interval={1000} />)

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('第二条提示')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1000))

    expect(card().classList.contains(styles.cardHidden)).toBe(true)
    expect(screen.getByText('第二条提示')).toBeTruthy()
  })

  it('pauses the timer while the card is hovered and restarts a full interval on leave', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9)
    render(<TipWidget tips={TIPS} interval={1000} />)

    act(() => vi.advanceTimersByTime(1000))
    fireEvent.mouseEnter(card())
    act(() => vi.advanceTimersByTime(2000))
    expect(card().classList.contains(styles.cardHidden)).toBe(false)

    fireEvent.mouseLeave(card())
    act(() => vi.advanceTimersByTime(999))
    expect(card().classList.contains(styles.cardHidden)).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(card().classList.contains(styles.cardHidden)).toBe(true)
  })

  it('stops after close and resumes the visible cycle when reopened', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9).mockReturnValueOnce(0)
    render(<TipWidget tips={TIPS} interval={1000} />)

    act(() => vi.advanceTimersByTime(1000))
    fireEvent.click(screen.getByRole('button', { name: '关闭小提示' }))
    act(() => vi.advanceTimersByTime(3000))
    expect(card().classList.contains(styles.cardHidden)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '小提示' }))
    expect(card().classList.contains(styles.cardHidden)).toBe(false)
    expect(screen.getByText('第一条提示')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1000))
    expect(card().classList.contains(styles.cardHidden)).toBe(true)
  })
})
