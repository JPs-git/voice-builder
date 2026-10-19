import {useRef} from 'react'
import type {ToolItem} from '../hooks/useToolbar'
import {useRecordingSession} from './RecordingSessionProvider'
import {getRecordingReference} from './references'
export function useRecordingToolbar(onHelp:()=>void,onAbout:()=>void){
 const {controller,snapshot:s,preferences:p}=useRecordingSession()
 const fileInputRef=useRef<HTMLInputElement>(null)
 const busy=['requesting','recording','importing','analyzing'].includes(s.phase)
 const result=s.phase==='ready'&&s.view==='report'&&!!s.report
 const failed=s.phase==='error'
 const retry=controller.canRetry()
 const toolItems:ToolItem[]=[
  {id:'record',variant:'primary',icon:s.phase==='recording'?'■':result?'↻':'●',
   label:s.phase==='recording'?'结束并分析':s.phase==='requesting'?'麦克风授权中…':s.phase==='importing'?'正在读取…':s.phase==='analyzing'?'正在分析…':result?'再录一段':failed?(retry?'重试分析':'再录一段'):'开始录音',
   recording:s.phase==='recording',disabled:busy&&s.phase!=='recording'},
  ...(busy?[{id:'cancel',variant:'ghost' as const,icon:'×',label:s.phase==='recording'?'取消录音':s.phase==='analyzing'?'取消分析':s.phase==='importing'?'取消导入':'取消'}]:[]),
  ...(s.report&&!busy&&!result?[{id:'return',variant:'ghost' as const,icon:'↩',label:'返回结果'}]:[]),
  ...(failed&&retry?[{id:'prepare',variant:'ghost' as const,icon:'↻',label:'再录一段'}]:[]),
  {id:'import',variant:'ghost',icon:'📁',label:'导入音频',disabled:busy,inMore:result||failed},
  {id:'help',variant:'ghost',icon:'?',label:'帮助'},{id:'about',variant:'ghost',icon:'ⓘ',label:'关于'},
 ]
 const handleClickTool=(id:string)=>{
  if(id==='help'){onHelp();return}if(id==='about'){onAbout();return}
  if(id==='cancel'){controller.cancel();return}
  if(id==='return'){controller.returnToReport();return}
  if(id==='prepare'){controller.prepare();return}
  if(id==='import'){if(!busy){controller.playback.pause();fileInputRef.current?.click()};return}
  if(id==='record'){
   if(s.phase==='recording'){controller.finish();return}
   if(busy)return
   if(result){controller.prepare();return}
   if(failed){if(retry)controller.retry();else controller.prepare();return}
   const {material,prompt}=getRecordingReference(p.referenceId)
   void controller.start({mode:material?'reading':'free',material:material?{id:material.id,version:material.version,title:material.title,source:material.source}:null,prompt})
  }
 }
 const handleFileChange=(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]
  if(file)void controller.importFile(file)
  event.target.value=''
 }
 return {toolItems,handleClickTool,fileInputRef,handleFileChange}
}
