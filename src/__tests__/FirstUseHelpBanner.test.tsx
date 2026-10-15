import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FirstUseHelpBanner } from '../components/mobile/FirstUseHelpBanner'

describe('floating first-use help', () => {
  it('uses the approved copy, dock offset and independent actions', () => {
    const onOpen = vi.fn(), onDismiss = vi.fn()
    render(<FirstUseHelpBanner visible suppressed={false} dockHeight={90} onOpen={onOpen} onDismiss={onDismiss} />)
    const region = screen.getByRole('region', { name: '首次使用帮助' })
    expect(region.style.bottom).toBe('100px')
    expect(screen.getByText('第一次使用？')).toBeTruthy()
    expect(screen.getByText('了解录音、读图与目标设置')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '查看说明' }))
    expect(onOpen).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '关闭首次使用提示' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('retains suppressed triggers but disables them, and waits for a measured dock', () => {
    const onOpen = vi.fn()
    const props = { visible: true, suppressed: false, dockHeight: 0, onOpen, onDismiss: vi.fn() }
    const view = render(<FirstUseHelpBanner {...props} />)
    expect(screen.queryByRole('region')).toBeNull()
    view.rerender(<FirstUseHelpBanner {...props} dockHeight={76} />)
    const button = screen.getByRole('button', { name: '查看说明' })
    view.rerender(<FirstUseHelpBanner {...props} dockHeight={76} suppressed />)
    expect(button.isConnected).toBe(true)
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button)
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.queryByRole('region')).toBeNull()
    view.rerender(<FirstUseHelpBanner {...props} dockHeight={76} visible={false} />)
    expect(button.isConnected).toBe(false)
  })
})
