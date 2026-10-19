import {StrictMode} from 'react'
import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom'
import {RecordingReportPage} from '../recording/RecordingReportPage'
import {RecordingRecordsProvider} from '../recording/RecordingRecordsProvider'
import {RecordingRecordStore} from '../recording/recordStore'
import {summarizePitch} from '../recording/statistics'
import {ANALYSIS_SETTINGS} from '../recording/constants'
vi.mock('../hooks/useMediaQuery',()=>({useMediaQuery:()=>true}))
vi.mock('../hooks/useECharts',()=>({useECharts:()=>({chartRef:{current:null},setOption:()=>{},getInstance:()=>null})}))
afterEach(cleanup)
function record(){
 const records=new RecordingRecordStore()
 const clip={samples:new Float32Array(16000),sampleRate:16000,duration:1,source:'file' as const,name:'测试.wav',mode:null,material:null,prompt:null}
 const item=records.publish(clip,{...summarizePitch([],1),settings:ANALYSIS_SETTINGS,version:'test'},new Date('2026-10-19T00:00:00Z'))
 return {records,item,clip}
}
function Path(){return <span data-testid="path">{useLocation().pathname}</span>}
function mount(records:RecordingRecordStore,entries:any[]){return render(<MemoryRouter initialEntries={entries}><RecordingRecordsProvider store={records}>
 <Path/><Routes><Route path="/reports/:reportId" element={<RecordingReportPage/>}/><Route path="/recording" element={<h1>录音准备</h1>}/><Route path="/list" element={<h1>记录列表</h1>}/></Routes>
 </RecordingRecordsProvider></MemoryRouter>)}
it('reads a report without mounting the recorder and falls back to recording without a source',()=>{
 const {records,item}=record()
 mount(records,[`/reports/${item.id}`])
 expect(screen.getByRole('heading',{name:'录音分析结果'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:/再录|导入|开始录音/})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'返回录音'}))
 expect(screen.getByRole('heading',{name:'录音准备'})).toBeTruthy()
 expect(records.get(item.id)).toBe(item)
})
it('returns to a supplied list source without starting a recording flow',()=>{
 const {records,item}=record()
 mount(records,[{pathname:'/list',key:'list-entry'},{pathname:`/reports/${item.id}`,state:{reportSource:{path:'/list',label:'返回列表',viaPush:true}}}])
 fireEvent.click(screen.getByRole('button',{name:'返回列表'}))
 expect(screen.getByRole('heading',{name:'记录列表'})).toBeTruthy()
 expect(screen.getByTestId('path').textContent).toBe('/list')
})
it('shows a missing-record state without fabricating a report',()=>{
 mount(new RecordingRecordStore(),['/reports/missing'])
 expect(screen.getByRole('heading',{name:'报告不存在或已失效'})).toBeTruthy()
 expect(screen.queryByLabelText('回放位置')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'返回录音'}))
 expect(screen.getByTestId('path').textContent).toBe('/recording')
})
it('uses record IDs independent of tasks, replaces only on successful publish and supports statistics-only records',()=>{
 const {records,item,clip}=record()
 expect(typeof item.id).toBe('string')
 expect(item.createdAt).toBe('2026-10-19T00:00:00.000Z')
 records.playback.seek(.5)
 const next=records.publish(clip,item.analysis,new Date())
 expect(records.playback.getSnapshot().position).toBe(0)
 expect(next.id).not.toBe(item.id)
 expect(records.get(item.id)).toBeNull()
 const {samples,...metadata}=next.clip
 const noAudio={...next,clip:metadata}
 mount(new RecordingRecordStore(noAudio),[`/reports/${next.id}`])
 expect(screen.getByRole('heading',{name:'录音分析结果'})).toBeTruthy()
 expect(screen.queryByLabelText('回放位置')).toBeNull()
 expect(screen.getByText('此记录没有可回放的音频')).toBeTruthy()
})

it('preserves a record and paused position across StrictMode effect replay',()=>{
 const {records,item}=record();records.playback.seek(.4)
 render(<StrictMode><MemoryRouter initialEntries={[`/reports/${item.id}`]}><RecordingRecordsProvider store={records}><Routes>
 <Route path="/reports/:reportId" element={<RecordingReportPage/>}/></Routes></RecordingRecordsProvider></MemoryRouter></StrictMode>)
 expect(screen.getByLabelText('回放位置').getAttribute('value')).toBe('0.4')
 expect(records.get(item.id)).toBe(item)
})
