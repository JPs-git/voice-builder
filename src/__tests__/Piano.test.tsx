import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Piano } from '../components/Piano'
import { midiToName } from '../utils/pitch'

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

  it('labels every white key with its note name', () => {
    render(<Piano onKeyPress={() => {}} />)
    const naturalMidi = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72]
    for (const midi of naturalMidi) {
      const btn = screen.getByRole('button', { name: midiToName(midi) })
      expect(btn.textContent).toContain(midiToName(midi))
    }
  })

  it('shows no visible label on black keys', () => {
    render(<Piano onKeyPress={() => {}} />)
    const blackMidi = [49, 51, 54, 56, 58, 61, 63, 66, 68, 70]
    for (const midi of blackMidi) {
      const btn = screen.getByRole('button', { name: midiToName(midi) })
      expect(btn.textContent).toBe('')
    }
  })
})