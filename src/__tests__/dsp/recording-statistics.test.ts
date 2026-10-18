import { describe, it, expect } from 'vitest'
import { summarizePitch } from '../../recording/statistics'
import type { PitchFrame } from '../../recording/types'

function frames(values: (number|null)[]): PitchFrame[] {
  return values.map((rawF0,i)=>({start:i*.01,duration:.01,time:i*.01+.025,rawF0,f0:rawF0,voiced:rawF0!==null,exclusion:null}))
}
describe('whole-clip pitch statistics',()=>{
  it('uses median, interpolated percentiles and actual extrema',()=>{
    const {summary:s}=summarizePitch(frames([100,200,300]),.03)
    expect(s.median).toBe(200); expect(s.p10).toBe(120); expect(s.p90).toBe(280)
    expect(s.minimum).toBe(100); expect(s.maximum).toBe(300); expect(s.range).toBe(200)
    expect(s.semitoneRange).toBeCloseTo(19.01955); expect(s.validDuration).toBeCloseTo(.03)
    expect(s.minTime).toBe(.025)
  })
  it('does not mutate inputs or count invalid values as zero',()=>{
    const input=frames([null,0,NaN,Infinity,50,1001,200,200])
    const {summary:s}=summarizePitch(input,.08)
    expect(s.median).toBe(200); expect(s.range).toBe(0); expect(s.semitoneRange).toBe(0)
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
    expect(result.summary.maximum).toBe(200); expect(result.summary.excludedCount).toBe(n)
    expect(result.frames[3].rawF0).toBe(400); expect(input[3].f0).toBe(400)
  })
  it('retains sustained changes, boundaries and jumps separated by a pause',()=>{
    for(const values of [[400,200,200,200],[200,200,200,400,400,400,200,200,200],[200,200,null,400,200,200,200]]) {
      expect(summarizePitch(frames(values),1).summary.maximum).toBe(400)
    }
  })
  it('chooses first equal extremum and includes 1000Hz in the last bin',()=>{
    const s=summarizePitch(frames([200,200,1000,1000,1000]),1).summary
    expect(s.minTime).toBe(.025); expect(s.histogram.at(-1)?.count).toBe(3)
    expect(s.histogram.at(-1)?.to).toBe(1000)
  })
})
