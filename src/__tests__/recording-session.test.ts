import {it,expect,vi,afterEach} from 'vitest'
import {RecordingSessionController} from '../recording/sessionController'
import type {ClipAnalysis,AudioClip} from '../recording/types'
import {analyzeClip} from '../recording/analyzeClip'
afterEach(()=>vi.useRealTimers())
function setup(){
 let chunk!:(data:Float32Array,rate:number)=>void
 const engine={startCapture:vi.fn(async cb=>{chunk=cb}),stopCapture:vi.fn()}
 const result=analyzeClip(new Float32Array(16000),16000)
 const analyze=vi.fn(async()=>result)
 const imported:AudioClip={samples:new Float32Array(16000),sampleRate:16000,duration:1,source:'file',name:'clip',mode:null,material:null,prompt:null}
 const deps={engine,analyze,importClip:vi.fn(async()=>imported),now:()=>new Date('2026-10-18T00:00:00Z')}
 const controller=new RecordingSessionController(deps)
 return {controller,engine,analyze,chunk:(data:Float32Array,rate=16000)=>chunk(data,rate),deps,result}
}
const options={mode:'free' as const,material:null,prompt:'今天'}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
it('copies complete PCM and analyzes only on finish',async()=>{
 const s=setup();await s.controller.start(options)
 expect(s.controller.getSnapshot().elapsed).toBe(0)
 const input=new Float32Array(16000).fill(.2);s.chunk(input);input.fill(0)
 expect(s.analyze).not.toHaveBeenCalled()
 expect(s.controller.getSnapshot().elapsed).toBe(1)
 s.controller.finish();await settle()
 expect(s.controller.getSnapshot().phase).toBe('ready')
 expect(s.controller.getSnapshot().report!.clip.samples[0]).toBeCloseTo(.2)
 expect(s.engine.stopCapture).toHaveBeenCalled()
})
it('clips the final input block at exactly 60 seconds and finalizes once',async()=>{
 const s=setup();await s.controller.start(options)
 s.chunk(new Float32Array(960010));s.controller.finish();await settle()
 expect(s.analyze).toHaveBeenCalledTimes(1)
 expect(s.controller.getSnapshot().report!.clip.samples.length).toBe(960000)
 expect(s.controller.getSnapshot().report!.clip.duration).toBe(60)
})
it('keeps the previous report when a new recording is cancelled or import fails',async()=>{
 const s=setup();await s.controller.importFile({} as File)
 const report=s.controller.getSnapshot().report
 await s.controller.start(options);s.chunk(new Float32Array(160));s.controller.cancel()
 expect(s.controller.getSnapshot().report).toBe(report)
 s.deps.importClip.mockRejectedValueOnce(new Error('broken'))
 await s.controller.importFile({} as File)
 expect(s.controller.getSnapshot().report).toBe(report)
 expect(s.controller.getSnapshot().error).toBeTruthy()
})
it('ignores a late analysis after cancel and preserves failed PCM for retry',async()=>{
 const s=setup();let resolve!:(a:ClipAnalysis)=>void
 s.analyze.mockImplementationOnce(()=>new Promise(r=>{resolve=r}))
 await s.controller.start(options);s.chunk(new Float32Array(16000));s.controller.finish()
 s.controller.cancel();resolve(s.result);await settle()
 expect(s.controller.getSnapshot().report).toBeNull()
 s.analyze.mockRejectedValueOnce(new Error('worker failed'))
 await s.controller.start(options);s.chunk(new Float32Array(16000));s.controller.finish();await settle()
 expect(s.controller.getSnapshot().phase).toBe('error')
 s.controller.retry();await settle()
 expect(s.controller.getSnapshot().phase).toBe('ready')
})
it('finishes on leave and cancels pending permission',async()=>{
 const s=setup();await s.controller.start(options);s.chunk(new Float32Array(16000));s.controller.leave();await settle()
 expect(s.controller.getSnapshot().phase).toBe('ready')
 let resolve!:()=>void
 s.engine.startCapture.mockImplementationOnce(()=>new Promise<void>(r=>{resolve=r}))
 const pending=s.controller.start(options);s.controller.leave();resolve();await pending
 expect(s.controller.getSnapshot().phase).toBe('ready')
})
it('stops a capture that never supplies an initial chunk after permission succeeds',async()=>{
 vi.useFakeTimers();const s=setup();await s.controller.start(options)
 await vi.advanceTimersByTimeAsync(5000)
 expect(s.controller.getSnapshot().phase).toBe('prepared')
 expect(s.controller.getSnapshot().error).toMatch(/没有收到音频/)
 expect(s.engine.stopCapture).toHaveBeenCalled()
})
it('analyzes preserved PCM on interruption and ignores stale interruption events',async()=>{
 const s=setup();const interruptions:Array<()=>void>=[]
 s.engine.startCapture.mockImplementation(async(cb:any,_signal?:any,onInterrupted?:any)=>{interruptions.push(onInterrupted)})
 await s.controller.start(options)
 interruptions[0]?.()
 expect(s.controller.getSnapshot().error).toMatch(/没有收到音频/)
 await s.controller.start(options)
 interruptions[0]?.()
 expect(s.controller.getSnapshot().phase).toBe('requesting')
 // Restore the normal audio callback while retaining the interruption callback.
 s.controller.cancel();s.engine.startCapture.mockReset()
 s.engine.startCapture.mockImplementation(async(cb:any,_signal?:any,onInterrupted?:any)=>{interruptions.push(onInterrupted);(s as any).feed=cb})
 await s.controller.start(options);(s as any).feed(new Float32Array(16000),16000)
 interruptions[interruptions.length-1]?.();await settle()
 expect(s.controller.getSnapshot().phase).toBe('ready')
 expect(s.controller.getSnapshot().report!.clip.duration).toBe(1)
})

