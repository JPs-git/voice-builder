export function formatClock(seconds:number){
 const total=Math.max(0,Math.floor(seconds))
 return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')
}
export const formatHz=(value:number|null)=>value==null?'—':Math.round(value).toLocaleString('zh-CN')
