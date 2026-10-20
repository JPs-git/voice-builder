import {useEffect,useRef,type CSSProperties} from 'react'
import {useParams,useLocation,useNavigationType} from 'react-router-dom'
import {consumeReportEntry,reportOpened} from './reportAnalytics'
import {useMediaQuery} from '../hooks/useMediaQuery'
import {Button} from '../components/Button'
import {useRecordingRecords} from './RecordingRecordsProvider'
import {useReportNavigation} from './useReportNavigation'
import {RecordingReport} from './RecordingReport'
import styles from './RecordingPage.module.css'

/** Read-only record details: no recorder provider or task controller required. */
export function RecordingReportPage(){
 const {reportId}=useParams(),{records}=useRecordingRecords()
 const report=records.get(reportId??'')
 const location=useLocation(),navigationType=useNavigationType()
 const observed=useRef<string|null>(null)
 useEffect(()=>{
  const key=location.key+location.pathname
  if(observed.current===key)return
  observed.current=key
  reportOpened(consumeReportEntry(records,location.pathname,navigationType),!!report)
 },[location.key,location.pathname,navigationType,records,report])
 const {back,backLabel}=useReportNavigation()
 const portrait=useMediaQuery('(max-width: 768px)')
 return <main className={styles.page} data-recording-page data-report-detail style={{'--recording-dock-height':'0px'} as CSSProperties}>
  <div className={styles.content}>
   {report?<RecordingReport report={report} playbackController={records.playback}
    onBack={portrait?()=>back():undefined} backLabel={backLabel}/>:<section className={styles.empty}>
    <h1>报告不存在或已失效</h1><p>当前录音与报告仅在本次打开期间保留，请返回录音页重新分析。</p>
    {portrait&&<Button type="button" onClick={()=>back(false)}>返回录音</Button>}
   </section>}
  </div>
 </main>
}
