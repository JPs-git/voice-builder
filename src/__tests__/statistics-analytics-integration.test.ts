import {it,expect,vi,afterEach} from 'vitest'
import type {ClipAnalysis} from '../recording/types'
vi.mock('@vercel/analytics',()=>({inject:vi.fn()}))
afterEach(()=>{
 vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks()
 document.head.querySelectorAll('script[data-website-id]').forEach(el=>el.remove())
 delete window.umami;delete window.voiceBuilderAnalyticsBeforeSend
 localStorage.clear()
})
it('keeps background analysis on the recording URL through the real guarded transport and opt-out does not stop audio',async()=>{
 vi.resetModules();localStorage.clear()
 vi.stubEnv('PROD',true);vi.stubEnv('VITE_ANALYTICS_ENABLED','true')
 vi.stubEnv('VITE_VERCEL_ANALYTICS_ENABLED','false')
 vi.stubEnv('VITE_UMAMI_WEBSITE_ID','94db1cb1-74f4-4a40-ad6c-962362670409')
 vi.stubEnv('VITE_UMAMI_DOMAINS','voice.starbow.top')
 vi.stubGlobal('location',new URL('https://voice.starbow.top/recording'))
 vi.stubGlobal('navigator',{doNotTrack:null})
 const a=await import('../analytics/analytics');a.initAnalytics()
 const sent:any[]=[]
 window.umami={track:vi.fn(input=>{
  const payload=typeof input==='function'?input({url:location.href}):input
  const safe=window.voiceBuilderAnalyticsBeforeSend!('event',payload)
  if(safe)sent.push(safe)
 })}
 document.querySelector('script[data-website-id]')!.dispatchEvent(new Event('load'))
 const {RecordingSessionController}=await import('../recording/sessionController')
 let feed!:(data:Float32Array,rate:number)=>void,resolve!:(value:ClipAnalysis)=>void
 const engine={startCapture:vi.fn(async(cb:any)=>{feed=cb}),stopCapture:vi.fn()}
 const controller=new RecordingSessionController({engine,analyze:()=>new Promise(r=>{resolve=r}),importClip:vi.fn(),now:()=>new Date()})
 await controller.start({mode:'reading',material:null,prompt:null})
 feed(new Float32Array(30*16000),16000);controller.pause();controller.finish()
 vi.stubGlobal('location',new URL('https://voice.starbow.top/practice'))
 resolve({} as ClipAnalysis);await Promise.resolve();await Promise.resolve()
 expect(sent.map(p=>p.name)).toEqual(['record_start','practice_engaged','recording_pause','recording_complete','recording_analysis','recording_analysis'])
 expect(sent.every(p=>p.url==='/recording'&&p.data.page==='recording')).toBe(true)
 expect(sent[sent.length-1].data).toEqual({page:'recording',stage:'success',source:'mic',attempt:'initial'})
 vi.stubGlobal('location',new URL('https://voice.starbow.top/recording'))
 await controller.start({mode:'reading',material:null,prompt:null})
 const before=sent.length,stops=engine.stopCapture.mock.calls.length
 a.setAnalyticsDisabled(true);feed(new Float32Array(16000),16000)
 expect(controller.getSnapshot().phase).toBe('recording')
 expect(engine.stopCapture).toHaveBeenCalledTimes(stops)
 controller.pause();controller.finish();resolve({} as ClipAnalysis);await Promise.resolve();await Promise.resolve()
 expect(controller.getSnapshot().completedRecordId).toBeTruthy()
 expect(sent).toHaveLength(before)
 controller.destroy()
})
