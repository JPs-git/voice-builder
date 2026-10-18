import {StrictMode} from 'react'
import {it,expect,vi} from 'vitest'
import {render,cleanup} from '@testing-library/react'
import {RecordingCharts} from '../recording/RecordingCharts'
import {summarizePitch} from '../recording/statistics'
import {ANALYSIS_SETTINGS} from '../recording/constants'
vi.mock('echarts',()=>({init:()=>{
 let disposed=false
 const zr={on:vi.fn(),off:vi.fn()}
 return {getZr:()=>disposed?null:zr,dispose:()=>{disposed=true},setOption:vi.fn(),resize:vi.fn()}
}}))
it('can mount and unmount charts under StrictMode after chart disposal',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}})
 const analysis={...summarizePitch([],45),settings:ANALYSIS_SETTINGS,version:'test'}
 expect(()=>{
  render(<StrictMode><RecordingCharts analysis={analysis} duration={45} position={0} onSeek={()=>{}}/></StrictMode>)
  cleanup()
 }).not.toThrow()
 vi.unstubAllGlobals()
})
