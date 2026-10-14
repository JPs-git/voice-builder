import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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
      ['none', ''],
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

  it('shows only frequency placeholders before any frame arrives', () => {
    render(<FeedbackHero />)
    expect(screen.queryByRole('group', { name: /^声区：/ })).toBeNull()
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
    expect(screen.queryAllByText('Hz')).toHaveLength(0)
  })

  it('shows the current F0 as a large readout', () => {
    setFrame(245, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-f0').textContent).toBe('245')
  })

  it.each(['chest', 'mixed', 'falsetto', 'unvoiced', null, undefined] as const)(
    'does not display a register badge for %s', register => {
    setFrame(240, 900, 1200, register)
    render(<FeedbackHero />)
    expect(screen.queryByRole('group', { name: /^声区：/ })).toBeNull()
    expect(screen.queryByText(/^(真声|混声|假声)$/)).toBeNull()
  })

  it('hides all requested frequency columns', () => {
    for (const key of ['f0', 'f1', 'f2'] as const) useAppStore.getState().toggleFormantVisible(key)
    setFrame(240, 900, 1200, 'falsetto')
    render(<FeedbackHero />)
    expect(screen.getByRole('region', { name: '实时反馈' })).toBeTruthy()
    for (const key of ['f0', 'f1', 'f2']) expect(screen.queryByTestId(`hero-col-${key}`)).toBeNull()
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

  it('treats a non-finite or non-positive F0 as missing', () => {
    setFrame(0, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
  })

  it('shows independent high and low directions', () => {
    setFrame(300, 700, 1200, 'mixed')
    render(<FeedbackHero />)
    const high = screen.getByTestId('hero-col-f0')
    const low = screen.getByTestId('hero-col-f1')
    const hit = screen.getByTestId('hero-col-f2')
    expect(high.getAttribute('data-status')).toBe('high')
    expect(low.getAttribute('data-status')).toBe('low')
    expect(hit.getAttribute('data-status')).toBe('hit')
    expect(within(high).getByText('↑').getAttribute('aria-hidden')).toBe('true')
    expect(within(low).getByText('↓').getAttribute('aria-hidden')).toBe('true')
    expect(within(high).getByText('Hz').nextElementSibling).toBe(within(high).getByText('↑'))
    expect(within(low).getByText('Hz').nextElementSibling).toBe(within(low).getByText('↓'))
    expect(hit.textContent).not.toMatch(/[↑↓]/)
    expect(within(hit).getByText('Hz').nextElementSibling).toBe(within(hit).getByText('✓'))
    expect(within(hit).getByText('✓').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByLabelText('F0 300 Hz，高于目标范围')).toBe(high)
    expect(screen.getByLabelText('F1 700 Hz，低于目标范围')).toBe(low)
    expect(screen.getByLabelText('F2 1200 Hz，目标范围内')).toBe(hit)
    expect(screen.queryByRole('group', { name: /^声区：/ })).toBeNull()
  })

  it.each([
    [200, 'hit', '✓'], [280, 'hit', '✓'], [199.9, 'low', '↓'], [280.1, 'high', '↑'],
  ])('compares unrounded F0 %s with inclusive target boundaries', (value, status, glyph) => {
    setFrame(value as number, 900, 1200, 'chest')
    render(<FeedbackHero />)
    const cell = screen.getByTestId('hero-col-f0')
    expect(cell.getAttribute('data-status')).toBe(status)
    expect(screen.getByTestId('hero-f0').textContent).toBe(String(Math.round(value as number)))
    if (glyph) expect(within(cell).getByText(glyph)).toBeTruthy()
    else expect(cell.textContent).not.toMatch(/[↑↓✓]/)
  })

  it.each(['f0', 'f1', 'f2'] as const)('shows no direction for invalid %s data', key => {
    render(<FeedbackHero />)
    for (const value of [null, undefined, NaN, Infinity, -Infinity, 0, -1]) {
      act(() => useAppStore.getState().setLatestFrame({
        time: 1, f0: 300, f1: 700, f2: 1200, register: 'chest', [key]: value,
      }))
      const cell = screen.getByTestId(`hero-col-${key}`)
      expect(cell.getAttribute('data-status')).toBe('none')
      expect(within(cell).getByText('--')).toBeTruthy()
      expect(within(cell).queryByText('Hz')).toBeNull()
      expect(cell.textContent).not.toMatch(/[↑↓✓]/)
      expect(screen.getByLabelText(`${key.toUpperCase()} 暂无有效数据`)).toBe(cell)
    }
  })

  it('updates directions on target edits, preset changes and new frames', () => {
    setFrame(300, 700, 1200, 'chest')
    render(<FeedbackHero />)
    const cell = screen.getByTestId('hero-col-f0')
    expect(cell.getAttribute('data-status')).toBe('high')
    act(() => useAppStore.getState().setBands({ f0: [290, 310] }))
    expect(cell.getAttribute('data-status')).toBe('hit')
    expect(cell.textContent).not.toMatch(/[↑↓]/)
    expect(within(cell).getByText('✓')).toBeTruthy()
    act(() => useAppStore.getState().switchPreset('vowel-a'))
    expect(cell.getAttribute('data-status')).toBe('high')
    act(() => setFrame(190, 900, 1200, 'falsetto'))
    expect(cell.getAttribute('data-status')).toBe('low')
    expect(within(cell).getByText('↓')).toBeTruthy()
    expect(screen.queryByRole('group', { name: /^声区：/ })).toBeNull()
    act(() => useAppStore.getState().toggleFormantVisible('f1'))
    expect(screen.queryByTestId('hero-col-f1')).toBeNull()
  })
})
