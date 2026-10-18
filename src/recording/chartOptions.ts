import type {EChartsOption,LineSeriesOption} from 'echarts'
import type {PitchFrame,PitchSummary} from './types'
const grid={left:58,right:24,top:40,bottom:64}
export function buildPitchOption(frames:PitchFrame[],summary:PitchSummary,duration:number,position:number):EChartsOption {
 const minimum=summary.minimum??60,maximum=summary.maximum??400
 const padding=Math.max(20,(maximum-minimum)*.1)
 const markers:NonNullable<NonNullable<LineSeriesOption['markPoint']>['data']>=[]
 if(summary.minimum!=null&&summary.minTime!=null)markers.push({name:'最低',coord:[summary.minTime,summary.minimum],value:Math.round(summary.minimum),symbol:'circle',symbolSize:8})
 if(summary.maximum!=null&&summary.maxTime!=null)markers.push({name:'最高',coord:[summary.maxTime,summary.maximum],value:Math.round(summary.maximum),symbol:'diamond',symbolSize:10})
 const lines:NonNullable<NonNullable<LineSeriesOption['markLine']>['data']>=[]
 if(summary.median!=null)lines.push({yAxis:summary.median,name:'典型 F0',lineStyle:{color:'#98a2b3',type:'dashed'},label:{formatter:'典型 F0'}})
 if(position>0)lines.push({xAxis:position,lineStyle:{color:'#e23e57'},label:{show:false}})
 return {animation:false,grid,tooltip:{trigger:'axis',valueFormatter:value=>value==null?'—':Number(value).toFixed(0)+' Hz'},
  xAxis:{type:'value',min:0,max:duration,name:'时间（秒）',nameLocation:'middle',nameGap:32,splitLine:{show:false}},
  yAxis:{type:'value',min:Math.max(0,Math.floor((minimum-padding)/10)*10),max:Math.ceil((maximum+padding)/10)*10,name:'F0（Hz）',axisLabel:{formatter:'{value}'},splitLine:{lineStyle:{color:'#eef1f5'}}},
  dataZoom:[{type:'inside',filterMode:'none'},{type:'slider',height:14,bottom:6,filterMode:'none'}],
  series:[{type:'line',name:'F0',data:frames.map(f=>[f.time,f.f0]),showSymbol:false,connectNulls:false,
   lineStyle:{color:'#e23e57',width:2},itemStyle:{color:'#e23e57'},
   markPoint:{data:markers,label:{show:false}},
   markLine:{symbol:'none',silent:true,data:lines}}],
 }
}
export function buildDistributionOption(summary:PitchSummary):EChartsOption{
 const bins=summary.histogram
 return {animation:false,grid:{left:56,right:20,top:40,bottom:52},
  tooltip:{trigger:'axis',valueFormatter:value=>Number(value).toFixed(1)+'%'},
  xAxis:{type:'value',name:'F0（Hz）',nameLocation:'middle',nameGap:30,
   min:Math.max(0,(bins[0]?.from??60)-10),max:(bins[bins.length-1]?.to??400)+10,splitLine:{show:false}},
  yAxis:{type:'value',name:'有效时间（%）',splitLine:{lineStyle:{color:'#eef1f5'}}},
  series:[{type:'bar',data:bins.map(b=>[(b.from+b.to)/2,b.proportion*100]),barMaxWidth:30,itemStyle:{color:'#f27f91',borderRadius:[3,3,0,0]},
   markArea:summary.p10==null?undefined:{silent:true,itemStyle:{color:'rgba(226,62,87,.07)'},data:[[{xAxis:summary.p10},{xAxis:summary.p90!}]]},
   markLine:summary.median==null?undefined:{silent:true,symbol:'none',lineStyle:{color:'#475467'},label:{formatter:'中位数'},data:[{xAxis:summary.median}]}}],
 }
}
