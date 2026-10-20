import {it,expect,vi} from 'vitest'
import {render,cleanup} from '@testing-library/react'
import {RecordingCharts} from '../recording/RecordingCharts'
import {summarizePitch} from '../recording/statistics'
import {ANALYSIS_SETTINGS} from '../recording/constants'
const charts=vi.hoisted(()=>[] as any[])
vi.mock('echarts',async importOriginal=>{
 const actual=await importOriginal<typeof import('echarts')>()
 actual.setPlatformAPI({measureText:text=>({width:String(text).length*7})})
 return {...actual,init:()=>{
  const chart=actual.init(null,undefined,{renderer:'svg',ssr:true,width:800,height:300})
  charts.push(chart);return chart
 }}
})
it('renders one real histogram and hides percentile marks for insufficient samples',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}})
 const analysis={...summarizePitch([],45),settings:ANALYSIS_SETTINGS,version:'test'}
 const view=render(<RecordingCharts analysis={analysis}/>)
 expect(charts).toHaveLength(1)
 expect(charts[0].getOption().series[0].type).toBe('bar')
 expect(charts[0].getOption().xAxis[0]).toMatchObject({min:60,max:500})
 view.rerender(<RecordingCharts analysis={analysis} showPercentiles={false}/>)
 expect(charts[0].getOption().series[0].markLine).toBeUndefined()
 cleanup();vi.unstubAllGlobals()
})
