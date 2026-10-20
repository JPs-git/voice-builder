import {it,expect,vi,afterEach} from 'vitest'
import {RecordingSessionController} from '../recording/sessionController'
import {RecordingImportError,RecordingAnalysisError} from '../recording/errors'
import {durationBucket} from '../recording/analytics'
import type {AudioClip,ClipAnalysis} from '../recording/types'
const {emit,samples}=vi.hoisted(()=>({emit:vi.fn(),samples:vi.fn()}))
vi.mock('../analytics/analytics',()=>({trackRecordingTask:emit}))
vi.mock('../analytics/practiceProgress',()=>({recordPracticeSamples:samples}))
afterEach(()=>{vi.clearAllMocks();vi.useRealTimers()})
const options={mode:'reading' as const,material:null,prompt:null}
const result={} as ClipAnalysis
const clip={source:'file',samples:new Float32Array(16000),sampleRate:16000,duration:1,name:'private.wav',material:null,mode:null,prompt:null} as AudioClip
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
function setup(){
 let chunk!:(data:Float32Array,rate:number)=>void
 const engine={startCapture:vi.fn(async(cb:any)=>{chunk=cb}),stopCapture:vi.fn()}
 const analyze=vi.fn(async()=>result),importClip=vi.fn(async()=>clip)
 const controller=new RecordingSessionController({engine,analyze,importClip,now:()=>new Date()})
 return {controller,engine,analyze,importClip,feed:(n=16000)=>chunk(new Float32Array(n),16000)}
}
it('counts real capture transitions, samples and one completion with no audio payload',async()=>{
 const s=setup();await s.controller.start(options);s.feed();s.controller.pause();s.controller.pause()
 await s.controller.resume();s.feed();s.controller.pause();s.controller.finish();s.controller.finish();await settle()
 expect(emit.mock.calls).toEqual([
  ['record_start',{action:'new'}],['recording_pause',{reason:'user'}],
  ['record_start',{action:'resume'}],['recording_pause',{reason:'user'}],
  ['recording_complete',{duration_bucket:'under_10s',at_limit:'no'}],
  ['recording_analysis',{stage:'start',source:'mic',attempt:'initial',duration_bucket:'under_10s'}],
  ['recording_analysis',{stage:'success',source:'mic',attempt:'initial'}],
 ])
 expect(samples.mock.calls).toEqual([[16000,16000],[16000,16000]])
 s.controller.destroy();expect(emit).toHaveBeenCalledTimes(7)
})
it('handles chunks before the start Promise and a single automatic limit pause',async()=>{
 const s=setup();s.engine.startCapture.mockImplementation(async(cb:any)=>cb(new Float32Array(960010),16000))
 await s.controller.start(options);s.controller.pause();await s.controller.resume()
 expect(emit.mock.calls).toEqual([['record_start',{action:'new'}],['recording_pause',{reason:'limit'}]])
 expect(samples).toHaveBeenCalledWith(960000,16000)
 s.controller.finish();await settle()
 expect(emit).toHaveBeenCalledWith('recording_complete',{duration_bucket:'at_limit',at_limit:'yes'})
 s.controller.destroy()
})
it('does not report cancelled permission as a startup error or a late start',async()=>{
 const s=setup();let done!:()=>void
 s.engine.startCapture.mockImplementation(()=>new Promise<void>(r=>{done=r}))
 const pending=s.controller.start(options);s.controller.leave();done();await pending
 expect(emit).not.toHaveBeenCalled()
 s.engine.startCapture.mockRejectedValueOnce(new DOMException('private','NotAllowedError'))
 await s.controller.start(options)
 expect(emit.mock.calls).toEqual([['record_error',{action:'new',reason:'permission'}]])
 s.controller.destroy()
})
it('tracks navigation and interruption pauses without treating lifecycle cleanup as a cancellation',async()=>{
 vi.useFakeTimers();const s=setup();await s.controller.start(options);s.feed();s.controller.leave();s.controller.leave()
 await s.controller.resume();s.feed();await vi.advanceTimersByTimeAsync(5000)
 expect(emit.mock.calls.filter(([n])=>n==='recording_pause')).toEqual([
  ['recording_pause',{reason:'navigation'}],['recording_pause',{reason:'interruption'}],
 ])
 s.controller.destroy();expect(emit.mock.calls.some(([n])=>n==='recording_cancel')).toBe(false)
})
it('separates import preparation, analysis failure/retry, explicit cancellation and stale callbacks',async()=>{
 const s=setup();s.analyze.mockRejectedValueOnce(new Error('private worker error'))
 await s.controller.importFile({} as File)
 expect(emit.mock.calls).toEqual([
  ['audio_import',{result:'success'}],
  ['recording_analysis',{stage:'start',source:'import',attempt:'initial',duration_bucket:'under_10s'}],
  ['recording_analysis',{stage:'failure',source:'import',attempt:'initial',reason:'unknown'}],
 ])
 let done!:(v:ClipAnalysis)=>void;s.analyze.mockImplementationOnce(()=>new Promise(r=>{done=r}))
 s.controller.retry();s.controller.cancel();s.controller.cancel();done(result);await settle()
 expect(emit.mock.calls.slice(3)).toEqual([
  ['recording_analysis',{stage:'start',source:'import',attempt:'retry',duration_bucket:'under_10s'}],
  ['recording_cancel',{phase:'analyzing',target:'analysis'}],
  ['recording_analysis',{stage:'cancel',source:'import',attempt:'retry'}],
 ])
 expect(emit.mock.calls.filter(([n])=>n==='audio_import')).toHaveLength(1)
})
it('reports failed draft disposal once but does not turn import cancellation into failure',async()=>{
 const s=setup();s.analyze.mockRejectedValueOnce(new Error('private'))
 await s.controller.importFile({} as File);s.controller.prepare();s.controller.prepare()
 expect(emit).toHaveBeenCalledWith('recording_cancel',{phase:'error',target:'import'})
 let reject!:(e:Error)=>void;s.importClip.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r}))
 const pending=s.controller.importFile({} as File);s.controller.cancel();reject(new Error('private'));await pending
 expect(emit).toHaveBeenCalledWith('recording_cancel',{phase:'importing',target:'import'})
 expect(emit.mock.calls.filter(([n,d])=>n==='audio_import'&&d.result==='failure')).toHaveLength(0)
})
it('does not let a throwing statistics callback interrupt capture or analysis',async()=>{
 const s=setup();emit.mockImplementation(()=>{throw new Error('offline')})
 await s.controller.start(options);s.feed();s.controller.pause();s.controller.finish();await settle()
 expect(s.controller.getSnapshot().completedRecordId).toBeTruthy()
 s.controller.destroy();emit.mockReset()
})

