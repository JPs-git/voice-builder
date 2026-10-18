import {useEffect,useState,useSyncExternalStore} from 'react'
import type {AudioClip} from './types'
import {RecordingPlaybackController} from './playbackController'
export function useRecordingPlayback(clip:AudioClip){
 const [controller]=useState(()=>new RecordingPlaybackController())
 const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
 useEffect(()=>{controller.setClip(clip);return()=>controller.destroy()},[controller,clip])
 return {controller,snapshot}
}
