import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '../components/EmptyState'

describe('EmptyState', () => {
  it('invokes its optional action and hides it when the empty state disappears', () => {
    const onClick = vi.fn()
    const view = render(<EmptyState title="t" description="d" action={{ label: '查看上手步骤', onClick }} />)
    fireEvent.click(screen.getByRole('button', { name: '查看上手步骤' }))
    expect(onClick).toHaveBeenCalledOnce()
    view.rerender(<EmptyState title="t" description="d" visible={false} action={{ label: '查看上手步骤', onClick }} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('renders title+description without icon when icon prop is absent', () => {
    render(<EmptyState title="还没有声音数据" description="🎤 点击顶栏'开始录音'试试" />)
    expect(screen.getByText('还没有声音数据')).toBeTruthy()
    expect(screen.getByText("🎤 点击顶栏'开始录音'试试")).toBeTruthy()
    expect(screen.queryByTestId('empty-icon')).toBeNull()
  })

  it('renders the icon element when icon="🎙" is passed', () => {
    render(<EmptyState title="t" description="d" icon="🎙" />)
    expect(screen.getByTestId('empty-icon')).toBeTruthy()
    expect(screen.getByTestId('empty-icon').textContent).toBe('🎙')
  })

  it('portrait F0 copy renders title+description+icon', () => {
    render(<EmptyState title="还没有声音数据" description="点击下方开始录音" icon="🎙" />)
    expect(screen.getByText('还没有声音数据')).toBeTruthy()
    expect(screen.getByText('点击下方开始录音')).toBeTruthy()
    expect(screen.getByTestId('empty-icon')).toBeTruthy()
    expect(screen.getByTestId('empty-icon').textContent).toBe('🎙')
  })
})
