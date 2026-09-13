import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Piano } from '../components/Piano'

describe('Piano', () => {
  it('renders 25 keys (C3-C5 inclusive)', () => {
    render(<Piano onKeyPress={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(25)
  })

  it('fires onKeyPress with the midi note on click', () => {
    const onKeyPress = vi.fn()
    render(<Piano onKeyPress={onKeyPress} />)
    fireEvent.click(screen.getByRole('button', { name: 'C4' }))
    expect(onKeyPress).toHaveBeenCalledWith(60)
  })

  it('highlights the current midi note', () => {
    render(<Piano currentMidi={61} onKeyPress={() => {}} />)
    const csharp4 = screen.getByRole('button', { name: 'C#4' })
    expect(csharp4.getAttribute('data-active')).toBe('true')
    const c4 = screen.getByRole('button', { name: 'C4' })
    expect(c4.getAttribute('data-active')).toBe('false')
  })

  it('holds no active key when currentMidi is null', () => {
    render(<Piano currentMidi={null} onKeyPress={() => {}} />)
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('data-active')).not.toBe('true')
    }
  })

  it('labels the C octave keys C3/C4/C5', () => {
    render(<Piano onKeyPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'C3' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'C4' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'C5' })).toBeDefined()
  })
})