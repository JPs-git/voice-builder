import {Resampler} from '../dsp/resampler'
import {VoicedFrameAnalyzer} from '../dsp/voicedFrame'
import {detectPitch} from '../dsp/lpc'
import {summarizePitch} from './statistics'
import {ANALYSIS_SETTINGS,ANALYSIS_VERSION,MAX_RECORDING_SECONDS} from './constants'
import type {ClipAnalysis,PitchFrame} from './types'

export function analyzeClip(input:Float32Array,sampleRate:number,onProgress?:(progress:number)=>void):ClipAnalysis {
  if(!Number.isFinite(sampleRate)||sampleRate<=0)throw new Error('无效采样率')
  const duration=input.length/sampleRate
  if(duration>MAX_RECORDING_SECONDS)throw new Error('音频不能超过 60 秒，请裁剪后重试。')
  const {frameSize,hopSize}=ANALYSIS_SETTINGS
  const samples=sampleRate===16000?input:new Resampler(sampleRate,16000).process(input)
  const gate=new VoicedFrameAnalyzer(ANALYSIS_SETTINGS.vad)
  const frames:PitchFrame[]=[]
  for(let start=0;start<samples.length;start+=hopSize) {
    const realLength=Math.min(frameSize,samples.length-start)
    let window=samples.subarray(start,start+realLength)
    if(realLength<frameSize){window=new Float32Array(frameSize);window.set(samples.subarray(start))}
    const result=gate.analyze(window,realLength,16000,10)
    const rawF0=result.voiced?detectPitch(result.samples,16000):null
    frames.push({start:start/16000,duration:Math.min(hopSize,samples.length-start)/16000,
      time:(start+realLength/2)/16000,rawF0,f0:rawF0,voiced:result.voiced,exclusion:rawF0==null?'invalid':null})
    if(frames.length%100===0)onProgress?.(Math.min(1,(start+hopSize)/samples.length))
  }
  const result=summarizePitch(frames,duration);onProgress?.(1)
  return {...result,version:ANALYSIS_VERSION,settings:{...ANALYSIS_SETTINGS,vad:{...ANALYSIS_SETTINGS.vad}}}
}
