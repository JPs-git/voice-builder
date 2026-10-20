import {analyzeClip} from './analyzeClip'
interface AnalysisRequest {id:number;type:'analyze';samples:Float32Array;sampleRate:number}
self.onmessage=(event:MessageEvent<AnalysisRequest>)=>{
 const {id,samples,sampleRate}=event.data
 if(event.data.type!=='analyze')return
 try {
  const analysis=analyzeClip(samples,sampleRate,progress=>self.postMessage({id,type:'progress',progress}))
  self.postMessage({id,type:'result',analysis})
 } catch(error) {self.postMessage({id,type:'error',message:error instanceof Error?error.message:'分析失败，请重试。'})}
}
