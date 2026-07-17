import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { VOWEL_PRESETS } from '../types'
import type { TargetBands } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']
const defaultBands: TargetBands = {
  f0: { range: vowelA.f0, color: '#10B981' },
  f1: { range: vowelA.f1, color: '#3B82F6' },
  f2: { range: vowelA.f2, color: '#F59E0B' },
}

describe('TargetPresetBar', () => {
  it('renders vowel preset buttons', () => {
    render(
      <TargetPresetBar
        activePreset="vowel-a"
        bands={defaultBands}
        onPresetSelect={() => {}}
        onBandsChange={() => {}}
      />
    )
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('o')).toBeTruthy()
    expect(screen.getByText('e')).toBeTruthy()
    expect(screen.getByText('i')).toBeTruthy()
    expect(screen.getByText('u')).toBeTruthy()
    expect(screen.getByText('ü')).toBeTruthy()
  })

  it('calls onPresetSelect when vowel button clicked', () => {
    const onSelect = vi.fn()
    render(
      <TargetPresetBar
        activePreset="vowel-a"
        bands={defaultBands}
        onPresetSelect={onSelect}
        onBandsChange={() => {}}
      />
    )
    fireEvent.click(screen.getByText('i'))
    expect(onSelect).toHaveBeenCalledWith('vowel-i')
  })

  it('displays current band values from props', () => {
    render(
      <TargetPresetBar
        activePreset="vowel-a"
        bands={defaultBands}
        onPresetSelect={() => {}}
        onBandsChange={() => {}}
      />
    )
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement
    const f0Hi = screen.getByLabelText('F0上限') as HTMLInputElement
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(f0Hi.value).toBe(String(vowelA.f0[1]))
  })

  it('allows clearing and typing new value in input', () => {
    const onBandsChange = vi.fn()
    render(
      <TargetPresetBar
        activePreset="vowel-a"
        bands={defaultBands}
        onPresetSelect={() => {}}
        onBandsChange={onBandsChange}
      />
    )
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: '' } })
    expect(f0Lo.value).toBe('')

    fireEvent.change(f0Lo, { target: { value: '250' } })
    expect(f0Lo.value).toBe('250')

    fireEvent.blur(f0Lo)
    expect(onBandsChange).toHaveBeenCalledWith({ f0: [250, vowelA.f0[1]] })
  })

  it('reverts to original value on blur with invalid input', () => {
    const onBandsChange = vi.fn()
    render(
      <TargetPresetBar
        activePreset="vowel-a"
        bands={defaultBands}
        onPresetSelect={() => {}}
        onBandsChange={onBandsChange}
      />
    )
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: 'abc' } })
    fireEvent.blur(f0Lo)
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(onBandsChange).not.toHaveBeenCalled()
  })

  it('reverts when low >= high after blur', () => {
    const onBandsChange = vi.fn()
    render(
      <TargetPresetBar
        activePreset="vowel-a"
        bands={defaultBands}
        onPresetSelect={() => {}}
        onBandsChange={onBandsChange}
      />
    )
    const f0Lo = screen.getByLabelText('F0下限') as HTMLInputElement

    fireEvent.change(f0Lo, { target: { value: '500' } })
    fireEvent.blur(f0Lo)
    expect(f0Lo.value).toBe(String(vowelA.f0[0]))
    expect(onBandsChange).not.toHaveBeenCalled()
  })
})
