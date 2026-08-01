import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { Toast } from '../components/Toast'
import { useToastStore } from '../store/toastStore'
import styles from '../components/Toast.module.css'

function resetStore() {
  useToastStore.setState({ toasts: [] })
}

describe('Toast', () => {
  afterEach(() => {
    resetStore()
    vi.useRealTimers()
  })

  it('renders nothing when there are no toasts', () => {
    resetStore()
    const { container } = render(<Toast />)
    expect(container.firstChild).toBeNull()
  })

  it('renders toasts from the store with role=alert', () => {
    act(() => {
      useToastStore.getState().showToast('error', '仅支持 WAV 格式')
    })
    render(<Toast />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('仅支持 WAV 格式')
  })

  it('applies the error variant class for error toasts', () => {
    act(() => {
      useToastStore.getState().showToast('error', '出错了')
    })
    render(<Toast />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain(styles.error)
  })

  it('dismisses a toast when its close button is clicked', () => {
    act(() => {
      useToastStore.getState().showToast('info', '关闭我')
    })
    render(<Toast />)
    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }))
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('clears a toast automatically after the store timeout elapses', () => {
    vi.useFakeTimers()
    act(() => {
      useToastStore.getState().showToast('info', '自动消失')
    })
    render(<Toast />)
    expect(screen.getByText('自动消失')).toBeTruthy()

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByText('自动消失')).toBeNull()
  })
})
