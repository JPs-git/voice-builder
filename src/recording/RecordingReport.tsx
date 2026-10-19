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
    {clip.source==='file'?'导入音频 · '+clip.name:'录音'} · {clip.material?.title??clip.prompt??(clip.source==='file'?'材料未指定':clip.name)}
   </p></div>
   <div className={styles.reportMeta}><span>录音时长 <strong>{clip.duration.toFixed(2)} 秒</strong></span>
    <span>有效 F0 <strong>{s.validDuration.toFixed(2)} 秒</strong> · {(s.coverage*100).toFixed(0)}%</span></div>
  </header>
  {!enough&&<p className={styles.notice}>可用音高数据较少，请尝试录制更长的说话片段</p>}
  {limited&&<p className={styles.notice}>有效音高样本较少，结果仅供本段参考</p>}
  <div className={styles.stats}>
   <div className={styles.stat} data-testid="stat-median"><span>典型 F0</span><strong>{value(s.median)} <small>{enough?'Hz':''}</small></strong><p>这段话通常使用的音高</p></div>
   <div className={styles.stat} data-testid="stat-p10"><span>P10</span><strong>{value(s.p10)} <small>{enough?'Hz':''}</small></strong><p>常用音高范围下界</p></div>
   <div className={styles.stat} data-testid="stat-p90"><span>P90</span><strong>{value(s.p90)} <small>{enough?'Hz':''}</small></strong><p>常用音高范围上界</p></div>
  </div>
  <div className={styles.playback}>
   <Button aria-label={p.playing?'暂停':'播放'} label={p.playing?'暂停':'播放'} icon={p.playing?'Ⅱ':'▶'} onClick={()=>p.playing?playback.pause():playback.play()}/>
   <span className={styles.playbackTime}>{formatClock(p.position)} / {formatClock(clip.duration)}</span>
   <input type="range" aria-label="回放位置" min={0} max={clip.duration} step={.001} value={p.position} onChange={e=>seek(Number(e.target.value))}/>
  </div>
  {p.error&&<p role="alert" className={styles.error}>{p.error}</p>}
  {s.validDuration>0?<RecordingCharts analysis={analysis} showPercentiles={enough}/>
   :<div className={styles.empty}>未检测到有效音高。可以先回听原音频，检查收音或换一段录音。</div>}
  <details className={styles.explanation}><summary>统计说明</summary>
   <p>本报告统计整段录音中 {analysis.settings.statisticsRange.join('–')} Hz 范围内的有效音高。典型 F0 为中位数；P10/P90 是中间 80% 的分位范围，不代表最低/最高值。边界值重复时，实际落入范围的比例可能更高。</p>
   <p>停顿、无效值及超过 500 Hz 的检测值不按 0 Hz 计入。统计过滤不裁剪原音频，回放保留完整录音。</p>
   <p>有效 F0 时长：{s.validDuration.toFixed(2)} 秒；排除疑似孤立跳点 {s.excludedCount} 帧。有效时间比例不是识别准确率。</p>
   <p>超过 500 Hz 排除 {s.aboveLimitCount} 帧（{s.aboveLimitDuration.toFixed(2)} 秒）；占范围过滤及跳点排除前有效候选时长的 {s.aboveLimitProportion==null?'无有效候选':(s.aboveLimitProportion*100).toFixed(1)+'%'}。超范围不等于误检，也可能排除真实高音。</p>
   <p>检测范围 {analysis.settings.f0Range.join('–')} Hz；统计范围 {analysis.settings.statisticsRange.join('–')} Hz；{analysis.settings.sampleRate} Hz 采样率；50ms 分析窗、10ms 步长；版本 {analysis.version}。</p>
   <p>范围过滤和孤立跳点规则不能消除所有倍频或半频误差。音频与报告仅在本次打开期间保留。</p>
  </details>
 </section>
}
