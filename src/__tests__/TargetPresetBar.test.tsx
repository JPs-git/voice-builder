import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { useAnalysisStore } from '../store/analysisStore'
import { VOWEL_PRESETS } from '../types'

describe('TargetPresetBar', () => {
  beforeEach(() => {
    useAnalysisStore.getState().reset()
  })

  it('renders vowel preset buttons', () => {
    render(<TargetPresetBar />)
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('o')).toBeTruthy()
    expect(screen.getByText('e')).toBeTruthy()
    expect(screen.getByText('i')).toBeTruthy()
    expect(screen.getByText('u')).toBeTruthy()
    expect(screen.getByText('ü')).toBeTruthy()
  })

  it('updates activePreset in store when vowel button clicked', () => {
    render(<TargetPresetBar />)
    fireEvent.click(screen.getByText('i'))
    expect(useAnalysisStore.getState().activePreset).toBe('vowel-i')
  })

  it('displays current band values from store', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement
    const f0Hi = screen.getByLabelText('F0上限') as HTMLInputElement
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(f0Hi.value).toBe(String(vowelA.f0[1]))
  })

  it('allows clearing and typing new value in input', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: '' } })
    expect(f0Lo.value).toBe('')

    fireEvent.change(f0Lo, { target: { value: '250' } })
    expect(f0Lo.value).toBe('250')

    fireEvent.blur(f0Lo)
    expect(useAnalysisStore.getState().bands.f0.range).toEqual([250, vowelA.f0[1]])
  })

  it('reverts to original value on blur with invalid input', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: 'abc' } })
    fireEvent.blur(f0Lo)
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(useAnalysisStore.getState().bands.f0.range).toEqual(vowelA.f0)
  })

  it('reverts when low >= high after blur', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: '500' } })
    fireEvent.blur(f0Lo)
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(useAnalysisStore.getState().bands.f0.range).toEqual(vowelA.f0)
  })
})
