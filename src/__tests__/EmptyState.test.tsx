import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../components/EmptyState'

describe('EmptyState', () => {
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
