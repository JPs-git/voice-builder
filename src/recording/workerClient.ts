import {RecordingAnalysisError} from './errors'
import type {AudioClip,ClipAnalysis} from './types'
let nextId=0
export function runClipAnalysis(clip:AudioClip,options:{signal:AbortSignal;onProgress:(progress:number)=>void}):Promise<ClipAnalysis> {
 return new Promise((resolve,reject)=>{
  if(options.signal.aborted){reject(new DOMException('已取消','AbortError'));return}
  if(typeof Worker==='undefined'){reject(new RecordingAnalysisError('当前浏览器不支持音频分析。','unsupported'));return}
  const id=++nextId
  let worker:Worker
  try {worker=new Worker(new URL('./analysis.worker.ts',import.meta.url),{type:'module'})}
  catch(error){reject(new RecordingAnalysisError(error instanceof Error?error.message:'分析失败，请重试。','processing'));return}
  let settled=false
  const cleanup=()=>{worker.terminate();worker.onmessage=null;worker.onerror=null;options.signal.removeEventListener('abort',abort)}
  const fail=(error:unknown)=>{if(settled)return;settled=true;cleanup();reject(error instanceof DOMException&&error.name==='AbortError'?error:new RecordingAnalysisError(error instanceof Error?error.message:'分析失败，请重试。','processing'))}
  const abort=()=>fail(new DOMException('已取消','AbortError'))
  options.signal.addEventListener('abort',abort,{once:true})
  worker.onerror=event=>fail(new Error(event.message||'分析失败，请重试。'))
  worker.onmessage=event=>{
   const data=event.data
   if(settled||data.id!==id)return
   if(data.type==='progress')options.onProgress(Math.max(0,Math.min(1,data.progress)))
   else if(data.type==='error')fail(new Error(data.message||'分析失败，请重试。'))
   else if(data.type==='result'){settled=true;cleanup();resolve(data.analysis)}
  }
  // Transfer a copy: the original remains available for retry and playback.
  const samples=clip.samples.slice()
  try {worker.postMessage({id,type:'analyze',samples,sampleRate:clip.sampleRate},[samples.buffer])}
  catch(error){fail(error)}
 })
}
