import {BaseAnalysisPipeline} from '../dsp/base-analysis'
import {summarizePitch} from './statistics'
import {ANALYSIS_SETTINGS,ANALYSIS_VERSION,MAX_RECORDING_SECONDS} from './constants'
import type {ClipAnalysis,PitchFrame} from './types'

export function analyzeClip(input:Float32Array,sampleRate:number,onProgress?:(progress:number)=>void):ClipAnalysis {
  if(!Number.isFinite(sampleRate)||sampleRate<=0)throw new Error('无效采样率')
  const duration=input.length/sampleRate
  if(duration>MAX_RECORDING_SECONDS)throw new Error('音频不能超过 60 秒，请裁剪后重试。')
  const frames:PitchFrame[]=[]
  const pipeline=new BaseAnalysisPipeline({vadOptions:ANALYSIS_SETTINGS.vad,onFrame:frame=>{
    frames.push({start:frame.start,duration:frame.duration,time:frame.time,rawF0:frame.rawF0,
      f0:frame.rawF0,voiced:frame.voiced,exclusion:frame.rawF0==null?'invalid':null})
    if(frames.length%100===0)onProgress?.(Math.min(1,(frame.start+frame.duration)/duration))
  }})
  // Bound framing buffers while the shared state spans all chunks.
  const chunkSize=Math.max(1,Math.round(sampleRate))
  for(let start=0;start<input.length;start+=chunkSize)pipeline.pushChunk(input.subarray(start,start+chunkSize),sampleRate)
  pipeline.flush()
  const result=summarizePitch(frames,duration);onProgress?.(1)
  return {...result,version:ANALYSIS_VERSION,settings:{...ANALYSIS_SETTINGS,vad:{...ANALYSIS_SETTINGS.vad}}}
}
