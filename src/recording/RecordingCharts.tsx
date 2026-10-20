import {useEffect} from 'react'
import {useECharts} from '../hooks/useECharts'
import type {ClipAnalysis} from './types'
import {buildDistributionOption} from './chartOptions'
import styles from './RecordingPage.module.css'
export function RecordingCharts({analysis,showPercentiles=true}:{analysis:ClipAnalysis;showPercentiles?:boolean}){
 const distribution=useECharts()
 useEffect(()=>{distribution.setOption(buildDistributionOption(analysis.summary,showPercentiles),{notMerge:true})},[analysis,showPercentiles,distribution.setOption])
 return <div className={styles.charts}>
  <section className={styles.chartCard}><h2>音高分布</h2>
   <div ref={distribution.chartRef} className={styles.chart} data-acoustic-chart role="img" aria-label="60–500 Hz 有效音高时间分布直方图"/>
  </section>
 </div>
}
