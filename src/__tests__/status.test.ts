import { describe, it, expect } from 'vitest'
import { getFormantStatus } from '../feedback/status'

describe('getFormantStatus', () => {
  it('returns hit when value is inside range', () => {
    expect(getFormantStatus(300, [200, 400])).toBe('hit')
  })

  it('returns hit when value equals lower bound', () => {
    expect(getFormantStatus(200, [200, 400])).toBe('hit')
  })

  it('returns hit when value equals upper bound', () => {
    expect(getFormantStatus(400, [200, 400])).toBe('hit')
  })

  it('returns low when value is below lower bound', () => {
    expect(getFormantStatus(100, [200, 400])).toBe('low')
  })

  it('returns high when value is above upper bound', () => {
    expect(getFormantStatus(500, [200, 400])).toBe('high')
  })

  it('returns none for null', () => {
    expect(getFormantStatus(null, [200, 400])).toBe('none')
  })

  it('returns none for undefined', () => {
    expect(getFormantStatus(undefined, [200, 400])).toBe('none')
  })

  it('returns none for non-finite value', () => {
    expect(getFormantStatus(NaN, [200, 400])).toBe('none')
    expect(getFormantStatus(Infinity, [200, 400])).toBe('none')
  })
})
