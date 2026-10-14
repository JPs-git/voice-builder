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

  it('renders vowel buttons seeded with the active preset', () => {
    render(<TrainingGoalCard />)
    expect(screen.getByRole('button', { name: 'a' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('switches bands when a vowel button is clicked', () => {
    render(<TrainingGoalCard />)
    fireEvent.click(screen.getByRole('button', { name: 'i' }))
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

  it('clamps F2 lower to F1 upper and explains the correction', () => {
    render(<TrainingGoalCard />)
    const input = screen.getByLabelText('F2下限')
    fireEvent.change(input, { target: { value: '800' } })
    fireEvent.blur(input)
    expect(useAppStore.getState().bands.f2.range[0]).toBe(1000)
    expect(screen.getByRole('status').textContent).toContain('F2 下限不能低于 F1 上限')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('status').id)
    expect(screen.getByRole('status').parentElement).not.toBe(input.closest('label')!.parentElement)
  })

  it('clamps an invalid own range to the 50 Hz interval', () => {
    render(<TrainingGoalCard />)
    const input = screen.getByLabelText('F1下限') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1200' } })
    fireEvent.blur(input)
    expect(input.value).toBe('950')
    expect(screen.getByRole('status').textContent).toContain('至少相隔 50 Hz')
  })

  it('resets all vowels and switches back to a after confirmation, like desktop', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TrainingGoalCard />)
    const input = screen.getByLabelText('F1下限')
    fireEvent.change(input, { target: { value: '700' } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('button', { name: 'o' }))
    fireEvent.change(input, { target: { value: '400' } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByLabelText('重置所有预设'))
    expect(useAppStore.getState().activePreset).toBe('vowel-a')
    expect(useAppStore.getState().bands.f1.range).toEqual(VOWEL_PRESETS['vowel-a'].f1)
    expect(useAppStore.getState().presetOverrides).toEqual([])
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('全部元音'))
  })

  it('clamps F0 to the chart ceiling only after blur', () => {
    render(<TrainingGoalCard />)
    const f0Hi = screen.getByLabelText('F0上限') as HTMLInputElement
    fireEvent.change(f0Hi, { target: { value: '1400' } })
    expect(useAppStore.getState().bands.f0.range[1]).toBe(280)
    fireEvent.blur(f0Hi)
    expect(useAppStore.getState().bands.f0.range[1]).toBe(500)
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

  it('renders the form without duplicating the modal title', () => {
    render(<TrainingGoalCard />)
    expect(screen.getByText('元音选择')).toBeTruthy()
    expect(screen.getByLabelText('重置所有预设')).toBeTruthy()
  })

  it('offers all six vowel buttons', () => {
    render(<TrainingGoalCard />)
    for (const label of ['a', 'o', 'e', 'i', 'u', 'ü']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('offers the same reset control label as desktop', () => {
    render(<TrainingGoalCard />)
    expect(screen.getByLabelText('重置所有预设')).toBeTruthy()
  })

  it('has no decorative chevron in the 70px single-row card', () => {
    render(<TrainingGoalCard />)
    expect(screen.queryByText('›')).toBeNull()
  })
})
