import {track} from '../analytics/analytics'
import {getAudioEngine} from '../ts'
import type {AudioEngine} from '../ts/AudioEngine'
import type {AudioClip} from './types'
export interface PlaybackSnapshot {position:number;playing:boolean;duration:number;error:string|null}
export class RecordingPlaybackController {
 private clip:AudioClip|null=null
 private source:AudioBufferSourceNode|null=null
 private raf:number|null=null
 private generation=0
 private startedAt=0
 private offset=0
 private end=0
 private snapshot:PlaybackSnapshot={position:0,playing:false,duration:0,error:null}
 private listeners=new Set<()=>void>()
 constructor(private engine:()=>Pick<AudioEngine,'audioContext'|'createPlaybackSource'>=getAudioEngine){}
 getSnapshot=()=>this.snapshot
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f)}}
 private update(value:Partial<PlaybackSnapshot>){this.snapshot={...this.snapshot,...value};this.listeners.forEach(f=>f())}
 setClip(clip:AudioClip|null){
  if(this.clip===clip)return
  this.stop();this.clip=clip;this.update({position:0,duration:clip?.duration??0,error:null})
 }
 private detach(){
  ++this.generation
  if(this.raf!==null)cancelAnimationFrame(this.raf)
  this.raf=null
  if(this.source){this.source.onended=null;try{this.source.stop()}catch{}this.source=null}
 }
 private currentPosition(){
  return this.snapshot.playing?Math.min(this.end,this.offset+this.engine().audioContext.currentTime-this.startedAt):this.snapshot.position
 }
 private playBetween(start:number,end:number,user=false){
  if(!this.clip||!this.clip.samples.length)return
  this.detach()
  const duration=Math.max(0,end-start);if(!duration)return
  const generation=this.generation
  try {
   const engine=this.engine(),{source}=engine.createPlaybackSource(this.clip.samples,this.clip.sampleRate)
   this.source=source;this.offset=start;this.end=end;this.startedAt=engine.audioContext.currentTime
   source.onended=()=>{
    if(generation!==this.generation)return
    this.detach();this.update({playing:false,position:end})
   }
   source.start(0,start,duration);this.update({playing:true,position:start,error:null})
   if(user){try{track('playback_start',{page:'report'})}catch{/* Keep playback running. */}}
   const tick=()=>{
    if(generation!==this.generation)return
    this.update({position:this.currentPosition()})
    this.raf=requestAnimationFrame(tick)
   }
   this.raf=requestAnimationFrame(tick)
  }catch{
   this.detach();this.update({playing:false,error:'无法回放，请检查浏览器音频设置后重试。'})
  }
 }
 play(){if(this.snapshot.playing)return;const position=this.snapshot.position>=this.snapshot.duration?0:this.snapshot.position;this.playBetween(position,this.snapshot.duration,true)}
 pause(){const position=this.currentPosition();this.detach();this.update({playing:false,position})}
 seek(seconds:number){
  const playing=this.snapshot.playing;this.pause()
  this.update({position:Math.max(0,Math.min(this.snapshot.duration,seconds))})
  if(playing&&this.snapshot.position<this.snapshot.duration)this.playBetween(this.snapshot.position,this.snapshot.duration)
 }
 stop(){this.detach();this.update({playing:false,position:0})}
 destroy(){this.stop();this.clip=null;this.listeners.clear()}
}
