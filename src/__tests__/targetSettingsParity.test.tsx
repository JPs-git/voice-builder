import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TrainingGoalCard } from '../components/mobile/TrainingGoalCard'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

beforeEach(() => useAppStore.getState().reset())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function customizeTwoVowels() {
  const state = useAppStore.getState()
  state.savePresetOverride('vowel-a', [200, 280], [700, 1000], [1100, 1400])
  state.savePresetOverride('vowel-o', [200, 280], [400, 620], [700, 1000])
  state.switchPreset('vowel-o')
}

describe.each([['portrait', TrainingGoalCard], ['desktop', TargetPresetBar]] as const)('%s target behavior', (_name, Component) => {
  it('resets every vowel and returns to a with the shared confirmation', () => {
    customizeTwoVowels()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Component />)
    fireEvent.click(screen.getByLabelText('重置所有预设'))
    expect(window.confirm).toHaveBeenCalledWith('确定要恢复全部元音的默认目标吗？所有自定义目标将被清除，并切换到元音 a。')
    expect(useAppStore.getState().presetOverrides).toEqual([])
    expect(useAppStore.getState().activePreset).toBe('vowel-a')
    expect(useAppStore.getState().bands.f1.range).toEqual(VOWEL_PRESETS['vowel-a'].f1)
  })

  it('keeps every override and current selection when reset is cancelled', () => {
    customizeTwoVowels()
    const before = useAppStore.getState().presetOverrides
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Component />)
    fireEvent.click(screen.getByLabelText('重置所有预设'))
    expect(useAppStore.getState().presetOverrides).toEqual(before)
    expect(useAppStore.getState().activePreset).toBe('vowel-o')
  })

  it('clears a validation message even when resetting already-default bands', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Component />)
    const input = screen.getByLabelText('F0下限')
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.blur(input)
    expect(screen.getByRole('status')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('重置所有预设'))
    expect(screen.queryByRole('status')).toBeNull()
    expect((input as HTMLInputElement).value).toBe('200')
  })

  it.each([
    ['F1下限', '1200', '950'], ['F1上限', '700', '850'],
    ['F2下限', '800', '1000'], ['F2上限', '900', '1150'],
  ])('clamps %s on blur with the same rule', (label, entered, expected) => {
    render(<Component />)
    const input = screen.getByLabelText(label) as HTMLInputElement
    const before = input.value
    fireEvent.change(input, { target: { value: entered } })
    const key = label.startsWith('F1') ? 'f1' : 'f2'
    const index = label.endsWith('下限') ? 0 : 1
    expect(useAppStore.getState().bands[key].range[index]).toBe(Number(before))
    fireEvent.blur(input)
    expect(input.value).toBe(expected)
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
