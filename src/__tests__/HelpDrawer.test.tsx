import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HelpDrawer } from '../components/HelpDrawer'
import type { HelpTopic } from '../content/helpContent'

function Harness({ initial = 'quick-start' }: { initial?: HelpTopic }) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState(initial)
  return <><button onClick={() => setOpen(true)}>打开帮助</button>
    <HelpDrawer open={open} onClose={() => setOpen(false)} topic={topic} onTopicChange={setTopic} /></>
}

describe('manual topic help', () => {
  it('opens only on request, selects chapters, traps focus and restores the trigger on Escape', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).toBeNull()
    const trigger = screen.getByRole('button', { name: '打开帮助' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: '使用说明' })
    const close = screen.getByRole('button', { name: '关闭' })
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '音高参考' }))
    fireEvent.click(screen.getByRole('button', { name: '训练目标' }))
    expect(screen.getByRole('button', { name: '训练目标' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('table', { name: /默认预设/ })).toBeTruthy()
    expect(screen.queryByText('F3 (Hz)')).toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('opens the requested chapter and updates instructions when layout changes', () => {
    const listeners = new Set<(event: { matches: boolean }) => void>()
    const mql = { matches: false, addEventListener: (_: string, listener: (e: { matches: boolean }) => void) => listeners.add(listener), removeEventListener: (_: string, listener: (e: { matches: boolean }) => void) => listeners.delete(listener) }
    vi.stubGlobal('matchMedia', vi.fn(() => mql))
    const view = render(<Harness initial="audio" />)
    fireEvent.click(screen.getByRole('button', { name: '打开帮助' }))
    expect(screen.getByRole('button', { name: '录音与导入' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/通过顶栏「导入音频」/)).toBeTruthy()
    act(() => { mql.matches = true; listeners.forEach(listener => listener({ matches: true })) })
    expect(screen.getByText(/更多 → 导入音频/)).toBeTruthy()
    expect(screen.getByText(/点击底部麦克风按钮开始录音/)).toBeTruthy()
    view.unmount()
    vi.unstubAllGlobals()
  })
})
