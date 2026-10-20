import {useRef} from 'react'
import type {ToolItem} from '../hooks/useToolbar'
import {useRecordingSession} from './RecordingSessionProvider'
import {useRecordingRecords} from './RecordingRecordsProvider'
import {useReportNavigation} from './useReportNavigation'
import {getRecordingReference} from './references'
export function useRecordingToolbar(onHelp:()=>void,onAbout:()=>void){
 const {controller,snapshot:s,preferences:p}=useRecordingSession()
 const fileInputRef=useRef<HTMLInputElement>(null)
 const busy=['requesting','recording','paused','importing','analyzing'].includes(s.phase)
 const {records,latest}=useRecordingRecords()
 const {openReport}=useReportNavigation()
 const failed=s.phase==='error'
 const retry=controller.canRetry()
 const toolItems:ToolItem[]=[
  {id:'record',variant:'primary',icon:s.phase==='recording'?'Ⅱ':s.phase==='paused'?'▶':'●',
   label:s.phase==='recording'?'暂停录制':s.phase==='paused'?'继续录制':s.phase==='requesting'?'麦克风授权中…':s.phase==='importing'?'正在读取…':s.phase==='analyzing'?'正在分析…':failed?(retry?'重试分析':'重新准备'):'开始录音',
   recording:s.phase==='recording',disabled:busy&&!['recording','paused'].includes(s.phase)||s.phase==='paused'&&s.atLimit},
  ...(busy?[{id:'cancel',variant:'ghost' as const,icon:'×',label:['recording','paused'].includes(s.phase)?'取消录音':s.phase==='analyzing'?'取消分析':s.phase==='importing'?'取消导入':'取消'}]:[]),
  ...(['requesting','recording','paused','importing','analyzing'].includes(s.phase)?[{id:'finish',variant:'ghost' as const,icon:'✓',label:s.phase==='analyzing'?'正在分析':s.phase==='importing'?'正在读取':'完成录制并分析',disabled:s.phase!=='paused'||s.elapsed<=0}]:[]),
  ...(latest&&!busy?[{id:'view-report',variant:'ghost' as const,icon:'↗',label:'查看上次结果'}]:[]),
  ...(failed&&retry?[{id:'prepare',variant:'ghost' as const,icon:'↻',label:'重新准备'}]:[]),
  {id:'import',variant:'ghost',icon:'📁',label:'导入音频',disabled:busy,inMore:failed},
  {id:'help',variant:'ghost',icon:'?',label:'帮助'},{id:'about',variant:'ghost',icon:'ⓘ',label:'关于'},
 ]
 const handleClickTool=(id:string)=>{
  if(id==='help'){onHelp();return}if(id==='about'){onAbout();return}
  if(id==='finish'){controller.finish();return}
  if(id==='cancel'){controller.cancel();return}
  if(id==='view-report'){if(!busy&&latest)openReport(latest.id);return}
  if(id==='prepare'){controller.prepare();return}
  if(id==='import'){if(!busy){records.playback.pause();fileInputRef.current?.click()};return}
  if(id==='record'){
   if(s.phase==='recording'){controller.pause();return}
   if(s.phase==='paused'){void controller.resume();return}
   if(busy)return
   if(failed){if(retry)controller.retry();else controller.prepare();return}
   records.playback.pause()
   const {material,prompt}=getRecordingReference(p.referenceId)
   void controller.start({mode:material?'reading':'free',material:material?{id:material.id,version:material.version,title:material.title,source:material.source}:null,prompt})
  }
 }
 const handleFileChange=(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]
  if(file&&!busy)void controller.importFile(file)
  event.target.value=''
 }
 return {toolItems,handleClickTool,fileInputRef,handleFileChange}
}
