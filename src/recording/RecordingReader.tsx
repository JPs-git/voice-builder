import {useRecordingSession} from './RecordingSessionProvider'
import {READING_MATERIALS,SPEAKING_PROMPTS} from './materials'
import styles from './RecordingPage.module.css'
export function RecordingReader(){
 const {preferences:p,updatePreferences}=useRecordingSession()
 const material=READING_MATERIALS.find(m=>m.id===p.materialId)??READING_MATERIALS[0]
 const sizes=[18,20,22,24,26]
 const step=(direction:number)=>{
  const index=sizes.indexOf(p.fontSize)
  updatePreferences({fontSize:sizes[Math.max(0,Math.min(sizes.length-1,index+direction))]})
 }
 return <section className={styles.reader}>
  <header className={styles.readerHeader}><strong>{p.mode==='reading'?'阅读材料':'自由说话'}</strong>
   <div className={styles.fontControls}><span>字号</span>
    <button type="button" aria-label="减小字号" disabled={p.fontSize===18} onClick={()=>step(-1)}>−</button>
    <span aria-hidden="true">A</span>
    <button type="button" aria-label="增大字号" disabled={p.fontSize===26} onClick={()=>step(1)}>＋</button>
   </div>
  </header>
  {p.mode==='reading'?<article className={styles.article}>
   <h1>{material.title}</h1>
   <div data-testid="reading-body" style={{fontSize:p.fontSize}}>
    {material.paragraphs.map(text=><p key={text}>{text}</p>)}
   </div>
  </article>:<div className={styles.freeBody} style={{fontSize:p.fontSize}}>
    {p.promptVisible?<><h1>{SPEAKING_PROMPTS[p.promptIndex]}</h1><button type="button" className={styles.textButton} onClick={()=>updatePreferences({promptVisible:false})}>收起提示</button></>
     :<><p>按自己的习惯说一段话</p><button type="button" className={styles.textButton} onClick={()=>updatePreferences({promptVisible:true})}>显示提示</button></>}
   </div>}
  <footer className={styles.readerFooter}>按自己的习惯{p.mode==='reading'?'朗读':'说话'}，结束后查看分析结果</footer>
 </section>
}
