import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {RecordingPage} from '../recording/RecordingPage'
import {RecordingSessionProvider} from '../recording/RecordingSessionProvider'
import {RecordingSessionController} from '../recording/sessionController'
import {useRecordingToolbar} from '../recording/useRecordingToolbar'
vi.mock('../hooks/useECharts',()=>({useECharts:()=>({chartRef:{current:null},getInstance:()=>null,setOption:()=>{}})}))
afterEach(cleanup)
it('shows readable material and keeps every capture state free of acoustic feedback',async()=>{
 let chunk!:(samples:Float32Array,rate:number)=>void
 const analyze=vi.fn()
 const controller=new RecordingSessionController({engine:{startCapture:async cb=>{chunk=cb},stopCapture:()=>{}},
 analyze,importClip:vi.fn(),now:()=>new Date()})
 const {container}=render(<RecordingSessionProvider controller={controller}><RecordingPage/></RecordingSessionProvider>)
 expect(screen.getByRole('heading',{name:'雨后的街道'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:'朗读'})).toBeNull()
 expect(screen.queryByRole('button',{name:'自由说话'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'增大字号'}))
 expect(screen.getByTestId('reading-body').style.fontSize).toBe('24px')
 await act(async()=>controller.start({mode:'reading',material:null,prompt:null}))
 act(()=>chunk(new Float32Array(16000),16000))
 expect(container.querySelector('[data-acoustic-chart]')).toBeNull()
 expect(container.textContent).not.toMatch(/Hz|F0|波形|电平|评分/)
 expect(screen.getByLabelText('参考内容').hasAttribute('disabled')).toBe(true)
 expect(analyze).not.toHaveBeenCalled()
 act(()=>controller.cancel())
})
it('offers only the three reading passages',()=>{
 render(<RecordingSessionProvider><RecordingPage/></RecordingSessionProvider>)
 expect(screen.getAllByRole('option').map(option=>option.textContent)).toEqual(['雨后的街道','清晨的公园','一件小事'])
 fireEvent.change(screen.getByLabelText('参考内容'),{target:{value:'morning-park-v1'}})
 expect(screen.getByRole('heading',{name:'清晨的公园'})).toBeTruthy()
})
function Recorder(){
 const {handleClickTool}=useRecordingToolbar(()=>{},()=>{})
 return <button onClick={()=>handleClickTool('record')}>开始测试录音</button>
}
it.each([
 ['after-rain-v1','after-rain-v1',null],
 ['small-event-v1','small-event-v1',null],
 ['morning-park-v1','morning-park-v1',null],
])('snapshots reference %s when starting the same recording flow',(id,materialId,prompt)=>{
 const controller=new RecordingSessionController({engine:{startCapture:vi.fn(),stopCapture:vi.fn()},analyze:vi.fn(),importClip:vi.fn(),now:()=>new Date()})
 const start=vi.spyOn(controller,'start').mockResolvedValue(undefined)
 render(<RecordingSessionProvider controller={controller}><RecordingPage/><Recorder/></RecordingSessionProvider>)
 fireEvent.change(screen.getByLabelText('参考内容'),{target:{value:id}})
 fireEvent.click(screen.getByRole('button',{name:'开始测试录音'}))
 expect(start).toHaveBeenCalledTimes(1)
 expect(start.mock.calls[0][0].material?.id??null).toBe(materialId)
 expect(start.mock.calls[0][0].prompt).toBe(prompt)
})
