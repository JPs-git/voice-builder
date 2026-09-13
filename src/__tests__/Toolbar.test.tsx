import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from '../components/Toolbar'
import type { ToolItem } from '../hooks/useToolbar'

const ITEMS: ToolItem[] = [
  { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
]

describe('Toolbar', () => {
  it('renders centered nav button when nav prop is provided', () => {
    render(
      <Toolbar
        toolItems={ITEMS}
        onToolClick={() => {}}
        nav={{ label: '⇄ 钢琴训练', onClick: vi.fn() }}
      />,
    )
    expect(screen.getByRole('button', { name: /钢琴训练/ })).toBeDefined()
  })

  it('omits nav region when nav prop is undefined', () => {
    render(<Toolbar toolItems={ITEMS} onToolClick={() => {}} />)
    expect(screen.queryByRole('button', { name: /钢琴训练/ })).toBeNull()
  })

  it('fires nav onClick', () => {
    const onNav = vi.fn()
    render(
      <Toolbar
        toolItems={ITEMS}
        onToolClick={() => {}}
        nav={{ label: '⇄ 返回分析', onClick: onNav }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /返回分析/ }))
    expect(onNav).toHaveBeenCalledTimes(1)
  })
})