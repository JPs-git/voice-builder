import {useRecordingSession} from './RecordingSessionProvider'
import {REFERENCE_OPTIONS} from './references'

export function RecordingReferenceSelect({className}:{className?:string}){
 const {snapshot,preferences,updatePreferences}=useRecordingSession()
 const busy=['importing','analyzing'].includes(snapshot.phase)
 return <select id="recording-reference" aria-label="参考内容" className={className} disabled={busy}
  value={preferences.referenceId} onChange={e=>updatePreferences({referenceId:e.target.value,promptVisible:true})}>
  {REFERENCE_OPTIONS.map(reference=><option key={reference.id} value={reference.id}>{reference.label}</option>)}
 </select>
}
