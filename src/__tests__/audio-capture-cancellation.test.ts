import {it,expect,vi,afterEach} from 'vitest'
import {AudioEngine} from '../ts/AudioEngine'
afterEach(()=>vi.unstubAllGlobals())
function context(){
 const processor={connect:vi.fn(),disconnect:vi.fn(),onaudioprocess:null}
 return {resume:vi.fn().mockResolvedValue(undefined),close:vi.fn(),destination:{},
 createMediaStreamSource:()=>({connect:vi.fn(),disconnect:vi.fn()}),createScriptProcessor:()=>processor,
 createGain:()=>({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()}),
 createBuffer:vi.fn((_c:number,n:number,rate:number)=>({getChannelData:()=>new Float32Array(n),sampleRate:rate})),
 createBufferSource:()=>({connect:vi.fn(),start:vi.fn(),stop:vi.fn()})}
}
function deferred(){let resolve!:(stream:MediaStream)=>void;const promise=new Promise<MediaStream>(r=>{resolve=r});return {resolve,promise}}
function stream(){const stop=vi.fn();return {value:{getTracks:()=>[{stop}]} as unknown as MediaStream,stop}}
it('stops a permission stream that arrives after stopCapture',async()=>{
 const pending=deferred(),ctx=context(),s=stream()
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:()=>pending.promise}})
 vi.stubGlobal('AudioContext',vi.fn(function(){return ctx}))
 const engine=new AudioEngine();const start=engine.startCapture(()=>{})
 engine.stopCapture();pending.resolve(s.value)
 await expect(start).rejects.toMatchObject({name:'AbortError'})
 expect(s.stop).toHaveBeenCalled();expect(engine.isCapturing).toBe(false)
})
it('does not let an old permission result stop a newer recording',async()=>{
 const old=deferred(),fresh=deferred(),s1=stream(),s2=stream(),ctx=context()
 const get=vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:get}})
 vi.stubGlobal('AudioContext',vi.fn(function(){return ctx}))
 const engine=new AudioEngine(),abort=new AbortController()
 const first=engine.startCapture(()=>{},abort.signal);abort.abort()
 const second=engine.startCapture(()=>{});fresh.resolve(s2.value);await second
 old.resolve(s1.value);await expect(first).rejects.toMatchObject({name:'AbortError'})
 expect(s1.stop).toHaveBeenCalled();expect(s2.stop).not.toHaveBeenCalled();expect(engine.isCapturing).toBe(true)
 engine.stopCapture()
})
it('creates playback at the actual clip sample rate',()=>{
 const ctx=context();vi.stubGlobal('AudioContext',vi.fn(function(){return ctx}))
 const result=new AudioEngine().createPlaybackSource(new Float32Array(48000),48000)
 expect(result.totalDuration).toBe(1)
 expect(ctx.createBuffer).toHaveBeenCalledWith(1,48000,48000)
})
it('releases capture on track termination and ignores stale track events',async()=>{
 const ctx=context(),tracks=[new EventTarget(),new EventTarget()] as any[]
 for(const track of tracks)track.stop=vi.fn()
 const get=vi.fn().mockResolvedValueOnce({getTracks:()=>[tracks[0]]}).mockResolvedValueOnce({getTracks:()=>[tracks[1]]})
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:get}})
 vi.stubGlobal('AudioContext',vi.fn(function(){return ctx}))
 const engine=new AudioEngine(),interrupted=vi.fn()
 await engine.startCapture(()=>{},undefined,interrupted)
 tracks[0].dispatchEvent(new Event('ended'))
 expect(engine.isCapturing).toBe(false);expect(interrupted).toHaveBeenCalledTimes(1)
 expect(tracks[0].stop).toHaveBeenCalled()
 await engine.startCapture(()=>{},undefined,interrupted)
 tracks[0].dispatchEvent(new Event('ended'))
 expect(engine.isCapturing).toBe(true);expect(interrupted).toHaveBeenCalledTimes(1)
 engine.stopCapture()
})

