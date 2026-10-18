import {useEffect,useRef,useCallback} from 'react'
import type {RecordingReport as ReportData} from './types'
import {useRecordingPlayback} from './useRecordingPlayback'
import {RecordingCharts} from './RecordingCharts'
import {formatClock,formatHz} from './format'
import {Button} from '../components/Button'
import styles from './RecordingPage.module.css'
export function RecordingReport({report}:{report:ReportData}){
 const {clip,analysis}=report,s=analysis.summary
 const {controller:playback,snapshot:p}=useRecordingPlayback(clip)
 const titleRef=useRef<HTMLHeadingElement>(null)
 useEffect(()=>{if(document.visibilityState!=='hidden')titleRef.current?.focus()},[report.id])
 const seek=useCallback((seconds:number)=>playback.seek(seconds),[playback])
 const enough=s.validDuration+1e-9>=3,limited=enough&&s.validDuration<10-1e-9
 const value=(v:number|null)=>enough?formatHz(v):'—'
 return <section className={styles.report}>
  <header className={styles.reportHeader}>
   <div><h1 ref={titleRef} tabIndex={-1}>录音分析结果</h1><p className={styles.muted}>
    {clip.source==='file'?'导入音频 · '+clip.name:clip.mode==='reading'?'朗读':'自由说话'} · {clip.material?.title??(clip.source==='file'?'材料未指定':clip.name)}
   </p></div>
   <div className={styles.reportMeta}><span>录音时长 <strong>{clip.duration.toFixed(2)} 秒</strong></span>
    <span>有效 F0 <strong>{s.validDuration.toFixed(2)} 秒</strong> · {(s.coverage*100).toFixed(0)}%</span></div>
  </header>
  {!enough&&<p className={styles.notice}>可用音高数据较少，请尝试录制更长的说话片段</p>}
  {limited&&<p className={styles.notice}>有效音高样本较少，结果仅供本段参考</p>}
  <div className={styles.stats}>
   <div className={styles.stat} data-testid="stat-median"><span>典型 F0</span><strong>{value(s.median)} <small>{enough?'Hz':''}</small></strong><p>这段话通常使用的音高</p></div>
   <button type="button" className={styles.stat} disabled={!enough} aria-label="定位最高 F0" onClick={()=>seek(s.maxTime??0)}>
    <span>最高 F0 <span className={styles.linkHint}>定位 ↗</span></span><strong>{value(s.maximum)} <small>{enough?'Hz':''}</small></strong>
    <p>{enough&&s.maxTime!=null?'出现在 '+s.maxTime.toFixed(2)+' 秒':'本段检测到的最高值'}</p></button>
   <button type="button" className={styles.stat} disabled={!enough} aria-label="定位最低 F0" onClick={()=>seek(s.minTime??0)}>
    <span>最低 F0 <span className={styles.linkHint}>定位 ↗</span></span><strong>{value(s.minimum)} <small>{enough?'Hz':''}</small></strong>
    <p>{enough&&s.minTime!=null?'出现在 '+s.minTime.toFixed(2)+' 秒':'本段检测到的最低值'}</p></button>
   <div className={styles.stat}><span>F0 变化幅度</span><strong>{value(s.range)} <small>{enough?'Hz':''}</small></strong>
    <p>{enough&&s.semitoneRange!=null?s.semitoneRange.toFixed(1)+' 半音':'最高值与最低值之差'}</p></div>
  </div>
  <div className={styles.playback}>
   <Button aria-label={p.playing?'暂停':'播放'} label={p.playing?'暂停':'播放'} icon={p.playing?'Ⅱ':'▶'} onClick={()=>p.playing?playback.pause():playback.play()}/>
   <span className={styles.playbackTime}>{formatClock(p.position)} / {formatClock(clip.duration)}</span>
   <input type="range" aria-label="回放位置" min={0} max={clip.duration} step={.001} value={p.position} onChange={e=>seek(Number(e.target.value))}/>
   <Button label="回听此处" icon="↺" aria-label="回听此处" onClick={()=>playback.playAround(p.position)}/>
  </div>
  {p.error&&<p role="alert" className={styles.error}>{p.error}</p>}
  {s.validDuration>0?<RecordingCharts analysis={analysis} duration={clip.duration} position={p.position} onSeek={seek}/>
   :<div className={styles.empty}>未检测到有效音高。可以先回听原音频，检查收音或换一段录音。</div>}
  <div className={styles.commonRange}>常用音高范围：<strong>{enough?formatHz(s.p10)+'–'+formatHz(s.p90)+' Hz':'—'}</strong>
   <span className={styles.muted}>（P10–P90）</span></div>
  <details className={styles.explanation}><summary>统计说明</summary>
   <p>本报告覆盖整段录音。典型 F0 为有效值中位数；最高、最低是本段检测极值，变化幅度为两者之差，不代表个人完整音域。</p>
   <p>P10–P90 是中间 80% 的分位范围；边界值重复时，实际落入范围的比例可能更高。停顿与无效值不按 0 Hz 计入。</p>
   <p>有效 F0 时长：{s.validDuration.toFixed(2)} 秒；排除疑似孤立跳点 {s.excludedCount} 帧。有效时间比例不是识别准确率。</p>
   <p>分析范围 {analysis.settings.f0Range.join('–')} Hz；{analysis.settings.sampleRate} Hz 采样率；50ms 分析窗、10ms 步长；版本 {analysis.version}。</p>
   <p>短暂跳点通过双侧连续性校验排除，较长的倍频或半频误差仍可能存在。请结合极值附近的回听理解结果。音频与报告仅在本次打开期间保留。</p>
  </details>
 </section>
}
