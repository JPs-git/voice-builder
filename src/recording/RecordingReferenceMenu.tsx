import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react'
import {useRecordingSession} from './RecordingSessionProvider'
import {getRecordingReference,REFERENCE_OPTIONS} from './references'
import styles from './RecordingReferenceMenu.module.css'

/** The bottom dock needs an upward menu; native select popup placement is browser-owned. */
export function RecordingReferenceMenu(){
 const {snapshot,preferences,updatePreferences}=useRecordingSession()
 const [open,setOpen]=useState(false)
 const root=useRef<HTMLDivElement>(null)
 const trigger=useRef<HTMLButtonElement>(null)
 const menu=useRef<HTMLDivElement>(null)
 const id=useId()
 const busy=['requesting','recording','paused','importing','analyzing'].includes(snapshot.phase)
 useEffect(()=>{
  if(!open)return
  menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  const outside=(event:PointerEvent)=>{
   if(!root.current?.contains(event.target as Node))setOpen(false)
  }
  const escape=(event:globalThis.KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}
  }
  document.addEventListener('pointerdown',outside)
  document.addEventListener('keydown',escape)
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
 },[open])
 const navigate=(event:KeyboardEvent)=>{
  const items=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')??[])
  const current=items.indexOf(document.activeElement as HTMLButtonElement)
  const next=event.key==='ArrowDown'?(current+1)%items.length:event.key==='ArrowUp'?(current-1+items.length)%items.length:
   event.key==='Home'?0:event.key==='End'?items.length-1:null
  if(next!==null){event.preventDefault();items[next]?.focus()}
 }
 return <div ref={root} className={styles.wrap} onBlur={event=>{
  if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false)
 }}>
  <button ref={trigger} type="button" className={styles.trigger} aria-label="参考内容" disabled={busy}
   aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined}
   onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true)}}}
   onClick={()=>setOpen(value=>!value)}>
   <span>{getRecordingReference(preferences.referenceId).label}</span><span aria-hidden="true">⌃</span>
  </button>
  {open&&!busy&&<div ref={menu} id={id} role="menu" aria-label="参考内容" data-placement="top" className={styles.menu} onKeyDown={navigate}>
    {REFERENCE_OPTIONS.map(reference=><button key={reference.id} type="button"
     role="menuitemradio" aria-checked={reference.id===preferences.referenceId} tabIndex={-1} className={styles.option}
     onClick={()=>{updatePreferences({referenceId:reference.id,promptVisible:true});setOpen(false);trigger.current?.focus()}}>
     <span>{reference.label}</span><span aria-hidden="true">{reference.id===preferences.referenceId?'✓':''}</span>
    </button>)}
  </div>}
 </div>
}
