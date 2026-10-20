import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore,useCallback} from 'react'
import type {ReactNode} from 'react'
import {getAudioEngine} from '../ts'
import {RecordingSessionController} from './sessionController'
import {runClipAnalysis} from './workerClient'
import {importRecordingFile} from './importClip'
import {RecordingRecordsProvider,useRecordingRecords} from './RecordingRecordsProvider'
import type {RecordingRecordStore} from './recordStore'
import {getRecordingReference} from './references'

export interface RecordingPreferences {
 referenceId:string;fontSize:number|null;promptVisible:boolean
}
const Context=createContext<{controller:RecordingSessionController;preferences:RecordingPreferences;
 updatePreferences:(patch:Partial<RecordingPreferences>)=>void}|null>(null)
interface ProviderProps {children:ReactNode;controller?:RecordingSessionController;records?:RecordingRecordStore}
export function RecordingSessionProvider({children,controller,records}:ProviderProps){
 return <RecordingRecordsProvider store={records??controller?.recordStore}><RecordingTaskProvider controller={controller}>{children}</RecordingTaskProvider></RecordingRecordsProvider>
}
function RecordingTaskProvider({children,controller:provided}:ProviderProps){
 const {records}=useRecordingRecords()
 const [controller]=useState(()=>provided??new RecordingSessionController({
  engine:getAudioEngine(),analyze:runClipAnalysis,importClip:importRecordingFile,now:()=>new Date(),
 },records))
 const lifecycle=useRef(0)
 const [preferences,setPreferences]=useState<RecordingPreferences>({
  referenceId:'after-rain-v1',fontSize:null,promptVisible:true,
 })
 const updatePreferences=useCallback((patch:Partial<RecordingPreferences>)=>{
  if(patch.referenceId){
   const {material}=getRecordingReference(patch.referenceId)
   controller.reference(material?{id:material.id,version:material.version,title:material.title,source:material.source}:null)
  }
  setPreferences(old=>({...old,...patch}))
 },[controller])
 useEffect(()=>{
  const generation=++lifecycle.current
  return()=>{queueMicrotask(()=>{if(lifecycle.current===generation)controller.destroy()})}
 },[controller])
 return <Context.Provider value={{controller,preferences,updatePreferences}}>{children}</Context.Provider>
}
export function useRecordingSession(){
 const value=useContext(Context)
 if(!value)throw new Error('RecordingSessionProvider is required')
 const {controller}=value
 const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
 return {...value,snapshot}
}
