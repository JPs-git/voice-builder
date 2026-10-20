import {trackRecordingTask} from '../analytics/analytics'
import {recordPracticeSamples} from '../analytics/practiceProgress'
import type {AnalyticsEventMap,CaptureError,DurationBucket,RecordingTaskEvent,WithoutPage} from '../analytics/events'

export function emitRecording<K extends RecordingTaskEvent>(name:K,data:WithoutPage<AnalyticsEventMap[K]>):void {
 try{trackRecordingTask(name,data)}catch{/* Telemetry cannot affect an audio task. */}
}
export function countRecordingSamples(count:number,rate:number):void {
 try{recordPracticeSamples(count,rate)}catch{/* Preserve audio operation on telemetry failure. */}
}
export function durationBucket(seconds:number):DurationBucket {
 return seconds>=60?'at_limit':seconds>=30?'30_to_59s':seconds>=10?'10_to_29s':'under_10s'
}
export function captureErrorReason(error:unknown):CaptureError {
 if(!(error instanceof DOMException))return 'unknown'
 if(['NotAllowedError','SecurityError'].includes(error.name))return 'permission'
 if(['NotFoundError','NotReadableError','AbortError'].includes(error.name))return 'device'
 return error.name==='NotSupportedError'?'unsupported':'unknown'
}
