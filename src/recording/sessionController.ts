import type {AudioEngine} from '../ts/AudioEngine'
import type {AudioClip,RecordingMode,MaterialSnapshot,RecordingSnapshot} from './types'
import type {runClipAnalysis} from './workerClient'
import type {importRecordingFile} from './importClip'
import {MAX_RECORDING_SECONDS} from './constants'

export interface RecordingOptions {mode:RecordingMode;material:MaterialSnapshot|null;prompt:string|null}
export interface RecordingSessionDependencies {
 engine:Pick<AudioEngine,'startCapture'|'stopCapture'>
 analyze:typeof runClipAnalysis;importClip:typeof importRecordingFile;now:()=>Date
}
const busy=(phase:string)=>['requesting','recording','importing','analyzing'].includes(phase)
export class RecordingSessionController {
 private snapshot:RecordingSnapshot={phase:'prepared',elapsed:0,progress:0,report:null,error:null}
 private listeners=new Set<()=>void>()
 private id=0
 private abort=new AbortController()
 private chunks:Float32Array[]=[]
 private count=0
 private rate=0
 private options:RecordingOptions|null=null
 private working:AudioClip|null=null
 private captureTimer:ReturnType<typeof setTimeout>|null=null
 constructor(private deps:RecordingSessionDependencies){}
 getSnapshot=()=>this.snapshot
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 private update(value:Partial<RecordingSnapshot>){this.snapshot={...this.snapshot,...value};this.listeners.forEach(f=>f())}
 private clearCaptureTimer(){if(this.captureTimer!==null)clearTimeout(this.captureTimer);this.captureTimer=null}
 private interrupted(id:number){
  if(id!==this.id||!['requesting','recording'].includes(this.snapshot.phase))return
  if(this.count){this.finish();return}
  this.cancel();this.update({error:'没有收到音频，请检查麦克风后重试。'})
 }
 private watchCapture(id:number){
  this.clearCaptureTimer()
  this.captureTimer=setTimeout(()=>this.interrupted(id),5000)
 }
 private begin(phase:RecordingSnapshot['phase']){
  this.abort.abort();this.abort=new AbortController();const id=++this.id
  this.update({phase,error:null,progress:0,elapsed:0});return id
 }
 async start(options:RecordingOptions):Promise<void>{
  if(busy(this.snapshot.phase))return
  this.working=null;this.chunks=[];this.count=0;this.rate=0
  this.options={...options,material:options.material?{...options.material}:null}
  const id=this.begin('requesting')
  try {
   await this.deps.engine.startCapture((input,rate)=>{
    if(id!==this.id||!['requesting','recording'].includes(this.snapshot.phase))return
    if(!Number.isFinite(rate)||rate<=0||(this.rate&&this.rate!==rate)){
     this.deps.engine.stopCapture();this.update({phase:'error',error:'录音采样率发生变化，请重新录音。'});return
    }
    this.rate=rate
    if(input.length)this.watchCapture(id)
    const remaining=Math.max(0,Math.floor(rate*MAX_RECORDING_SECONDS)-this.count)
    const copy=input.slice(0,remaining)
    if(copy.length){this.chunks.push(copy);this.count+=copy.length}
    const elapsed=this.count/rate
    if(this.snapshot.phase!=='recording'||Math.floor(elapsed)!==Math.floor(this.snapshot.elapsed))
      this.update({phase:'recording',elapsed})
    if(this.count>=rate*MAX_RECORDING_SECONDS)this.finish()
   },this.abort.signal,()=>this.interrupted(id))
   if(id===this.id&&['requesting','recording'].includes(this.snapshot.phase))this.watchCapture(id)
  } catch(error){
   if(id!==this.id)return
   this.clearCaptureTimer()
   this.deps.engine.stopCapture()
   this.update({phase:this.snapshot.report?'ready':'prepared',error:'无法启动录音，请检查麦克风权限或设备。'})
  }
 }
 finish():void{
  if(!['recording','requesting'].includes(this.snapshot.phase))return
  this.clearCaptureTimer()
  this.deps.engine.stopCapture()
  if(!this.count||!this.rate){this.cancel();this.update({error:'没有收到音频，请检查麦克风后重试。'});return}
  const samples=new Float32Array(this.count)
  let offset=0;for(const chunk of this.chunks){samples.set(chunk,offset);offset+=chunk.length}
  this.chunks=[]
  this.working={samples,sampleRate:this.rate,duration:this.count/this.rate,source:'mic',
   name:'录音 '+this.deps.now().toLocaleString('zh-CN'),mode:this.options!.mode,material:this.options!.material,prompt:this.options!.prompt}
  void this.analyze(this.id,this.working)
 }
 private async analyze(id:number,clip:AudioClip):Promise<void>{
  this.update({phase:'analyzing',elapsed:clip.duration,progress:0,error:null})
  try {
   const analysis=await this.deps.analyze(clip,{signal:this.abort.signal,onProgress:progress=>{
    if(id===this.id)this.update({progress})
   }})
   if(id!==this.id)return
   this.working=null
   this.update({phase:'ready',progress:1,report:{id,clip,analysis},error:null})
  } catch(error){
   if(id!==this.id)return
   this.update({phase:'error',error:error instanceof Error?error.message:'分析失败，请重试。'})
  }
 }
 async importFile(file:File):Promise<void>{
  if(busy(this.snapshot.phase))return
  const id=this.begin('importing');this.working=null
  try {
   const clip=await this.deps.importClip(file,this.abort.signal)
   if(id!==this.id)return
   this.working=clip
   await this.analyze(id,clip)
  } catch(error){
   if(id!==this.id)return
   this.update({phase:this.snapshot.report?'ready':'prepared',error:error instanceof Error?error.message:'导入失败，请检查文件格式。'})
  }
 }
 retry():void{
  if(this.snapshot.phase!=='error'||!this.working)return
  const clip=this.working,id=this.begin('analyzing')
  void this.analyze(id,clip)
 }
 cancel():void{
  this.clearCaptureTimer()
  const capture=['requesting','recording'].includes(this.snapshot.phase)
  ++this.id;this.abort.abort()
  if(capture)this.deps.engine.stopCapture()
  this.working=null;this.chunks=[];this.count=0;this.rate=0
  this.update({phase:this.snapshot.report?'ready':'prepared',elapsed:this.snapshot.report?.clip.duration??0,progress:0,error:null})
 }
 clear():void{this.cancel();this.update({phase:'prepared',report:null,elapsed:0})}
 leave():void{
  if(this.snapshot.phase==='recording')this.finish()
  else if(this.snapshot.phase==='requesting')this.cancel()
 }
 destroy():void{this.cancel();this.snapshot={...this.snapshot,phase:'prepared',report:null};this.listeners.clear()}
}
