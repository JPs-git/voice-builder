import {it,expect,vi,afterEach} from 'vitest'
import {RecordingPlaybackController} from '../recording/playbackController'
import type {AudioClip} from '../recording/types'
afterEach(()=>vi.unstubAllGlobals())
const clip={samples:new Float32Array(480000),sampleRate:48000,duration:10,source:'file',name:'test',mode:null,material:null,prompt:null} as AudioClip
function setup(){
 vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn())
 const nodes:any[]=[],context={currentTime:0}
 const engine={audioContext:context,createPlaybackSource:vi.fn(()=>{
  const source={start:vi.fn(),stop:vi.fn(),onended:null};nodes.push(source)
  return {source,totalDuration:10}
 })}
 const controller=new RecordingPlaybackController(()=>engine as any);controller.setClip(clip)
 return {controller,engine,nodes,context}
}
it('seeks without playing and resumes from a paused original-rate clip',()=>{
 const s=setup();s.controller.seek(3)
 expect(s.engine.createPlaybackSource).not.toHaveBeenCalled()
 s.controller.play();expect(s.nodes[0].start).toHaveBeenCalledWith(0,3,7)
 expect(s.engine.createPlaybackSource).toHaveBeenCalledWith(clip.samples,48000)
 s.context.currentTime=2;s.controller.pause()
 expect(s.controller.getSnapshot().position).toBe(5)
 s.controller.play();expect(s.nodes[1].start).toHaveBeenCalledWith(0,5,5)
 s.controller.destroy()
})
it('plays the complete clip, seeks to the end, replays and ignores stale ended handlers',()=>{
 const s=setup();s.controller.play()
 expect(s.nodes[0].start).toHaveBeenCalledWith(0,0,10)
 const old=s.nodes[0].onended
 s.controller.seek(7)
 expect(s.nodes[1].start).toHaveBeenCalledWith(0,7,3)
 old?.();expect(s.controller.getSnapshot().playing).toBe(true)
 s.nodes[1].onended?.();expect(s.controller.getSnapshot().position).toBe(10)
 s.controller.play();expect(s.nodes[2].start).toHaveBeenCalledWith(0,0,10)
 s.controller.stop();expect(s.controller.getSnapshot().playing).toBe(false)
 expect(s.nodes[2].stop).toHaveBeenCalled()
 s.controller.destroy()
})

