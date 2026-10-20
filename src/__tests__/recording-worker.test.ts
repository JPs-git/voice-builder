import {it,expect,vi,afterEach} from 'vitest'
import {runClipAnalysis} from '../recording/workerClient'
import type {AudioClip} from '../recording/types'
class FakeWorker {
 static last:FakeWorker
 onmessage:((e:{data:any})=>void)|null=null
 onerror:((e:{message:string})=>void)|null=null
 request:any; terminated=false
 constructor(){FakeWorker.last=this}
 postMessage(data:any){this.request=data}
 terminate(){this.terminated=true}
}
afterEach(()=>vi.unstubAllGlobals())
const clip={samples:new Float32Array([.1,.2]),sampleRate:16000,duration:.000125,source:'mic',name:'test',mode:'free',material:null,prompt:null} as AudioClip
it('keeps playback PCM owned by the session and ignores unrelated worker messages',async()=>{
 vi.stubGlobal('Worker',FakeWorker)
 const abort=new AbortController(), progress=vi.fn()
 const result=runClipAnalysis(clip,{signal:abort.signal,onProgress:progress})
 const worker=FakeWorker.last
 expect(worker.request.samples).not.toBe(clip.samples)
 worker.onmessage?.({data:{id:worker.request.id+1,type:'result',analysis:{wrong:true}}})
 worker.onmessage?.({data:{id:worker.request.id,type:'progress',progress:.5}})
 worker.onmessage?.({data:{id:worker.request.id,type:'result',analysis:{version:'ok'}}})
 expect(await result).toEqual({version:'ok'});expect(progress).toHaveBeenCalledWith(.5)
 expect(worker.terminated).toBe(true);expect(clip.samples.length).toBe(2)
})
it('terminates work and rejects cancellation without committing a late response',async()=>{
 vi.stubGlobal('Worker',FakeWorker)
 const abort=new AbortController()
 const result=runClipAnalysis(clip,{signal:abort.signal,onProgress:()=>{}})
 abort.abort()
 await expect(result).rejects.toMatchObject({name:'AbortError'})
 expect(FakeWorker.last.terminated).toBe(true)
})
