import {useEffect,useState,useSyncExternalStore} from 'react'
import type {AudioClip} from './types'
import {RecordingPlaybackController} from './playbackController'
export function useRecordingPlayback(clip:AudioClip|null,shared?:RecordingPlaybackController){
 const [local]=useState(()=>shared??new RecordingPlaybackController())
 const controller=shared??local
 const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
 useEffect(()=>{controller.setClip(clip);return()=>{if(shared)controller.pause();else controller.destroy()}},[controller,clip,shared])
 return {controller,snapshot}
}
