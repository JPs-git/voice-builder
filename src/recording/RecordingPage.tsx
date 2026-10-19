import {useEffect,useRef,type CSSProperties} from 'react'
import {useOutletContext} from 'react-router-dom'
import type {ShellContext} from '../routes/AppShell'
import {useRecordingSession} from './RecordingSessionProvider'
import {getRecordingReference} from './references'
import {RecordingReferenceSelect} from './RecordingReferenceSelect'
import {useMediaQuery} from '../hooks/useMediaQuery'
import {RecordingReader} from './RecordingReader'
import {RecordingReport} from './RecordingReport'
import {formatClock} from './format'
import styles from './RecordingPage.module.css'

export function RecordingPage(){
 const shell=useOutletContext<ShellContext|null>()
 const portrait=useMediaQuery('(max-width: 768px)')
 const {controller,snapshot:s,preferences:p}=useRecordingSession()
 const {material}=getRecordingReference(p.referenceId)
 const errorRef=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(s.error&&document.visibilityState!=='hidden')errorRef.current?.focus()},[s.error])
 return <main className={styles.page} data-recording-page style={{'--recording-dock-height':shell?.dockHeight?`${shell.dockHeight}px`:undefined} as CSSProperties}>
  <div className={styles.content}>
   {s.error&&<div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
    <span>{s.error}</span>
    {s.phase==='error'&&<><button type="button" onClick={()=>controller.retry()}>重试分析</button>
     <button type="button" onClick={()=>controller.cancel()}>返回{s.report?'上一份结果':'准备录音'}</button></>}
   </div>}
   {s.phase==='ready'&&s.report?<RecordingReport report={s.report}/>:<>
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
   </>}
  </div>
 </main>
}
