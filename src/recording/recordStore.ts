import type {AudioClip,ClipAnalysis,RecordingReport} from './types'
import {RecordingPlaybackController} from './playbackController'

export function reportAudio(report:RecordingReport|null):AudioClip|null {
 return report?.clip.samples?.length?report.clip as AudioClip:null
}

/** One in-memory success record. Task state and navigation never belong to the record. */
export class RecordingRecordStore {
 private record:RecordingReport|null
 private listeners=new Set<()=>void>()
 readonly playback=new RecordingPlaybackController()
 constructor(initial:RecordingReport|null=null){this.record=initial;this.playback.setClip(reportAudio(initial))}
 getSnapshot=()=>this.record
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 get(id:string):RecordingReport|null{return this.record?.id===id?this.record:null}
 publish(clip:AudioClip,analysis:ClipAnalysis,createdAt:Date):RecordingReport {
  const record={id:crypto.randomUUID(),createdAt:createdAt.toISOString(),clip,analysis}
  this.record=record;this.playback.stop();this.playback.setClip(clip)
  this.listeners.forEach(listener=>listener())
  return record
 }
 destroy(){this.playback.destroy();this.record=null;this.listeners.clear()}
}
