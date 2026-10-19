import { F0_RANGE } from '../config/analysisRanges'
import { STATISTICS_F0_RANGE } from './constants'
import type { PitchFrame, PitchSummary, HistogramBin } from './types'

function quantile(sorted:number[],p:number):number|null {
  if(!sorted.length) return null
  const h=(sorted.length-1)*p, lower=Math.floor(h)
  return sorted[lower]+(sorted[Math.ceil(h)]-sorted[lower])*(h-lower)
}
const semitones=(a:number,b:number)=>12*Math.log2(a/b)
const median=(values:number[])=>quantile([...values].sort((a,b)=>a-b),.5)!

export function summarizePitch(input:readonly PitchFrame[],duration:number):{frames:PitchFrame[];summary:PitchSummary} {
  const weight=(f:PitchFrame)=>Math.max(0,Math.min(f.duration,duration-f.start))
  let candidateDuration=0,aboveLimitDuration=0,aboveLimitCount=0
  const frames=input.map(frame=>{
    const candidate=frame.voiced && frame.rawF0!=null && Number.isFinite(frame.rawF0)
      && frame.rawF0>=F0_RANGE.min && frame.rawF0<=F0_RANGE.max && frame.start>=0 && weight(frame)>0
    const above=candidate&&frame.rawF0!>STATISTICS_F0_RANGE.max
    if(candidate)candidateDuration+=weight(frame)
    if(above){aboveLimitCount++;aboveLimitDuration+=weight(frame)}
    const valid=candidate&&!above&&frame.rawF0!>=STATISTICS_F0_RANGE.min
    return {...frame,f0:valid?frame.rawF0:null,exclusion:above?'above-statistics-limit':valid?null:'invalid'} as PitchFrame
  })
  const base=frames.map(f=>f.f0), excluded=new Set<number>()
  for(let i=3;i<frames.length-3;i++) for(const length of [1,2]) {
    if(i+length+3>frames.length) continue
    const indices=Array.from({length:6+length},(_,k)=>i-3+k)
    if(indices.some((k,j)=>base[k]==null || (j>0 && Math.abs(frames[k].start-frames[k-1].start-.01)>1e-6))) continue
    const left=median(base.slice(i-3,i) as number[]),right=median(base.slice(i+length,i+length+3) as number[])
    if(Math.abs(semitones(left,right))>2) continue
    const direction=Math.sign(semitones(base[i]!,left))
    if(!direction) continue
    const isSpike=(value:number)=> {
      const a=semitones(value,left),b=semitones(value,right)
      return Math.abs(a)>=8 && Math.abs(b)>=8 && Math.sign(a)===direction && Math.sign(b)===direction
    }
    // Require the entire short run; never carve a 1–2 frame hole in a sustained change.
    if(isSpike(base[i-1]!) || isSpike(base[i+length]!)) continue
    if(Array.from({length},(_,k)=>base[i+k]!).every(isSpike)) for(let k=i;k<i+length;k++) excluded.add(k)
  }
  for(const i of excluded) {frames[i].f0=null;frames[i].exclusion='isolated-jump'}
  const valid=frames.filter(f=>f.f0!=null)
  const sorted=valid.map(f=>f.f0!).sort((a,b)=>a-b)
  const validDuration=valid.reduce((sum,f)=>sum+weight(f),0)
  const bins=new Map<number,HistogramBin>()
  for(const f of valid) {
    const from=Math.min(STATISTICS_F0_RANGE.max-10,Math.floor(f.f0!/10)*10)
    const bin=bins.get(from)??{from,to:from+10,count:0,proportion:0}
    bin.count++;bin.proportion+=weight(f);bins.set(from,bin)
  }
  for(const b of bins.values()) b.proportion=validDuration?b.proportion/validDuration:0
  return {frames,summary:{
    median:quantile(sorted,.5),aboveLimitCount,aboveLimitDuration,candidateDuration,
    aboveLimitProportion:candidateDuration?aboveLimitDuration/candidateDuration:null,
    p10:quantile(sorted,.1),p90:quantile(sorted,.9),validDuration,coverage:duration>0?Math.min(1,validDuration/duration):0,
    excludedCount:excluded.size,histogram:[...bins.values()].sort((a,b)=>a.from-b.from),
  }}
}
