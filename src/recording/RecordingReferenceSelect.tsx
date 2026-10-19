import {useRecordingSession} from './RecordingSessionProvider'
import {REFERENCE_OPTIONS} from './references'

export function RecordingReferenceSelect({className}:{className?:string}){
 const {snapshot,preferences,updatePreferences}=useRecordingSession()
 const busy=['requesting','recording','importing','analyzing'].includes(snapshot.phase)
 return <select id="recording-reference" aria-label="参考内容" className={className} disabled={busy}
  value={preferences.referenceId} onChange={e=>updatePreferences({referenceId:e.target.value,promptVisible:true})}>
  <option value="none">无参考内容</option>
  {(['material','prompt'] as const).map(kind=><optgroup key={kind} label={kind==='material'?'短文':'话题提示'}>
   {REFERENCE_OPTIONS.filter(reference=>reference.kind===kind).map(reference=><option key={reference.id} value={reference.id}>{reference.label}</option>)}
  </optgroup>)}
 </select>
}
