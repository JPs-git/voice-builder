import {it,expect} from 'vitest'
import {buildDistributionOption} from '../recording/chartOptions'
import {summarizePitch} from '../recording/statistics'
import type {PitchFrame} from '../recording/types'
it('uses a fixed 60–500 histogram with percentile marks and frequency-bin tooltips',()=>{
 const frames:PitchFrame[]=[200,null,800,500].map((f,i)=>({start:i*.01,time:i*.01+.025,duration:.01,rawF0:f,f0:f,voiced:f!==null,exclusion:null}))
 const data=summarizePitch(frames,1)
 const option=buildDistributionOption(data.summary) as any
 expect(option.xAxis).toMatchObject({min:60,max:500})
 expect(option.series).toHaveLength(1)
 expect(option.series[0].type).toBe('bar')
 expect(option.series[0].data).toHaveLength(44)
 expect(option.series[0].data.filter((point:number[])=>point[1]>0)).toEqual([[205,50],[495,50]])
 expect(option.series[0].markLine.data.map((line:any)=>line.name)).toEqual(['中位数','P10','P90'])
 expect(option.tooltip.formatter({dataIndex:43})).toBe('490–500 Hz：50.0%')
 const limited=buildDistributionOption(data.summary,false) as any
 expect(limited.series[0].markLine).toBeUndefined()
 expect(limited.series[0].markArea).toBeUndefined()
})
