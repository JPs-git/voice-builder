import {Resampler} from './resampler'
import {FrameProcessor} from './frame-processor'
import {VoicedFrameAnalyzer} from './voicedFrame'
import {detectPitch} from './lpc'
import type {VadOptions} from './vad'

export const BASE_SAMPLE_RATE=16000
export const BASE_FRAME_SIZE=800
export const BASE_HOP_SIZE=160
export interface BaseAnalysisFrame {
 samples:Float32Array;magnitudes:Float32Array;voiced:boolean;rms:number;rawF0:number|null
 start:number;duration:number;time:number;sampleRate:number
}

/** Shared streaming framing and speech evidence, independent of UI and optional analysis. */
export class BaseAnalysisPipeline {
 private processor=new FrameProcessor({sampleRate:BASE_SAMPLE_RATE,frameSize:BASE_FRAME_SIZE,hopSize:BASE_HOP_SIZE})
 private resampler:Resampler|null=null
 private inputRate:number|null=null
 private realSamples=0
 private frames=0
 private flushed=false
 private gate:VoicedFrameAnalyzer
 constructor(private options:{onFrame:(frame:BaseAnalysisFrame)=>void;vadOptions?:VadOptions}){
  this.gate=new VoicedFrameAnalyzer(options.vadOptions)
  this.processor.onFrame=frame=>{
   const start=this.frames++*BASE_HOP_SIZE
   const realLength=Math.max(0,Math.min(BASE_FRAME_SIZE,this.realSamples-start))
   if(!realLength)return
   const result=this.gate.analyze(frame.samples,realLength,BASE_SAMPLE_RATE,10)
   this.options.onFrame({...result,rawF0:result.voiced?detectPitch(result.samples,BASE_SAMPLE_RATE):null,
    start:start/BASE_SAMPLE_RATE,duration:Math.min(BASE_HOP_SIZE,realLength)/BASE_SAMPLE_RATE,
    time:(start+realLength/2)/BASE_SAMPLE_RATE,sampleRate:BASE_SAMPLE_RATE})
  }
 }
 pushChunk(samples:Float32Array,rate:number){
  if(this.flushed)throw new Error('分析已结束，请先重置流水线。')
  if(!Number.isFinite(rate)||rate<=0||this.inputRate!==null&&this.inputRate!==rate)throw new Error('无效或变化的采样率')
  if(this.inputRate===null){this.inputRate=rate;if(rate!==BASE_SAMPLE_RATE)this.resampler=new Resampler(rate,BASE_SAMPLE_RATE)}
  const data=this.resampler?this.resampler.process(samples):samples
  this.realSamples+=data.length
  this.processor.push(data)
 }
 flush(){if(this.flushed)return;this.flushed=true;this.processor.push(new Float32Array(BASE_FRAME_SIZE))}
 reset(){this.processor.reset();this.resampler=null;this.inputRate=null;this.realSamples=0;this.frames=0;this.flushed=false;this.gate.reset()}
}