it.each([[0,'under_10s'],[9.999,'under_10s'],[10,'10_to_29s'],[29.999,'10_to_29s'],[30,'30_to_59s'],[59.999,'30_to_59s'],[60,'at_limit']])('buckets %s seconds without UI rounding',(seconds,bucket)=>{
 expect(durationBucket(seconds as number)).toBe(bucket)
})
it.each(['too_long','unsupported_or_corrupt','unknown'] as const)('records %s import failure without starting analysis',async reason=>{
 const s=setup();s.importClip.mockRejectedValueOnce(new RecordingImportError('private.wav',reason))
 await s.controller.importFile({} as File)
 expect(emit.mock.calls).toEqual([['audio_import',{result:'failure',reason}]])
 expect(s.analyze).not.toHaveBeenCalled();s.controller.destroy()
})
it('maps typed processing failures and counts successful retries without another import',async()=>{
 const s=setup();s.analyze.mockRejectedValueOnce(new RecordingAnalysisError('private','processing'))
 await s.controller.importFile({} as File);s.controller.retry();await settle()
 expect(emit).toHaveBeenCalledWith('recording_analysis',{source:'import',attempt:'initial',stage:'failure',reason:'processing'})
 expect(emit).toHaveBeenCalledWith('recording_analysis',{source:'import',attempt:'retry',stage:'success'})
 expect(emit.mock.calls.filter(([n])=>n==='audio_import')).toHaveLength(1)
 s.controller.destroy()
})
it('distinguishes an explicit request cancellation from an ignored stale rejection',async()=>{
 const s=setup();let reject!:(e:Error)=>void
 s.engine.startCapture.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r}))
 const pending=s.controller.start(options);s.controller.cancel();reject(new DOMException('private','NotAllowedError'));await pending
 expect(emit.mock.calls).toEqual([['recording_cancel',{target:'capture',phase:'requesting'}]])
 s.controller.destroy()
})
