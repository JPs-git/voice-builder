import styles from './RecordingControlIcon.module.css'

export type RecordingIconKind='mic'|'pause'|'play'|'loading'|'cancel'|'finish'|'import'|'report'|'back'|'retry'

/** The same optically centered recording glyphs serve Toolbar and RecordDock. */
export function RecordingControlIcon({kind,size=16}:{kind:RecordingIconKind;size?:number}){
 return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
  className={kind==='loading'?styles.spinner:undefined}>
  {kind==='mic'?<><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" stroke="none"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6"/></>:
   kind==='pause'?<><rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none"/></>:
   kind==='play'?<path d="M8.5 5 19 12 8.5 19Z" fill="currentColor" stroke="none"/>:
   kind==='loading'?<path d="M12 3a9 9 0 1 1-9 9h3a6 6 0 1 0 6-6Z" fill="currentColor" stroke="none"/>:
   kind==='cancel'?<path d="m6 6 12 12M18 6 6 18"/>:
   kind==='finish'?<path d="m5 12 4 4L19 6"/>:
   kind==='import'?<path d="M3 6h7l2 2h9v12H3ZM3 6V4h7l2 2"/>:
   kind==='report'?<><path d="M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h8"/></>:
   kind==='back'?<path d="m10 5-7 7 7 7M3 12h18"/>:
   <path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>}
 </svg>
}
