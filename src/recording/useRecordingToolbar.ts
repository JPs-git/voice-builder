import {useRef} from 'react'
import type {ToolItem} from '../hooks/useToolbar'
import {useRecordingSession} from './RecordingSessionProvider'
import {READING_MATERIALS,SPEAKING_PROMPTS} from './materials'
export function useRecordingToolbar(onHelp:()=>void,onAbout:()=>void){
 const {controller,snapshot:s,preferences:p}=useRecordingSession()
 const fileInputRef=useRef<HTMLInputElement>(null)
 const busy=['requesting','recording','importing','analyzing'].includes(s.phase)
 const toolItems:ToolItem[]=[
  {id:'record',variant:'primary',icon:s.phase==='recording'?'■':'●',
   label:s.phase==='recording'?'结束并分析':s.phase==='requesting'?'麦克风授权中…':s.phase==='importing'?'正在读取…':s.phase==='analyzing'?'正在分析…':s.report?'重新录音':'开始录音',
   recording:s.phase==='recording',disabled:busy&&s.phase!=='recording'},
  ...(busy?[{id:'cancel',variant:'ghost' as const,icon:'×',label:s.phase==='recording'?'取消录音':s.phase==='analyzing'?'取消分析':'取消'}]:[]),
  {id:'import',variant:'ghost',icon:'📁',label:'导入音频',disabled:busy},
  ...(s.phase==='ready'?[{id:'clear',variant:'ghost' as const,icon:'↺',label:'清除本次'}]:[]),
  {id:'help',variant:'ghost',icon:'?',label:'帮助'},{id:'about',variant:'ghost',icon:'ⓘ',label:'关于'},
 ]
 const handleClickTool=(id:string)=>{
  if(id==='help'){onHelp();return}if(id==='about'){onAbout();return}
  if(id==='cancel'){controller.cancel();return}
  if(id==='clear'){controller.clear();return}
  if(id==='import'){if(!busy)fileInputRef.current?.click();return}
  if(id==='record'){
   if(s.phase==='recording'){controller.finish();return}
   if(busy)return
   const selected=READING_MATERIALS.find(m=>m.id===p.materialId)??READING_MATERIALS[0]
   void controller.start({mode:p.mode,material:p.mode==='reading'?{id:selected.id,version:selected.version,title:selected.title,source:selected.source}:null,
    prompt:p.mode==='free'?SPEAKING_PROMPTS[p.promptIndex]:null})
  }
 }
 const handleFileChange=(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]
  if(file)void controller.importFile(file)
  event.target.value=''
 }
 return {toolItems,handleClickTool,fileInputRef,handleFileChange}
}
