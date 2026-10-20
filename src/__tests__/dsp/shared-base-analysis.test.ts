import {it,expect} from 'vitest'
import {BaseAnalysisPipeline,type BaseAnalysisFrame} from '../../dsp/base-analysis'
import {AnalysisPipeline} from '../../dsp/analysis-pipeline'

it.each([16000,44100,48000])('shares raw frames for whole and chunked %iHz input, with idempotent flush',rate=>{
 const input=Float32Array.from({length:Math.round(rate*.275)},(_,i)=>.03*Math.sin(2*Math.PI*210*i/rate))
 const run=(size:number)=>{
  const frames:BaseAnalysisFrame[]=[]
  const pipeline=new BaseAnalysisPipeline({onFrame:frame=>frames.push(frame)})
  for(let i=0;i<input.length;i+=size)pipeline.pushChunk(input.subarray(i,i+size),rate)
  pipeline.flush();const count=frames.length;pipeline.flush();expect(frames).toHaveLength(count)
  return frames.map(({start,duration,time,rawF0,voiced})=>({start,duration,time,rawF0,voiced}))
 }
 const whole=run(input.length),chunked=run(137)
 expect(chunked).toEqual(whole)
 expect(whole[whole.length-1].time).toBeLessThanOrEqual(input.length/rate)
})
it('retains high raw pitches and rejects synthetic tail evidence',()=>{
 const input=Float32Array.from({length:16000},(_,i)=>.03*Math.sin(2*Math.PI*800*i/16000))
 const frames:BaseAnalysisFrame[]=[]
 const pipeline=new BaseAnalysisPipeline({onFrame:frame=>frames.push(frame)})
 pipeline.pushChunk(input,16000);pipeline.flush()
 expect(frames.some(f=>f.rawF0!==null&&f.rawF0>500)).toBe(true)
 expect(frames.filter(f=>f.samples.length<400).every(f=>f.rawF0===null)).toBe(true)
 expect(frames[frames.length-1].start).toBeLessThan(1)
})
it('keeps the full realtime pipeline F0 identical to raw shared frames and preserves UI time projection',()=>{
 const input=Float32Array.from({length:16000},(_,i)=>.03*Math.sin(2*Math.PI*210*i/16000))
 const raw:BaseAnalysisFrame[]=[],full:any[]=[]
 const base=new BaseAnalysisPipeline({onFrame:frame=>raw.push(frame)})
 const main=new AnalysisPipeline({formantSmoothing:false,frameOffset:50,onFrame:frame=>full.push(frame)})
 for(let i=0;i<input.length;i+=137){const chunk=input.subarray(i,i+137);base.pushChunk(chunk,16000);main.pushChunk(chunk,16000)}
 base.flush();main.flush()
 expect(full.map(f=>[f.f0,f.voiced])).toEqual(raw.map(f=>[f.rawF0,f.voiced]))
 expect(full[0].time).toBe(.51)
})
