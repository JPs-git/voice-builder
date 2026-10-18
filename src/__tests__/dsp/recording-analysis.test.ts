import {it,expect} from 'vitest'
import {analyzeClip} from '../../recording/analyzeClip'
const tone=(rate:number,seconds:number,f=200)=>Float32Array.from({length:Math.round(rate*seconds)},(_,i)=>.03*Math.sin(2*Math.PI*f*i/rate))
it('analyzes low-volume speech-like periodic input without a 10 second window',()=>{
 const result=analyzeClip(tone(16000,11),16000)
 expect(result.summary.median).toBeCloseTo(200,0)
 expect(result.summary.validDuration).toBeGreaterThan(10)
 expect(result.frames[0].time).toBe(.025)
 expect(result.frames.at(-1)!.time).toBeLessThanOrEqual(11)
 expect(result.settings.f0Range).toEqual([60,1000])
})
it('does not invent pitch in silence or short zero-padded tails',()=>{
 expect(analyzeClip(new Float32Array(16000),16000).summary.median).toBeNull()
 expect(analyzeClip(tone(16000,.02),16000).summary.median).toBeNull()
})
it('preserves original time including silence and can detect pitches above 500Hz',()=>{
 const samples=new Float32Array(32000);samples.set(tone(16000,1,800),16000)
 const result=analyzeClip(samples,16000)
 expect(result.summary.maximum).toBeCloseTo(800,0)
 expect(result.summary.minTime).toBeGreaterThan(.95)
})
it('handles 48kHz input with bounded valid duration and actual window times',()=>{
 const result=analyzeClip(tone(48000,1),48000)
 expect(result.summary.median).toBeCloseTo(200,0)
 expect(result.summary.validDuration).toBeLessThanOrEqual(1)
 expect(result.frames.at(-1)!.time).toBeLessThanOrEqual(1)
})

