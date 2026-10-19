import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {RecordingReport} from '../recording/RecordingReport'
import {summarizePitch} from '../recording/statistics'
import type {RecordingReport as ReportData,PitchFrame} from '../recording/types'
import {ANALYSIS_SETTINGS} from '../recording/constants'
vi.mock('../hooks/useECharts',()=>({useECharts:()=>({chartRef:{current:null},getInstance:()=>null,setOption:()=>{}})}))
const engine=vi.hoisted(()=>({audioContext:{currentTime:0},createPlaybackSource:vi.fn(()=>({source:{start:vi.fn(),stop:vi.fn(),onended:null}}))}))
vi.mock('../ts',()=>({getAudioEngine:()=>engine}))
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
it('shows only three percentile metrics, one histogram and full playback controls',()=>{
 render(<RecordingReport report={report(4)}/>)
 expect(screen.getByTestId('stat-p10').textContent).toContain('200')
 expect(screen.getByTestId('stat-p90').textContent).toContain('200')
 expect(screen.getAllByRole('img')).toHaveLength(1)
 expect(screen.queryByRole('button',{name:/定位|回听此处/})).toBeNull()
 expect(screen.queryByText(/变化幅度|最高 F0|最低 F0|音高随时间变化/)).toBeNull()
 fireEvent.change(screen.getByLabelText('回放位置'),{target:{value:'3'}})
 expect(screen.getByLabelText('回放位置').getAttribute('value')).toBe('3')
 expect(screen.getByRole('button',{name:'播放'})).toBeTruthy()
})
it('identifies the imported file in the report',()=>{
 const data=report(12)
 data.clip={...data.clip,source:'file',name:'自然说话.wav',mode:null,material:null}
 render(<RecordingReport report={data}/>)
 expect(screen.getByText(/自然说话\.wav/)).toBeTruthy()
})
it('keeps full playback active after seeking, without a local review action',()=>{
 vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn())
 render(<RecordingReport report={report(4)}/>)
 fireEvent.click(screen.getByRole('button',{name:'播放'}))
 expect(screen.getByRole('button',{name:'暂停'})).toBeTruthy()
 const sources=engine.createPlaybackSource.mock.calls.length
 fireEvent.change(screen.getByLabelText('回放位置'),{target:{value:'3'}})
 expect(engine.createPlaybackSource.mock.calls.length).toBe(sources+1)
 expect(screen.getByRole('button',{name:'暂停'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:'回听此处'})).toBeNull()
 cleanup();vi.unstubAllGlobals()
})
