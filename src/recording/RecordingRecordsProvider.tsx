import {createContext,useContext,useState,useEffect,useRef,useSyncExternalStore,type ReactNode} from 'react'
import {RecordingRecordStore} from './recordStore'
const Context=createContext<RecordingRecordStore|null>(null)
export function RecordingRecordsProvider({children,store}:{children:ReactNode;store?:RecordingRecordStore}){
 const [records]=useState(()=>store??new RecordingRecordStore())
 const lifecycle=useRef(0)
 useEffect(()=>{const generation=++lifecycle.current;return()=>{queueMicrotask(()=>{if(lifecycle.current===generation)records.destroy()})}},[records])
 return <Context.Provider value={records}>{children}</Context.Provider>
}
export function useRecordingRecords(){
 const records=useContext(Context)
 if(!records)throw new Error('RecordingRecordsProvider is required')
 const latest=useSyncExternalStore(records.subscribe,records.getSnapshot,records.getSnapshot)
 return {records,latest}
}
