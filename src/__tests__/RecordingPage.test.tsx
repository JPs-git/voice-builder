import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {RecordingPage} from '../recording/RecordingPage'
import {RecordingSessionProvider} from '../recording/RecordingSessionProvider'
import {RecordingSessionController} from '../recording/sessionController'
vi.mock('../hooks/useECharts',()=>({useECharts:()=>({chartRef:{current:null},getInstance:()=>null,setOption:()=>{}})}))
afterEach(cleanup)
it('shows readable material and keeps every capture state free of acoustic feedback',async()=>{
 let chunk!:(samples:Float32Array,rate:number)=>void
 const analyze=vi.fn()
 const controller=new RecordingSessionController({engine:{startCapture:async cb=>{chunk=cb},stopCapture:()=>{}},
 analyze,importClip:vi.fn(),now:()=>new Date()})
 const {container}=render(<RecordingSessionProvider controller={controller}><RecordingPage/></RecordingSessionProvider>)
 expect(screen.getByRole('heading',{name:'雨后的街道'})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'增大字号'}))
 expect(screen.getByTestId('reading-body').style.fontSize).toBe('24px')
 await act(async()=>controller.start({mode:'reading',material:null,prompt:null}))
 act(()=>chunk(new Float32Array(16000),16000))
 expect(container.querySelector('[data-acoustic-chart]')).toBeNull()
 expect(container.textContent).not.toMatch(/Hz|F0|波形|电平|评分/)
 expect(screen.getByLabelText('阅读材料').hasAttribute('disabled')).toBe(true)
 expect(analyze).not.toHaveBeenCalled()
 act(()=>controller.cancel())
})
it('allows free speaking with a collapsible non-acoustic topic',()=>{
 const {container}=render(<RecordingSessionProvider><RecordingPage/></RecordingSessionProvider>)
 fireEvent.click(screen.getByRole('button',{name:'自由说话'}))
 expect(screen.getByText('讲讲今天发生的一件事')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'收起提示'}))
 expect(screen.queryByText('讲讲今天发生的一件事')).toBeNull()
 expect(container.textContent).not.toMatch(/Hz|F0/)
})
