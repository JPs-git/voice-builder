import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

describe('TargetPresetBar', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
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

  it('updates bands in store when vowel button clicked', () => {
    render(<TargetPresetBar />)
    fireEvent.click(screen.getByText('i'))
    const vowelI = VOWEL_PRESETS['vowel-i']
    const { bands } = useAppStore.getState()
    expect(bands.f0.range).toEqual(vowelI.f0)
    expect(bands.f1.range).toEqual(vowelI.f1)
  })

  it('displays current band values from store', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement
    const f0Hi = screen.getByLabelText('F0上限') as HTMLInputElement
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(f0Hi.value).toBe(String(vowelA.f0[1]))
  })

  it('allows editing band values via input', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: '' } })
    expect(f0Lo.value).toBe('')

    fireEvent.change(f0Lo, { target: { value: '250' } })
    expect(f0Lo.value).toBe('250')

    fireEvent.blur(f0Lo)
    expect(useAppStore.getState().bands.f0.range).toEqual([250, vowelA.f0[1]])
  })

  it('reverts invalid input on blur', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: 'abc' } })
    fireEvent.blur(f0Lo)
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(useAppStore.getState().bands.f0.range).toEqual(vowelA.f0)
  })

  it('reverts when low >= high', () => {
    const vowelA = VOWEL_PRESETS['vowel-a']
    render(<TargetPresetBar />)
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: '500' } })
    fireEvent.blur(f0Lo)
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(useAppStore.getState().bands.f0.range).toEqual(vowelA.f0)
  })
})
