import { describe, it, expect } from 'vitest'
import { summarizePitch } from '../../recording/statistics'
import type { PitchFrame } from '../../recording/types'

function frames(values: (number|null)[]): PitchFrame[] {
  return values.map((rawF0,i)=>({start:i*.01,duration:.01,time:i*.01+.025,rawF0,f0:rawF0,voiced:rawF0!==null,exclusion:null}))
}
describe('whole-clip pitch statistics',()=>{
  it('excludes values above 500 without clamping and keeps a separate weighted exclusion ratio',()=>{
    const input=frames([60,200,500,500.01,1000,null,NaN])
    const {summary:s,frames:result}=summarizePitch(input,.045)
    expect(s.median).toBe(200);expect(s.p10).toBe(88);expect(s.p90).toBe(440)
    expect(s.validDuration).toBeCloseTo(.03)
    expect(s.aboveLimitCount).toBe(2);expect(s.aboveLimitDuration).toBeCloseTo(.015)
    expect(s.candidateDuration).toBeCloseTo(.045)
    expect(s.aboveLimitProportion).toBeCloseTo(1/3)
    expect(result[3].exclusion).toBe('above-statistics-limit');expect(result[3].f0).toBeNull()
    expect(input[3].rawF0).toBe(500.01)
    expect(s.histogram[s.histogram.length-1]).toMatchObject({from:490,to:500,count:1})
    expect(s.histogram.reduce((sum,bin)=>sum+bin.proportion,0)).toBeCloseTo(1)
  })
  it('uses median and interpolated percentiles',()=>{
    const {summary:s}=summarizePitch(frames([100,200,300]),.03)
    expect(s.median).toBe(200); expect(s.p10).toBe(120); expect(s.p90).toBe(280)
    expect(s.validDuration).toBeCloseTo(.03)
  })
  it('does not mutate inputs or count invalid values as zero',()=>{
    const input=frames([null,0,NaN,Infinity,50,1001,200,200])
    const {summary:s}=summarizePitch(input,.08)
    expect(s.median).toBe(200); expect(s.p10).toBe(200); expect(s.p90).toBe(200)
    expect(s.validDuration).toBeCloseTo(.02); expect(input[1].f0).toBe(0)
    expect(s.histogram.reduce((a,b)=>a+b.proportion,0)).toBeCloseTo(1)
  })
  it('returns nulls for no data, handles even median and clips coverage',()=>{
    expect(summarizePitch([],1).summary.median).toBeNull()
    expect(summarizePitch(frames([100,200]),.015).summary.median).toBe(150)
    expect(summarizePitch(frames([100,200]),.015).summary.validDuration).toBeCloseTo(.015)
  })
  it.each([1,2])('excludes a %i frame isolated octave spike without changing raw F0',n=>{
    const input=frames([200,200,200,...Array(n).fill(400),200,200,200])
    const result=summarizePitch(input,1)
    expect(result.summary.p90).toBe(200); expect(result.summary.excludedCount).toBe(n)
    expect(result.frames[3].rawF0).toBe(400); expect(input[3].f0).toBe(400)
  })
  it('retains sustained changes, boundaries and jumps separated by a pause',()=>{
    for(const values of [[400,200,200,200],[200,200,200,400,400,400,200,200,200],[200,200,null,400,200,200,200]]) {
      expect(summarizePitch(frames(values),1).frames.some(frame=>frame.f0===400)).toBe(true)
    }
  })
  it('includes 500Hz in the last bin while excluding higher candidates',()=>{
    const s=summarizePitch(frames([200,200,500,1000,1000]),1).summary
    expect(s.histogram[s.histogram.length-1]).toMatchObject({from:490,to:500,count:1})
    expect(s.aboveLimitCount).toBe(2)
  })
  it('handles all above-limit candidates, empty candidates and invalid detection values',()=>{
    const s=summarizePitch(frames([800,1000]),1).summary
    expect(s.median).toBeNull();expect(s.p10).toBeNull();expect(s.p90).toBeNull()
    expect(s.histogram).toEqual([]);expect(s.validDuration).toBe(0)
    expect(s.aboveLimitProportion).toBe(1)
    const empty=summarizePitch(frames([null,0,NaN,Infinity,1001]),1).summary
    expect(empty.aboveLimitProportion).toBeNull();expect(empty.aboveLimitCount).toBe(0)
  })
  it('does not bridge an above-limit gap when looking for isolated jumps',()=>{
    const result=summarizePitch(frames([200,200,200,800,400,200,200,200]),1)
    expect(result.frames[4].f0).toBe(400)
    expect(result.summary.excludedCount).toBe(0)
  })
})
