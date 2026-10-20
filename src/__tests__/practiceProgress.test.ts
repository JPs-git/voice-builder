import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPracticeProgress } from '../analytics/practiceProgress'

const mocks = vi.hoisted(() => ({ allowed: true, page: 'analysis' as 'analysis' | 'practice' | 'recording' | null, track: vi.fn() }))
vi.mock('../analytics/analytics', () => ({
  isAnalyticsAllowed: () => mocks.allowed,
  getAnalyticsPage: () => mocks.page,
  track: mocks.track,
}))

beforeEach(() => {
  vi.resetModules()
  mocks.allowed = true
  mocks.page = 'analysis'
  mocks.track.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('recording participation', () => {
  it('accumulates across different rates, fires at thirty seconds once, and stores no audio', () => {
    const reached = vi.fn()
    const add = createPracticeProgress(reached)
    add(16000 * 10, 16000)
    add(48000 * 19, 48000)
    expect(reached).not.toHaveBeenCalled()
    add(48000, 48000)
    add(16000 * 60, 16000)
    expect(reached).toHaveBeenCalledExactlyOnceWith()
  })

  it('does not fire at 29.999 seconds and does fire at exactly thirty', () => {
    const reached = vi.fn()
    const add = createPracticeProgress(reached)
    add(479984, 16000)
    expect(reached).not.toHaveBeenCalled()
    add(16, 16000)
    expect(reached).toHaveBeenCalledTimes(1)
  })

  it('counts repeated small chunks despite floating-point rounding', () => {
    const reached = vi.fn()
    const add = createPracticeProgress(reached)
    for (let i = 0; i < 3000; i++) add(160, 16000)
    expect(reached).toHaveBeenCalledTimes(1)
  })

  it('ignores invalid counts and rates without poisoning later accumulation', () => {
    const reached = vi.fn()
    const add = createPracticeProgress(reached)
    for (const count of [0, -1, 1.5, NaN, Infinity]) add(count, 16000)
    for (const rate of [0, -1, NaN, Infinity]) add(480000, rate)
    expect(reached).not.toHaveBeenCalled()
    add(480000, 16000)
    expect(reached).toHaveBeenCalledTimes(1)
  })

  it('counts only enabled intervals, retaining progress across a route change and repeated calls', async () => {
    const { recordPracticeSamples } = await import('../analytics/practiceProgress')
    recordPracticeSamples(320000, 16000)
    mocks.allowed = false
    recordPracticeSamples(480000, 16000)
    expect(mocks.track).not.toHaveBeenCalled()
    mocks.allowed = true
    mocks.page = null
    recordPracticeSamples(480000, 16000)
    mocks.page = 'practice'
    recordPracticeSamples(160000, 16000)
    recordPracticeSamples(480000, 16000)
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('practice_engaged', { page: 'practice' })
  })
})

it('shares one document threshold with statistics recording samples',async()=>{
 const {recordPracticeSamples}=await import('../analytics/practiceProgress')
 recordPracticeSamples(20*16000,16000)
 mocks.page='recording';recordPracticeSamples(10*48000,48000)
 mocks.page='analysis';recordPracticeSamples(30*16000,16000)
 expect(mocks.track).toHaveBeenCalledExactlyOnceWith('practice_engaged',{page:'recording'})
})
