import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import type { ToolItem } from '../hooks/useToolbar'

const ITEMS: ToolItem[] = [
  { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
  { id: 'import', variant: 'ghost', icon: '📁', label: '导入音频' },
  { id: 'playback', variant: 'ghost', icon: '♫', label: '回放' },
  { id: 'clear', variant: 'ghost', icon: '↺', label: '清空', disabled: true },
  { id: 'config', variant: 'ghost', icon: '⚙', label: '配置' },
  { id: 'help', variant: 'ghost', icon: '?', label: '帮助' },
  { id: 'about', variant: 'ghost', icon: 'ⓘ', label: '关于' },
]

function open() {
  fireEvent.click(screen.getByLabelText('更多操作'))
}

function menuItemNames() {
  return screen.getAllByRole('menuitem').map(node =>
    Array.from(node.children)
      .filter(child => child.getAttribute('aria-hidden') !== 'true')
      .map(child => child.textContent)
      .join(''),
  )
}

describe('MobileMoreMenu', () => {
  it('is collapsed until the trigger is tapped', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    expect(screen.queryByRole('menu')).toBeNull()
    open()
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('exposes every non-record tool in order', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    open()
    expect(menuItemNames()).toEqual([
      '导入音频',
      '回放',
      '清空',
      '配置',
      '帮助',
      '关于',
    ])
  })

  it('never surfaces the record tool owned by the dock', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    open()
    expect(screen.queryByText('开始录音')).toBeNull()
  })

  it('fires onSelect and closes after picking a tool', () => {
    const onSelect = vi.fn()
    render(<MobileMoreMenu items={ITEMS.map(i => (i.id === 'clear' ? { ...i, disabled: false } : i))} onSelect={onSelect} />)
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: '清空' }))
    expect(onSelect).toHaveBeenCalledWith('clear')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('ignores clicks on a disabled tool', () => {
    const onSelect = vi.fn()
    render(<MobileMoreMenu items={ITEMS} onSelect={onSelect} />)
    open()
    const clear = screen.getByRole('menuitem', { name: '清空' }) as HTMLButtonElement
    expect(clear.disabled).toBe(true)
    fireEvent.click(clear)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('toggles back to collapsed on a second trigger tap', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    open()
    open()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByLabelText('更多操作').getAttribute('aria-expanded')).toBe('false')
  })

  it('leads with the page-switch entry when nav is provided', () => {
    const onNav = vi.fn()
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} nav={{ label: '音高参考', onClick: onNav }} />)
    open()
    expect(menuItemNames()[0]).toBe('音高参考')
  })

  it('fires the nav action and closes after picking it', () => {
    const onNav = vi.fn()
    const onSelect = vi.fn()
    render(<MobileMoreMenu items={ITEMS} onSelect={onSelect} nav={{ label: '音高参考', onClick: onNav }} />)
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: '音高参考' }))
    expect(onNav).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('omits the page-switch entry when nav is absent', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    open()
    expect(menuItemNames()).toHaveLength(6)
  })
})
