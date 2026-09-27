import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrainingGoalCard } from '../components/mobile/TrainingGoalCard'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { VOWEL_PRESETS } from '../types'

describe('TrainingGoalCard', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a preset dropdown seeded with the active preset and all six vowels', () => {
    render(<TrainingGoalCard />)
    const select = screen.getByLabelText('选择元音预设') as HTMLSelectElement
    expect(select.value).toBe('vowel-a')
    for (const short of ['a', 'o', 'e', 'i', 'u', 'ü']) {
      expect(screen.getByRole('option', { name: short })).toBeTruthy()
    }
  })

  it('switches bands when a preset is chosen from the dropdown', () => {
    render(<TrainingGoalCard />)
    const select = screen.getByLabelText('选择元音预设') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'vowel-i' } })
    const vowelI = VOWEL_PRESETS['vowel-i']
    expect(useAppStore.getState().bands.f1.range).toEqual(vowelI.f1)
    expect(useAppStore.getState().bands.f2.range).toEqual(vowelI.f2)
  })

  it('edits band ranges inline and persists a preset override', () => {
    render(<TrainingGoalCard />)
    const f1Lo = screen.getByLabelText('F1下限') as HTMLInputElement
    const vowelA = VOWEL_PRESETS['vowel-a']
    fireEvent.change(f1Lo, { target: { value: '700' } })
    fireEvent.blur(f1Lo)
    expect(useAppStore.getState().bands.f1.range).toEqual([700, vowelA.f1[1]])
    const override = useAppStore.getState().presetOverrides.find(o => o.key === 'vowel-a')
    expect(override?.f1[0]).toBe(700)
  })

  it('clamps F0 to the detection ceiling', () => {
    render(<TrainingGoalCard />)
    const f0Hi = screen.getByLabelText('F0上限') as HTMLInputElement
    fireEvent.change(f0Hi, { target: { value: '1400' } })
    expect(useAppStore.getState().bands.f0.range[1]).toBe(1000)
  })

  it('commits the edited band and blurs the input on Enter', () => {
    render(<TrainingGoalCard />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement
    f0Lo.focus()
    fireEvent.change(f0Lo, { target: { value: '260' } })
    fireEvent.keyDown(f0Lo, { key: 'Enter' })
    expect(useAppStore.getState().bands.f0.range[0]).toBe(260)
    expect(document.activeElement).not.toBe(f0Lo)
  })

  it('renders the design header with target icon, title and chevron', () => {
    render(<TrainingGoalCard />)
    expect(screen.getByText('训练目标')).toBeTruthy()
    expect(screen.getByLabelText('训练目标图标')).toBeTruthy()
  })

  it('omits the reset control to match the 390px design', () => {
    render(<TrainingGoalCard />)
    expect(screen.queryByLabelText('重置所有预设')).toBeNull()
  })

  it('renders a decorative chevron', () => {
    render(<TrainingGoalCard />)
    const chevron = screen.getByText('›')
    expect(chevron.getAttribute('aria-hidden')).toBe('true')
  })
})
