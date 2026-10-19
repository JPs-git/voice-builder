import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore,useCallback} from 'react'
import type {ReactNode} from 'react'
import {getAudioEngine} from '../ts'
import {RecordingSessionController} from './sessionController'
import {runClipAnalysis} from './workerClient'
import {importRecordingFile} from './importClip'

export interface RecordingPreferences {
 referenceId:string;fontSize:number;promptVisible:boolean
}
const Context=createContext<{controller:RecordingSessionController;preferences:RecordingPreferences;
 updatePreferences:(patch:Partial<RecordingPreferences>)=>void}|null>(null)
export function RecordingSessionProvider({children,controller:provided}:{children:ReactNode;controller?:RecordingSessionController}){
 const [controller]=useState(()=>provided??new RecordingSessionController({
  engine:getAudioEngine(),analyze:runClipAnalysis,importClip:importRecordingFile,now:()=>new Date(),
 }))
 const lifecycle=useRef(0)
 const [preferences,setPreferences]=useState<RecordingPreferences>({
  referenceId:'after-rain-v1',fontSize:22,promptVisible:true,
 })
 const updatePreferences=useCallback((patch:Partial<RecordingPreferences>)=>setPreferences(old=>({...old,...patch})),[])
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
