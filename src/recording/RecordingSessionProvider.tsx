import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore} from 'react'
import type {ReactNode} from 'react'
import {getAudioEngine} from '../ts'
import {RecordingSessionController} from './sessionController'
import {runClipAnalysis} from './workerClient'
import {importRecordingFile} from './importClip'

const Context=createContext<RecordingSessionController|null>(null)
export function RecordingSessionProvider({children,controller:provided}:{children:ReactNode;controller?:RecordingSessionController}){
 const [controller]=useState(()=>provided??new RecordingSessionController({
  engine:getAudioEngine(),analyze:runClipAnalysis,importClip:importRecordingFile,now:()=>new Date(),
 }))
 const lifecycle=useRef(0)
 useEffect(()=>{
  const generation=++lifecycle.current
  return()=>{queueMicrotask(()=>{if(lifecycle.current===generation)controller.destroy()})}
 },[controller])
 return <Context.Provider value={controller}>{children}</Context.Provider>
}
export function useRecordingSession(){
 const controller=useContext(Context)
 if(!controller)throw new Error('RecordingSessionProvider is required')
 const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
 return {controller,snapshot}
}
