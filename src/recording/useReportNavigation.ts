import {useCallback} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
interface ReportSource {path:string;label:'返回录音'|'返回列表';viaPush:true}
function readSource(state:unknown):ReportSource|null{
 const source=(state as {reportSource?:Partial<ReportSource>}|null)?.reportSource
 return source?.viaPush===true&&typeof source.path==='string'&&source.path.startsWith('/')&&!source.path.startsWith('//')
  &&(source.label==='返回录音'||source.label==='返回列表')?source as ReportSource:null
}
export function useReportNavigation(){
 const location=useLocation(),navigate=useNavigate()
 const source=readSource(location.state)
 const openReport=useCallback((id:string)=>navigate(`/reports/${encodeURIComponent(id)}`,{state:{reportSource:{
  path:location.pathname+location.search+location.hash,label:'返回录音',viaPush:true,
 }}}),[navigate,location.pathname,location.search,location.hash])
 const back=useCallback((available=true)=>{
  if(available&&readSource(location.state))navigate(-1)
  else navigate('/recording',{replace:true})
 },[navigate,location.state])
 return {openReport,back,backLabel:source?.label??'返回录音'}
}
