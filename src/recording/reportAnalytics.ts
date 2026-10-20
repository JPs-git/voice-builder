import {track} from '../analytics/analytics'
import type {ReportEntry} from '../analytics/events'
import type {RecordingRecordStore} from './recordStore'

// Navigation provenance lasts only until the matching PUSH is rendered, never in history state.
const pending=new WeakMap<RecordingRecordStore,{path:string;entry:ReportEntry}>()
export function prepareReportEntry(records:RecordingRecordStore,path:string,entry:ReportEntry){
 pending.set(records,{path,entry})
}
export function consumeReportEntry(records:RecordingRecordStore,path:string,navigationType:string):ReportEntry{
 const intent=pending.get(records);pending.delete(records)
 return navigationType==='PUSH'&&intent?.path===path?intent.entry:'other'
}
export function reportOpened(entry:ReportEntry,available:boolean):void{
 try{track('report_open',{page:'report',entry,availability:available?'available':'unavailable'})}catch{/* Keep report readable. */}
}
