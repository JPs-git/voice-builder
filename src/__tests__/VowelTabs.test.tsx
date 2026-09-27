import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VowelTabs } from '../components/mobile/VowelTabs'

const KEYS = ['vowel-a', 'vowel-o', 'vowel-e', 'vowel-i', 'vowel-u', 'vowel-yu'] as const

function renderTabs(active = 'vowel-a' as string) {
  const onSelect = vi.fn()
  render(<VowelTabs active={active} onSelect={onSelect} />)
  return onSelect
}

it('renders six vowel tabs in order', () => {
  renderTabs()
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['a', 'o', 'e', 'i', 'u', 'ü'])
})

it('marks the active tab pressed', () => {
  renderTabs('vowel-i')
  expect(screen.getByRole('button', { name: 'i' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'a' }).getAttribute('aria-pressed')).toBe('false')
})

it('dispatches onSelect with the preset key', () => {
  const onSelect = renderTabs()
  fireEvent.click(screen.getByRole('button', { name: 'u' }))
  expect(onSelect).toHaveBeenCalledWith('vowel-u')
})
