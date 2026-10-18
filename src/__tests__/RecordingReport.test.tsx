import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {RecordingReport} from '../recording/RecordingReport'
import {summarizePitch} from '../recording/statistics'
import type {RecordingReport as ReportData,PitchFrame} from '../recording/types'
import {ANALYSIS_SETTINGS} from '../recording/constants'
vi.mock('../hooks/useECharts',()=>({useECharts:()=>({chartRef:{current:null},getInstance:()=>null,setOption:()=>{}})}))
afterEach(cleanup)
function report(seconds:number):ReportData{
 const frames:PitchFrame[]=Array.from({length:Math.round(seconds*100)},(_,i)=>({start:i*.01,time:i*.01+.025,duration:.01,rawF0:200,f0:200,voiced:true,exclusion:null}))
 const data=summarizePitch(frames,10)
 return {id:1,clip:{samples:new Float32Array(160000),sampleRate:16000,duration:10,name:'测试片段',source:'mic',mode:'reading',material:null,prompt:null},
 analysis:{...data,version:'test',settings:ANALYSIS_SETTINGS}}
}
it.each([2.99,3,9.99,10])('applies the %s second valid-data presentation policy',seconds=>{
 render(<RecordingReport report={report(seconds)}/>)
 const card=screen.getByTestId('stat-median')
 expect(card.textContent).toContain(seconds<3?'—':'200')
 expect(!!screen.queryByText('有效音高样本较少，结果仅供本段参考')).toBe(seconds>=3&&seconds<10)
})
it('extremum selection locates without starting playback',()=>{
 render(<RecordingReport report={report(4)}/>)
 fireEvent.click(screen.getByRole('button',{name:/定位最高/}))
 expect(screen.getByLabelText('回放位置').getAttribute('value')).toBe('0.025')
 expect(screen.getByRole('button',{name:'播放'})).toBeTruthy()
})
it('identifies the imported file in the report',()=>{
 const data=report(12)
 data.clip={...data.clip,source:'file',name:'自然说话.wav',mode:null,material:null}
 render(<RecordingReport report={data}/>)
 expect(screen.getByText(/自然说话\.wav/)).toBeTruthy()
})
