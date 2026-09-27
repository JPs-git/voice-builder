import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackHero, resolveBadge, statusGlyph } from '../components/mobile/FeedbackHero'
import { useAppStore } from '../store/appStore'
import type { FormantStatus } from '../feedback/status'
import type { VoiceRegister } from '../types'

function setFrame(
  f0: number | null,
  f1: number | null,
  f2: number | null,
  register?: VoiceRegister,
) {
  useAppStore.getState().setLatestFrame({ time: 1, f0, f1, f2, register })
}

describe('resolveBadge', () => {
  it('reports waiting when there are no statuses', () => {
    expect(resolveBadge([])).toEqual({ tone: 'idle', text: '等待声音' })
  })

  it('reports in-range when every meaningful status hits', () => {
    expect(resolveBadge(['hit', 'hit', 'hit'])).toEqual({ tone: 'hit', text: '目标范围内' })
  })

  it('reports high when any status is high', () => {
    expect(resolveBadge(['hit', 'high', 'low'])).toEqual({ tone: 'warn', text: '偏高' })
  })

  it('reports low when there is a low and no high', () => {
    expect(resolveBadge(['low', 'hit', 'hit'])).toEqual({ tone: 'warn', text: '偏低' })
  })

  it('treats none as neither hit nor warn', () => {
    expect(resolveBadge(['none', 'none', 'none'])).toEqual({ tone: 'idle', text: '等待声音' })
  })
})

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

  it('shows the in-range badge when every visible band is inside its range', () => {
    const { bands } = useAppStore.getState()
    setFrame(240, bands.f1.range[0] + 10, bands.f2.range[0] + 10)
    render(<FeedbackHero />)
    const badge = screen.getByTestId('hero-badge')
    expect(badge.textContent).toBe('目标范围内')
    expect(badge.getAttribute('data-tone')).toBe('hit')
  })

  it('shows the low badge when a band falls under its range', () => {
    const { bands } = useAppStore.getState()
    setFrame(240, bands.f1.range[0] - 50, bands.f2.range[0] + 10)
    render(<FeedbackHero />)
    const badge = screen.getByTestId('hero-badge')
    expect(badge.textContent).toBe('偏低')
    expect(badge.getAttribute('data-tone')).toBe('warn')
  })

  it('renders one column per visible band with its status glyph', () => {
    useAppStore.getState().toggleFormantVisible('f2')
    setFrame(240, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.queryByTestId('hero-col-f2')).toBeNull()
    expect(screen.getByTestId('hero-col-f1')).toBeTruthy()
    expect(screen.getByTestId('hero-col-f1-status').textContent).toBe('✓')
  })

  it('marks each column with its data-status', () => {
    const { bands } = useAppStore.getState()
    setFrame(240, bands.f1.range[0] - 50, bands.f2.range[1] + 100)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-col-f0').getAttribute('data-status')).toBe('hit')
    expect(screen.getByTestId('hero-col-f1').getAttribute('data-status')).toBe('low')
    expect(screen.getByTestId('hero-col-f2').getAttribute('data-status')).toBe('high')
    expect(screen.getByTestId('hero-col-f1-status').textContent).toBe('↓')
    expect(screen.getByTestId('hero-col-f2-status').textContent).toBe('↑')
  })

  it('shows the detected voice register', () => {
    setFrame(240, 900, 1200, 'chest')
    render(<FeedbackHero />)
    const register = screen.getByTestId('hero-register')
    expect(register.textContent).toBe('真声')
    expect(register.getAttribute('data-register')).toBe('chest')
  })

  it('falls back to the unvoiced register when the frame carries none', () => {
    setFrame(240, 900, 1200)
    render(<FeedbackHero />)
    const register = screen.getByTestId('hero-register')
    expect(register.textContent).toBe('—')
    expect(register.getAttribute('data-register')).toBe('unvoiced')
  })

  it('treats a non-finite or non-positive F0 as missing', () => {
    setFrame(0, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
  })
})
