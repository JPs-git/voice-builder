import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackCard } from '../components/FeedbackCard'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function setFrame(f0: number | null, f1: number | null, f2: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1, f2 }])
}

describe('FeedbackCard', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('renders nothing when no data', () => {
    const { container } = render(<FeedbackCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders hit result with 完美', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    render(<FeedbackCard />)
    expect(screen.getByText('目标区间')).toBeTruthy()
    expect(screen.getByText('完美')).toBeTruthy()
  })

  it('renders miss result with deviation hints', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), vowelA.f2[1] + 100)
    render(<FeedbackCard />)
    expect(screen.getByText('F2偏高')).toBeTruthy()
  })

  it('shows card header 实时反馈 when results exist', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    render(<FeedbackCard />)
    expect(screen.getByText('实时反馈')).toBeTruthy()
  })
})
