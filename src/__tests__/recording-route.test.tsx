import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {AppShell} from '../routes/AppShell'
import {RecordingPage} from '../recording/RecordingPage'
import {summarizePitch} from '../recording/statistics'
import {ANALYSIS_SETTINGS} from '../recording/constants'
const analyze=vi.hoisted(()=>vi.fn())
vi.mock('../recording/workerClient',()=>({runClipAnalysis:analyze}))
const realtime=vi.hoisted(()=>({suspend:vi.fn(),handleClickTool:vi.fn()}))
const audio=vi.hoisted(()=>({startCapture:vi.fn(),stopCapture:vi.fn()}))
vi.mock('../ts',()=>({getAudioEngine:()=>audio}))
vi.mock('../hooks/useToolbar',()=>({useToolbar:()=>({...realtime,toolItems:[{id:'record',label:'开始录音',variant:'primary',icon:'●'}],
 cursorTime:0,hasData:false,isCapturing:false,isRequesting:false,fileInputRef:{current:null},handleFileChange:()=>{}})}))
vi.mock('../hooks/useMediaQuery',()=>({useMediaQuery:()=>false}))
vi.mock('../hooks/useECharts',()=>({useECharts:()=>({chartRef:{current:null},getInstance:()=>null,setOption:()=>{}})}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
function mount(path='/recording'){
 return render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<AppShell/>}>
 <Route index element={<div>实时页内容</div>}/><Route path="recording" element={<RecordingPage/>}/>
 <Route path="practice" element={<div>音高参考内容</div>}/></Route></Routes></MemoryRouter>)
}
it('uses one directly accessible recorder and page-specific help without a target dock',async()=>{
 mount()
 expect(screen.getByRole('link',{name:'统计分析'})).toBeTruthy()
 expect(screen.getAllByRole('button',{name:/开始录音/})).toHaveLength(1)
 fireEvent.click(screen.getByRole('button',{name:'更多操作'}))
 fireEvent.click(screen.getByRole('menuitem',{name:/帮助/}))
 expect(screen.getByText('安静录音，录后分析')).toBeTruthy()
 expect(screen.queryByRole('button',{name:'训练目标'})).toBeNull()
})
it('suspends realtime on entry and stops the new capture on leaving',async()=>{
 let chunk!:(samples:Float32Array,rate:number)=>void
 audio.startCapture.mockImplementation(async cb=>{chunk=cb})
 mount('/')
 fireEvent.click(screen.getByRole('link',{name:'统计分析'}))
 expect(realtime.suspend).toHaveBeenCalledTimes(1)
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/开始录音/})))
 act(()=>chunk(new Float32Array(16000),16000))
 expect(screen.getByRole('button',{name:/结束并分析/})).toBeTruthy()
 expect(screen.getByLabelText('参考内容').hasAttribute('disabled')).toBe(true)
 await act(async()=>{fireEvent.click(screen.getByRole('link',{name:'实时分析'}));await Promise.resolve()})
 expect(audio.stopCapture).toHaveBeenCalled()
 expect(screen.getByText('实时页内容')).toBeTruthy()
})


it('uses desktop result actions, prepares without recording, and keeps that view across routes',async()=>{
 let chunk!:(samples:Float32Array,rate:number)=>void
 audio.startCapture.mockImplementation(async cb=>{chunk=cb})
 analyze.mockResolvedValue({...summarizePitch([],1),settings:ANALYSIS_SETTINGS,version:'test'})
 mount()
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})))
 act(()=>chunk(new Float32Array(16000),16000))
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'结束并分析'})))
 expect(screen.getByRole('heading',{name:'录音分析结果'})).toBeTruthy()
 expect(screen.getByRole('button',{name:'再录一段'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:'清除本次'})).toBeNull()
 expect(screen.queryByRole('button',{name:'导入音频'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'更多操作'}))
 expect(screen.getByRole('menuitem',{name:/导入音频/})).toBeTruthy()
 fireEvent.keyDown(document,{key:'Escape'})
 fireEvent.change(document.querySelector('input[type=file]')!,{target:{files:[]}})
 expect(screen.getByRole('heading',{name:'录音分析结果'})).toBeTruthy()
 expect(analyze).toHaveBeenCalledTimes(1)
 const starts=audio.startCapture.mock.calls.length
 fireEvent.click(screen.getByRole('button',{name:'再录一段'}))
 expect(screen.getByRole('button',{name:'开始录音'})).toBeTruthy()
 expect(screen.getByRole('button',{name:'返回结果'})).toBeTruthy()
 expect(screen.getByRole('button',{name:'导入音频'})).toBeTruthy()
 expect(screen.getByRole('region',{name:'录音设置'})).toBeTruthy()
 expect(audio.startCapture.mock.calls.length).toBe(starts)
 fireEvent.click(screen.getByRole('link',{name:'实时分析'}))
 fireEvent.click(screen.getByRole('link',{name:'统计分析'}))
 expect(screen.getByRole('button',{name:'开始录音'})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'返回结果'}))
 expect(screen.getByRole('heading',{name:'录音分析结果'})).toBeTruthy()
 expect(analyze).toHaveBeenCalledTimes(1)
})
