import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackHero, statusGlyph } from '../components/mobile/FeedbackHero'
import { useAppStore } from '../store/appStore'
import type { FormantStatus } from '../feedback/status'
import type { VoiceRegister } from '../types'

function setFrame(
  f0: number | null,
  f1: number | null,
  f2: number | null,
  register?: VoiceRegister | null,
) {
  useAppStore.getState().setLatestFrame({ time: 1, f0, f1, f2, register })
}

describe('statusGlyph', () => {
  it('maps each status to its glyph', () => {
    const cases: [FormantStatus, string][] = [
      ['hit', '✓'],
      ['low', '↓'],
      ['high', '↑'],
      ['none', '—'],
    ]
    for (const [status, glyph] of cases) {
      expect(statusGlyph(status)).toBe(glyph)
    }
  })
})

describe('FeedbackHero', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('shows a waiting badge and a placeholder before any frame arrives', () => {
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-badge').textContent).toBe('等待声音')
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
  })

  it('shows the current F0 as a large readout', () => {
    setFrame(245, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-f0').textContent).toBe('245')
  })

  it.each([
    ['chest', '真声'],
    ['mixed', '混声'],
    ['falsetto', '假声'],
    ['unvoiced', '等待声音'],
    [null, '等待声音'],
    [undefined, '等待声音'],
  ] as const)('shows the algorithm register %s as %s', (register, label) => {
    setFrame(240, 900, 1200, register)
    render(<FeedbackHero />)
    const badge = screen.getByTestId('hero-badge')
    expect(badge.textContent).toBe(label)
    expect(badge.getAttribute('data-register')).toBe(register ?? 'unvoiced')
  })

  it('keeps the register badge independent of target deviations', () => {
    setFrame(300, 700, 1200, 'chest')
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-badge').textContent).toBe('真声')
  })

  it('keeps the register when every frequency series is hidden', () => {
    for (const key of ['f0', 'f1', 'f2'] as const) useAppStore.getState().toggleFormantVisible(key)
    setFrame(240, 900, 1200, 'falsetto')
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-badge').textContent).toBe('假声')
    expect(screen.queryByTestId('hero-col-f0')).toBeNull()
  })

  it('renders F0/F1/F2 values inline in one row', () => {
    setFrame(245, 920, 1250)
    render(<FeedbackHero />)
    for (const key of ['f0', 'f1', 'f2'] as const) {
      const cell = screen.getByTestId(`hero-col-${key}`)
      expect(cell.textContent).toMatch(/\d+/)
      expect(cell.textContent).toContain(key.toUpperCase())
    }
  })

  it('hides bands toggled invisible', () => {
    useAppStore.getState().toggleFormantVisible('f2')
    setFrame(240, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.queryByTestId('hero-col-f2')).toBeNull()
    expect(screen.getByTestId('hero-col-f1')).toBeTruthy()
  })

  it('shows Hz units for each frequency in the single row', () => {
    setFrame(245, 920, 1250)
    render(<FeedbackHero />)
    expect(screen.getAllByText('Hz')).toHaveLength(3)
  })

  it('shows no status circles in the single row', () => {
    setFrame(245, 920, 1250)
    render(<FeedbackHero />)
    expect(screen.queryByTestId('hero-col-f0-status')).toBeNull()
    expect(screen.queryByTestId('hero-col-f1-status')).toBeNull()
    expect(screen.queryByTestId('hero-col-f2-status')).toBeNull()
  })

  it('omits the register row to match the 390px design', () => {
    setFrame(240, 900, 1200, 'chest')
    render(<FeedbackHero />)
    expect(screen.queryByTestId('hero-register')).toBeNull()
  })

  it('treats a non-finite or non-positive F0 as missing', () => {
    setFrame(0, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
  })
})
