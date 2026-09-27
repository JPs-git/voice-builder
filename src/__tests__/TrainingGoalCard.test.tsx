import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('shows the active preset short label next to the dropdown', () => {
    useAppStore.setState({ activePreset: 'vowel-u' })
    render(<TrainingGoalCard />)
    expect(screen.getByTestId('goal-preset-label').textContent).toBe('u')
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

  it('exposes a reset control for all presets', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TrainingGoalCard />)
    fireEvent.click(screen.getByLabelText('重置所有预设'))
    expect(useAppStore.getState().activePreset).toBe('vowel-a')
    expect(useAppStore.getState().presetOverrides).toHaveLength(0)
    confirmSpy.mockRestore()
  })

  it('renders a decorative chevron', () => {
    render(<TrainingGoalCard />)
    const chevron = screen.getByText('›')
    expect(chevron.getAttribute('aria-hidden')).toBe('true')
  })
})
