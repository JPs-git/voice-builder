import {RecordingImportError,RecordingAnalysisError} from './errors'
import {emitRecording,countRecordingSamples,durationBucket,captureErrorReason} from './analytics'
import type {PauseReason,RecordingAction} from '../analytics/events'
import type {AudioEngine} from '../ts/AudioEngine'
import type {AudioClip,RecordingMode,MaterialSnapshot,RecordingSnapshot} from './types'
import type {runClipAnalysis} from './workerClient'
import type {importRecordingFile} from './importClip'
import {MAX_RECORDING_SECONDS} from './constants'
import {RecordingRecordStore} from './recordStore'

export interface RecordingOptions {mode:RecordingMode;material:MaterialSnapshot|null;prompt:string|null}
export interface RecordingSessionDependencies {
 engine:Pick<AudioEngine,'startCapture'|'stopCapture'>
 analyze:typeof runClipAnalysis;importClip:typeof importRecordingFile;now:()=>Date
}
const busy=(phase:string)=>['requesting','recording','paused','importing','analyzing'].includes(phase)
export class RecordingSessionController {
 private snapshot:RecordingSnapshot={phase:'prepared',elapsed:0,progress:0,completedRecordId:null,error:null,atLimit:false}
 private listeners=new Set<()=>void>()
 private id=0
 private abort=new AbortController()
 private chunks:Float32Array[]=[]
 private count=0
 private rate=0
 private options:RecordingOptions|null=null
 private materials:MaterialSnapshot[]=[]
 private working:AudioClip|null=null
 private analysisAttempt:{source:'mic'|'import';attempt:'initial'|'retry'}|null=null
 private captureId=0
 private captureAbort=new AbortController()
 private captureTimer:ReturnType<typeof setTimeout>|null=null
 constructor(private deps:RecordingSessionDependencies,readonly recordStore=new RecordingRecordStore()){}
 getSnapshot=()=>this.snapshot
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 private update(value:Partial<RecordingSnapshot>){this.snapshot={...this.snapshot,...value};this.listeners.forEach(f=>f())}
 private clearCaptureTimer(){if(this.captureTimer!==null)clearTimeout(this.captureTimer);this.captureTimer=null}
 private stopCapture(){
  ++this.captureId;this.clearCaptureTimer();this.captureAbort.abort();this.deps.engine.stopCapture()
 }
 private interrupted(id:number){
  if(id!==this.captureId||!['requesting','recording'].includes(this.snapshot.phase))return
  if(this.count){this.pause('interruption');this.update({error:'录音已中断，已保留录音，可继续或完成分析。'});return}
  this.cancel(false);this.update({error:'没有收到音频，请检查麦克风后重试。'})
 }
 private watchCapture(id:number){
  this.clearCaptureTimer()
  this.captureTimer=setTimeout(()=>this.interrupted(id),5000)
 }
 private begin(phase:RecordingSnapshot['phase']){
  this.abort.abort();this.abort=new AbortController();const id=++this.id
  this.update({phase,error:null,progress:0,elapsed:0,atLimit:false});return id
 }
 async start(options:RecordingOptions):Promise<void>{
  if(busy(this.snapshot.phase))return
  this.working=null;this.chunks=[];this.count=0;this.rate=0
  this.options={...options,material:options.material?{...options.material}:null}
  this.materials=options.material?[{...options.material}]:[]
  this.begin('requesting')
  await this.capture('new')
 }
 reference(material:MaterialSnapshot|null):void{
  if(!material||!['requesting','recording','paused'].includes(this.snapshot.phase))return
  if(!this.materials.some(item=>item.id===material.id&&item.version===material.version))this.materials.push({...material})
 }
 async resume():Promise<void>{
  if(this.snapshot.phase!=='paused'||this.snapshot.atLimit)return
  this.update({phase:'requesting',error:null})
  await this.capture('resume')
 }
 private async capture(action:RecordingAction):Promise<void>{
  const id=++this.captureId
  this.captureAbort=new AbortController()
  let started=false
  const markStarted=()=>{if(!started){started=true;emitRecording('record_start',{action})}}
  try {
   await this.deps.engine.startCapture((input,rate)=>{
    if(id!==this.captureId||!['requesting','recording'].includes(this.snapshot.phase))return
    if(!Number.isFinite(rate)||rate<=0||(this.rate&&this.rate!==rate)){
     if(this.count)this.pause('interruption');else this.cancel(false)
     this.update({error:'录音采样率发生变化，已保留录音，请完成分析或重新录音。'});return
    }
    this.rate=rate
    if(input.length)this.watchCapture(id)
    const remaining=Math.max(0,Math.floor(rate*MAX_RECORDING_SECONDS)-this.count)
    const copy=input.slice(0,remaining)
    if(copy.length){markStarted();this.chunks.push(copy);this.count+=copy.length;countRecordingSamples(copy.length,rate)}
    const elapsed=this.count/rate
    if(this.snapshot.phase!=='recording'||Math.floor(elapsed)!==Math.floor(this.snapshot.elapsed))
      this.update({phase:'recording',elapsed})
    if(this.count>=rate*MAX_RECORDING_SECONDS)this.pause('limit')
   },this.captureAbort.signal,()=>this.interrupted(id))
   if(id===this.captureId&&['requesting','recording'].includes(this.snapshot.phase)){markStarted();this.watchCapture(id)}
  } catch(error) {
   if(id!==this.captureId)return
   emitRecording('record_error',{action,reason:captureErrorReason(error)})
   this.stopCapture()
   this.update({phase:this.count?'paused':'prepared',elapsed:this.rate?this.count/this.rate:0,
    error:'无法启动录音，请检查麦克风权限或设备。'})
  }
 }
 pause(reason:PauseReason='user'):void{
  if(!['recording','requesting'].includes(this.snapshot.phase))return
  if(this.count)emitRecording('recording_pause',{reason})
  this.stopCapture()
  this.update({phase:'paused',elapsed:this.rate?this.count/this.rate:0,
   atLimit:!!this.rate&&this.count>=this.rate*MAX_RECORDING_SECONDS})
 }
 finish():void{
  if(this.snapshot.phase!=='paused'||!this.count||!this.rate)return
  if(!this.count||!this.rate){this.cancel();this.update({error:'没有收到音频，请检查麦克风后重试。'});return}
  emitRecording('recording_complete',{duration_bucket:durationBucket(this.count/this.rate),at_limit:this.snapshot.atLimit?'yes':'no'})
  const samples=new Float32Array(this.count)
  let offset=0;for(const chunk of this.chunks){samples.set(chunk,offset);offset+=chunk.length}
  this.chunks=[]
  this.working={samples,sampleRate:this.rate,duration:this.count/this.rate,source:'mic',
   name:'录音 '+this.deps.now().toLocaleString('zh-CN'),mode:this.options!.mode,material:this.options!.material,prompt:this.options!.prompt,
   materials:this.materials.map(item=>({...item}))}
  void this.analyze(this.id,this.working)
 }
 private async analyze(id:number,clip:AudioClip,attempt:'initial'|'retry'='initial'):Promise<void>{
  const context={source:clip.source==='mic'?'mic' as const:'import' as const,attempt}
  this.analysisAttempt=context
  emitRecording('recording_analysis',{...context,stage:'start',duration_bucket:durationBucket(clip.duration)})
  this.update({phase:'analyzing',elapsed:clip.duration,progress:0,error:null})
  try {
   const analysis=await this.deps.analyze(clip,{signal:this.abort.signal,onProgress:progress=>{
    if(id===this.id)this.update({progress})
   }})
   if(id!==this.id)return
   this.working=null
   const record=this.recordStore.publish(clip,analysis,this.deps.now())
   this.analysisAttempt=null
   emitRecording('recording_analysis',{...context,stage:'success'})
   this.update({phase:'prepared',elapsed:0,progress:1,completedRecordId:record.id,error:null,atLimit:false})
  } catch(error){
   if(id!==this.id)return
   this.analysisAttempt=null
   emitRecording('recording_analysis',{...context,stage:'failure',reason:error instanceof RecordingAnalysisError?error.reason:'unknown'})
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
   emitRecording('audio_import',{result:'success'})
   await this.analyze(id,clip)
  } catch(error){
   if(id!==this.id)return
   emitRecording('audio_import',{result:'failure',reason:error instanceof RecordingImportError?error.reason:'unknown'})
   this.update({phase:'prepared',error:error instanceof Error?error.message:'导入失败，请检查文件格式。'})
  }
 }
 retry():void{
  if(this.snapshot.phase!=='error'||!this.working)return
  const clip=this.working,id=this.begin('analyzing')
  void this.analyze(id,clip,'retry')
 }
 cancel(user=true):void{
  const phase=this.snapshot.phase
  if(user&&(busy(phase)||phase==='error'&&this.working)){
   const target=phase==='analyzing'?'analysis':phase==='importing'||phase==='error'&&this.working?.source==='file'?'import':'capture'
   emitRecording('recording_cancel',{phase:phase as 'requesting'|'recording'|'paused'|'importing'|'analyzing'|'error',target})
   if(this.analysisAttempt)emitRecording('recording_analysis',{...this.analysisAttempt,stage:'cancel'})
  }
  this.analysisAttempt=null
  const capture=['requesting','recording'].includes(this.snapshot.phase)
  ++this.id;this.abort.abort()
  if(capture)this.stopCapture();else{++this.captureId;this.clearCaptureTimer();this.captureAbort.abort()}
  this.working=null;this.chunks=[];this.count=0;this.rate=0;this.materials=[]
  this.update({phase:'prepared',elapsed:0,progress:0,error:null,atLimit:false})
 }
 prepare():void{if(!busy(this.snapshot.phase))this.cancel()}
 canRetry():boolean{return this.snapshot.phase==='error'&&this.working!==null}
 leave():void{
  if(this.snapshot.phase==='recording'||this.snapshot.phase==='requesting'&&this.count)this.pause('navigation')
  else if(this.snapshot.phase==='requesting')this.cancel(false)
 }
 destroy():void{this.cancel(false);this.listeners.clear()}
}
