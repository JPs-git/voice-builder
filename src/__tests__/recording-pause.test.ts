import {it,expect,vi} from 'vitest'
import {RecordingSessionController} from '../recording/sessionController'
import {analyzeClip} from '../recording/analyzeClip'
const options={mode:'reading' as const,material:{id:'a',title:'A',source:'原创',version:1},prompt:null}
function setup(){
 const feeds:Array<(s:Float32Array,r:number)=>void>=[]
 const engine={startCapture:vi.fn(async cb=>{feeds.push(cb)}),stopCapture:vi.fn()}
 const analyze=vi.fn(async(_clip:unknown)=>analyzeClip(new Float32Array(160),16000))
 const controller=new RecordingSessionController({engine,analyze,importClip:vi.fn(),now:()=>new Date()})
 return {controller,engine,analyze,feeds}
}
it('pauses, ignores stale chunks and resumes the same PCM without gaps before explicit completion',async()=>{
 const s=setup();await s.controller.start(options)
 s.feeds[0](new Float32Array(16000).fill(.1),16000)
 s.controller.finish();expect(s.analyze).not.toHaveBeenCalled()
 s.controller.pause();expect(s.controller.getSnapshot()).toMatchObject({phase:'paused',elapsed:1})
 s.feeds[0](new Float32Array(16000),16000)
 await s.controller.resume()
 s.feeds[0](new Float32Array(16000),16000)
 s.feeds[1](new Float32Array(8000).fill(.2),16000)
 s.controller.leave();expect(s.controller.getSnapshot()).toMatchObject({phase:'paused',elapsed:1.5})
 expect(s.analyze).not.toHaveBeenCalled()
 s.controller.finish();s.controller.finish();await Promise.resolve()
 const clip=s.analyze.mock.calls[0]?.[0] as any
 expect(s.analyze).toHaveBeenCalledTimes(1)
 expect(clip.samples.length).toBe(24000)
 expect(clip.samples[15999]).toBeCloseTo(.1);expect(clip.samples[16000]).toBeCloseTo(.2)
 s.controller.destroy()
})
it('pauses exactly at 60 seconds and waits for completion',async()=>{
 const s=setup();await s.controller.start(options);s.feeds[0](new Float32Array(960010),16000)
 expect(s.controller.getSnapshot()).toMatchObject({phase:'paused',elapsed:60,atLimit:true})
 expect(s.analyze).not.toHaveBeenCalled();await s.controller.resume()
 expect(s.engine.startCapture).toHaveBeenCalledTimes(1)
 s.controller.finish();await Promise.resolve();expect(s.analyze).toHaveBeenCalledTimes(1)
 s.controller.destroy()
})
it('retains paused PCM after resume permission and sampling-rate failures',async()=>{
 const s=setup();await s.controller.start(options);s.feeds[0](new Float32Array(16000),16000);s.controller.pause()
 s.engine.startCapture.mockRejectedValueOnce(new Error('denied'))
 await s.controller.resume();expect(s.controller.getSnapshot()).toMatchObject({phase:'paused',elapsed:1})
 await s.controller.resume();s.feeds[1](new Float32Array(48000),48000)
 expect(s.controller.getSnapshot()).toMatchObject({phase:'paused',elapsed:1})
 s.controller.finish();await Promise.resolve();expect(s.analyze).toHaveBeenCalledTimes(1)
 s.controller.destroy()
})
