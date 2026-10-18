import {useEffect} from 'react'
import {useECharts} from '../hooks/useECharts'
import type {ClipAnalysis} from './types'
import {buildPitchOption,buildDistributionOption} from './chartOptions'
import styles from './RecordingPage.module.css'
export function RecordingCharts({analysis,duration,position,onSeek}:{analysis:ClipAnalysis;duration:number;position:number;onSeek:(seconds:number)=>void}){
 const pitch=useECharts(),distribution=useECharts()
 useEffect(()=>{pitch.setOption(buildPitchOption(analysis.frames,analysis.summary,duration,position),{notMerge:true})},[analysis,duration,position,pitch.setOption])
 useEffect(()=>{distribution.setOption(buildDistributionOption(analysis.summary),{notMerge:true})},[analysis,distribution.setOption])
 useEffect(()=>{
  const chart=pitch.getInstance();if(!chart)return
  const click=(event:{offsetX:number;offsetY:number})=>{
   const point=[event.offsetX,event.offsetY]
   if(!chart.containPixel({gridIndex:0},point))return
   const data=chart.convertFromPixel({gridIndex:0},point) as number[]
   if(Number.isFinite(data?.[0]))onSeek(Math.max(0,Math.min(duration,data[0])))
  }
  chart.getZr().on('click',click)
  return()=>{chart.getZr()?.off('click',click)}
 },[pitch.getInstance,onSeek,duration])
 return <div className={styles.charts}>
  <section className={styles.chartCard}><h2>音高随时间变化</h2>
   <div ref={pitch.chartRef} className={styles.chart} data-acoustic-chart role="img" aria-label="整段录音的 F0 时间曲线，包含典型值与极值标记"/>
  </section>
  <section className={styles.chartCard}><h2>音高分布</h2>
   <div ref={distribution.chartRef} className={styles.chart} data-acoustic-chart role="img" aria-label="有效音高的时间分布及 P10–P90 范围"/>
  </section>
 </div>
}
