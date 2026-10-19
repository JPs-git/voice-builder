import {useEffect,useRef,type CSSProperties} from 'react'
import {useOutletContext} from 'react-router-dom'
import type {ShellContext} from '../routes/AppShell'
import {useRecordingSession} from './RecordingSessionProvider'
import {getRecordingReference} from './references'
import {RecordingReferenceSelect} from './RecordingReferenceSelect'
import {useMediaQuery} from '../hooks/useMediaQuery'
import {RecordingReader} from './RecordingReader'
import {useReportNavigation} from './useReportNavigation'
import {formatClock} from './format'
import styles from './RecordingPage.module.css'
import {canAutoFocusPage} from '../components/focusTarget'

export function RecordingPage(){
 const shell=useOutletContext<ShellContext|null>()
 const portrait=useMediaQuery('(max-width: 768px)')
 const {controller,snapshot:s,preferences:p}=useRecordingSession()
 const {material}=getRecordingReference(p.referenceId)
 const errorRef=useRef<HTMLDivElement>(null)
 const mainRef=useRef<HTMLElement>(null)
 const {openReport}=useReportNavigation()
 const observed=useRef(s.completedRecordId)
 useEffect(()=>{
  if(s.phase==='prepared'&&s.completedRecordId&&observed.current!==s.completedRecordId){
   observed.current=s.completedRecordId;openReport(s.completedRecordId)
  }
 },[s.phase,s.completedRecordId,openReport])
 useEffect(()=>{
  const title=mainRef.current?.querySelector<HTMLElement>('h1')
  if(title&&canAutoFocusPage()){title.tabIndex=-1;title.focus()}
 },[])
 useEffect(()=>{if(s.error&&canAutoFocusPage())errorRef.current?.focus()},[s.error])
 return <main ref={mainRef} className={styles.page} data-recording-page data-reader-active="true" style={{'--recording-dock-height':shell?.dockHeight?`${shell.dockHeight}px`:undefined} as CSSProperties}>
  <div className={styles.content}>
   {s.error&&<div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
    <span>{s.error}</span>
   </div>}
    {!portrait&&<section className={styles.settings} aria-label="录音设置">
     <div className={styles.settingsGroup}>
      <label htmlFor="recording-reference" className={styles.settingLabel}>参考内容</label>
      <RecordingReferenceSelect/>
      {material&&<span className={styles.muted}>{material.source} · 约 {material.estimatedSeconds} 秒</span>}
     </div>
     <div className={styles.status}>
      <span className={s.phase==='recording'?styles.recordingStatus:styles.muted} role="status">
       {s.phase==='recording'?'● 录音中':s.phase==='requesting'?'麦克风授权中…':s.phase==='importing'?'正在读取音频…':s.phase==='analyzing'?'正在分析…':'准备录音'}
      </span>
      <span className={styles.timer} role="timer">{formatClock(s.elapsed)} <span className={styles.muted}>/ 01:00</span></span>
     </div>
    </section>}
    {(s.phase==='analyzing'||s.phase==='importing')&&<div className={styles.analysisProgress} aria-live="polite">
      <span>{s.phase==='importing'?'正在读取音频':'正在生成分析报告'}</span>
      {s.phase==='analyzing'&&<progress aria-label="分析进度" max={1} value={s.progress}/>}
      <span className={styles.muted}>声音仅在本地处理</span>
    </div>}
    <RecordingReader compact={portrait}/>
  </div>
 </main>
}
