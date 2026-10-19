import {useEffect,useRef,type CSSProperties} from 'react'
import {useOutletContext} from 'react-router-dom'
import type {ShellContext} from '../routes/AppShell'
import {useRecordingSession} from './RecordingSessionProvider'
import {READING_MATERIALS,SPEAKING_PROMPTS} from './materials'
import {RecordingReader} from './RecordingReader'
import {RecordingReport} from './RecordingReport'
import {formatClock} from './format'
import styles from './RecordingPage.module.css'

export function RecordingPage(){
 const shell=useOutletContext<ShellContext|null>()
 const {controller,snapshot:s,preferences:p,updatePreferences}=useRecordingSession()
 const busy=['requesting','recording','importing','analyzing'].includes(s.phase)
 const material=READING_MATERIALS.find(m=>m.id===p.materialId)??READING_MATERIALS[0]
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
    <section className={styles.settings} aria-label="录音设置">
     <div className={styles.settingsGroup}><span className={styles.settingLabel}>录音模式</span>
      <div className={styles.modes}>
       <button type="button" aria-pressed={p.mode==='reading'} disabled={busy} onClick={()=>updatePreferences({mode:'reading'})}>朗读</button>
       <button type="button" aria-pressed={p.mode==='free'} disabled={busy} onClick={()=>updatePreferences({mode:'free'})}>自由说话</button>
      </div>
     </div>
     <div className={styles.settingsGroup}>
      {p.mode==='reading'?<><label htmlFor="reading-material" className={styles.settingLabel}>阅读材料</label>
       <select id="reading-material" aria-label="阅读材料" disabled={busy} value={p.materialId} onChange={e=>updatePreferences({materialId:e.target.value})}>
        {READING_MATERIALS.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
       </select><span className={styles.muted}>{material.source} · 约 {material.estimatedSeconds} 秒</span></>
       :<button type="button" disabled={busy} className={styles.textButton}
         onClick={()=>updatePreferences({promptIndex:(p.promptIndex+1)%SPEAKING_PROMPTS.length,promptVisible:true})}>换一个话题</button>}
     </div>
     <div className={styles.status}>
      <span className={s.phase==='recording'?styles.recordingStatus:styles.muted} role="status">
       {s.phase==='recording'?'● 录音中':s.phase==='requesting'?'麦克风授权中…':s.phase==='importing'?'正在读取音频…':s.phase==='analyzing'?'正在分析…':'准备录音'}
      </span>
      <span className={styles.timer} role="timer">{formatClock(s.elapsed)} <span className={styles.muted}>/ 01:00</span></span>
     </div>
    </section>
    {(s.phase==='analyzing'||s.phase==='importing')&&<div className={styles.analysisProgress} aria-live="polite">
      <span>{s.phase==='importing'?'正在读取音频':'正在生成分析报告'}</span>
      {s.phase==='analyzing'&&<progress aria-label="分析进度" max={1} value={s.progress}/>}
      <span className={styles.muted}>声音仅在本地处理</span>
    </div>}
    <RecordingReader/>
   </>}
  </div>
 </main>
}
