import type {HelpTopic} from '../content/helpContent'
import {HELP_TOPIC_ORDER} from '../content/helpContent'

export type AnalyticsPage = 'analysis' | 'practice' | 'recording' | 'report'
export type RecordingAction = 'new' | 'resume'
export type DurationBucket = 'under_10s' | '10_to_29s' | '30_to_59s' | 'at_limit'
export type PauseReason = 'user' | 'limit' | 'navigation' | 'interruption'
export type CaptureError = 'permission' | 'device' | 'unsupported' | 'unknown'
export type ImportError = 'too_long' | 'unsupported_or_corrupt' | 'unknown'
export type AnalysisError = 'unsupported' | 'processing' | 'unknown'
export type ReportEntry = 'auto' | 'latest' | 'other'
type AnalysisBase = {page:'recording';source:'mic'|'import';attempt:'initial'|'retry'}
export interface AnalyticsEventMap {
  record_start: {page:AnalyticsPage;action?:RecordingAction}
  record_error: {page:AnalyticsPage;reason:CaptureError;action?:RecordingAction}
  practice_engaged: {page:AnalyticsPage}
  playback_start: {page:AnalyticsPage}
  audio_import: {page:AnalyticsPage} & ({result:'success'}|{result:'failure';reason:ImportError})
  help_open: {page:AnalyticsPage;topic:HelpTopic}
  recording_pause: {page:'recording';reason:PauseReason}
  recording_complete: {page:'recording';duration_bucket:DurationBucket;at_limit:'yes'|'no'}
  recording_cancel: {page:'recording';target:'capture'|'import'|'analysis';phase:'requesting'|'recording'|'paused'|'importing'|'analyzing'|'error'}
  recording_analysis: AnalysisBase & ({stage:'start';duration_bucket:DurationBucket}|{stage:'success'|'cancel'}|{stage:'failure';reason:AnalysisError})
  report_open: {page:'report';entry:ReportEntry;availability:'available'|'unavailable'}
}
export const RECORDING_TASK_EVENTS = ['record_start','record_error','audio_import','recording_pause','recording_complete','recording_cancel','recording_analysis'] as const
export type RecordingTaskEvent = typeof RECORDING_TASK_EVENTS[number]
export type WithoutPage<T> = T extends unknown ? Omit<T,'page'> : never
const durations = ['under_10s','10_to_29s','30_to_59s','at_limit']

/** Rebuild from closed enums; never spread caller properties into the payload. */
export function eventData(name:string,value:unknown):Record<string,string>|null {
  if(!value||typeof value!=='object')return null
  const data=value as Record<string,unknown>
  if(!['analysis','practice','recording','report'].includes(data.page as string))return null
  const result:Record<string,string>={page:data.page as string}
  const add=(key:string,values:readonly string[])=>{
    if(typeof data[key]!=='string'||!values.includes(data[key] as string))return false
    result[key]=data[key] as string;return true
  }
  const recording=data.page==='recording'
  const capturePage=data.page!=='report'
  switch(name){
    case 'record_start': case 'record_error':
      if(!capturePage||recording&&!add('action',['new','resume']))return null
      if(name==='record_error'&&!add('reason',['permission','device','unsupported','unknown']))return null
      return result
    case 'practice_engaged':return capturePage?result:null
    case 'playback_start':return data.page!=='recording'?result:null
    case 'audio_import':
      if(!capturePage||!add('result',['success','failure']))return null
      if(data.result==='failure'&&!add('reason',['too_long','unsupported_or_corrupt','unknown']))return null
      return result
    case 'help_open':return add('topic',HELP_TOPIC_ORDER)?result:null
    case 'recording_pause':return recording&&add('reason',['user','limit','navigation','interruption'])?result:null
    case 'recording_complete':return recording&&add('duration_bucket',durations)&&add('at_limit',['yes','no'])?result:null
    case 'recording_cancel':return recording&&add('target',['capture','import','analysis'])&&add('phase',['requesting','recording','paused','importing','analyzing','error'])?result:null
    case 'recording_analysis':
      if(!recording||!add('source',['mic','import'])||!add('attempt',['initial','retry'])||!add('stage',['start','success','failure','cancel']))return null
      if(data.stage==='start'&&!add('duration_bucket',durations))return null
      if(data.stage==='failure'&&!add('reason',['unsupported','processing','unknown']))return null
      return result
    case 'report_open':return data.page==='report'&&add('entry',['auto','latest','other'])&&add('availability',['available','unavailable'])?result:null
    default:return null
  }
}
