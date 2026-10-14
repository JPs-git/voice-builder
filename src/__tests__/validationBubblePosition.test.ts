import { expect, it } from 'vitest'
import { placeValidationBubble } from '../components/mobile/validationBubblePosition'

it('moves a bubble above earlier sliders without covering them or the current input', () => {
  const result = placeValidationBubble(
    { left: 30, top: 440, width: 300 }, 90,
    { left: 0, top: 0, width: 390, height: 844 },
    [{ top: 200, bottom: 252 }, { top: 350, bottom: 402 }],
  )
  expect(result.top + result.height).toBeLessThanOrEqual(350 - 8)
  expect(result.top).toBeGreaterThanOrEqual(252)
})

it('keeps a bubble in the visible viewport when the input is scrolled close to the top', () => {
  const result = placeValidationBubble(
    { left: 30, top: 130, width: 300 }, 120,
    { left: 0, top: 0, width: 390, height: 300 },
    [{ top: 100, bottom: 120 }],
  )
  expect(result.top).toBeGreaterThanOrEqual(8)
  expect(result.top + result.height).toBeLessThanOrEqual(92)
})
