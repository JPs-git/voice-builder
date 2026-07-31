import { describe, it, expect } from 'vitest'
import { RingBuffer } from '../dsp/RingBuffer'

describe('RingBuffer', () => {
  it('writes and reads less than capacity', () => {
    const buf = new RingBuffer(10)
    buf.write(new Float32Array([1, 2, 3]))
    const result = buf.read()
    expect(result.length).toBe(3)
    expect(Array.from(result)).toEqual([1, 2, 3])
  })

  it('writes exactly to capacity', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3, 4, 5]))
    expect(Array.from(buf.read())).toEqual([1, 2, 3, 4, 5])
  })

  it('drops oldest data when over capacity', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3]))
    buf.write(new Float32Array([4, 5, 6, 7]))
    // kept: [3, 4, 5, 6, 7]
    expect(Array.from(buf.read())).toEqual([3, 4, 5, 6, 7])
  })

  it('wraps around correctly across multiple writes', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3, 4]))
    buf.write(new Float32Array([5, 6, 7, 8, 9]))
    // kept: last 5 [5,6,7,8,9]
    expect(Array.from(buf.read())).toEqual([5, 6, 7, 8, 9])
    buf.write(new Float32Array([10, 11]))
    // kept: last 5 [7,8,9,10,11]
    expect(Array.from(buf.read())).toEqual([7, 8, 9, 10, 11])
  })

  it('handles write larger than total capacity', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]))
    // kept: [4,5,6,7,8]
    expect(Array.from(buf.read())).toEqual([4, 5, 6, 7, 8])
  })

  it('returns empty array when no data written', () => {
    const buf = new RingBuffer(10)
    expect(buf.read().length).toBe(0)
  })

  it('clears buffer', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3]))
    buf.clear()
    expect(buf.read().length).toBe(0)
    expect(buf.size).toBe(0)
  })

  it('reports correct size and capacity', () => {
    const buf = new RingBuffer(5)
    expect(buf.capacity).toBe(5)
    expect(buf.size).toBe(0)
    buf.write(new Float32Array([1, 2, 3]))
    expect(buf.size).toBe(3)
    buf.write(new Float32Array([4, 5, 6]))
    expect(buf.size).toBe(5)
  })

  it('read returns a copy, not a reference', () => {
    const buf = new RingBuffer(5)
    buf.write(new Float32Array([1, 2, 3]))
    const a = buf.read()
    const b = buf.read()
    a[0] = 99
    expect(b[0]).toBe(1)
  })
})
