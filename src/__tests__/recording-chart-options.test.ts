import {it,expect} from 'vitest'
import {buildPitchOption,buildDistributionOption} from '../recording/chartOptions'
import {summarizePitch} from '../recording/statistics'
import type {PitchFrame} from '../recording/types'
it('preserves gaps and visible extrema above the realtime chart ceiling',()=>{
 const frames:PitchFrame[]=[200,null,800].map((f,i)=>({start:i*.01,time:i*.01+.025,duration:.01,rawF0:f,f0:f,voiced:f!==null,exclusion:null}))
 const data=summarizePitch(frames,1)
 const option=buildPitchOption(data.frames,data.summary,1,0) as any
 expect(option.yAxis.max).toBeGreaterThan(800)
 expect(option.series[0].connectNulls).toBe(false)
 expect(option.series[0].data[1][1]).toBeNull()
 expect(option.xAxis.max).toBe(1)
 const distribution=buildDistributionOption(data.summary) as any
 expect(distribution.xAxis.name).toContain('Hz')
})
