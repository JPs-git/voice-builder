import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ContextHelpButton } from '../components/ContextHelpButton'

describe('ContextHelpButton', () => {
  it('provides a named native button and opens only on activation', () => {
    const onClick = vi.fn()
    render(<ContextHelpButton label="基频图说明" onClick={onClick} />)
    const button = screen.getByRole('button', { name: '基频图说明' })
    button.focus()
    fireEvent.mouseEnter(button)
    expect(document.activeElement).toBe(button)
    expect(button.tagName).toBe('BUTTON')
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
