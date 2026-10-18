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
it('preserves the actual ECharts zoom when the playback cursor changes',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}})
 const analysis={...summarizePitch([],45),settings:ANALYSIS_SETTINGS,version:'test'}
 const onSeek=()=>{}
 const view=render(<RecordingCharts analysis={analysis} duration={45} position={0} onSeek={onSeek}/>)
 charts[0].dispatchAction({type:'dataZoom',start:20,end:40})
 view.rerender(<RecordingCharts analysis={analysis} duration={45} position={7} onSeek={onSeek}/>)
 expect(charts[0].getOption().dataZoom[0]).toMatchObject({start:20,end:40})
 cleanup();vi.unstubAllGlobals()
})
