import type {EChartsOption} from 'echarts'
import type {PitchSummary} from './types'
import {STATISTICS_F0_RANGE} from './constants'
export function buildDistributionOption(summary:PitchSummary,showPercentiles=true):EChartsOption{
 const bins=Array.from({length:(STATISTICS_F0_RANGE.max-STATISTICS_F0_RANGE.min)/10},(_,index)=>{
  const from=STATISTICS_F0_RANGE.min+index*10
  return summary.histogram.find(bin=>bin.from===from)??{from,to:from+10,count:0,proportion:0}
 })
 const marks=new Map<number,string[]>()
 for(const [name,value] of [['中位数',summary.median],['P10',summary.p10],['P90',summary.p90]] as const){
  if(value!=null)marks.set(value,[...(marks.get(value)??[]),name])
 }
 return {animation:false,grid:{left:56,right:20,top:40,bottom:52},
  tooltip:{trigger:'item',formatter:params=>{
   const point=(Array.isArray(params)?params[0]:params) as {dataIndex:number}
   const bin=bins[point.dataIndex]
   return bin?`${bin.from}–${bin.to} Hz：${(bin.proportion*100).toFixed(1)}%`:''
  }},
  xAxis:{type:'value',name:'F0（Hz）',nameLocation:'middle',nameGap:30,
   min:STATISTICS_F0_RANGE.min,max:STATISTICS_F0_RANGE.max,splitLine:{show:false}},
  yAxis:{type:'value',name:'有效时间（%）',splitLine:{lineStyle:{color:'#eef1f5'}}},
  series:[{type:'bar',data:bins.map(b=>[(b.from+b.to)/2,b.proportion*100]),barMaxWidth:30,itemStyle:{color:'#f27f91',borderRadius:[3,3,0,0]},
   markArea:!showPercentiles||summary.p10==null?undefined:{silent:true,itemStyle:{color:'rgba(226,62,87,.07)'},data:[[{xAxis:summary.p10},{xAxis:summary.p90!}]]},
   markLine:!showPercentiles?undefined:{silent:true,symbol:'none',lineStyle:{color:'#475467'},label:{formatter:'{b}'},data:
    [...marks].map(([xAxis,names])=>({xAxis,name:names.join(' / ')}))}}],
 }
}
