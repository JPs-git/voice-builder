import type {ImportError,AnalysisError} from '../analytics/events'
export class RecordingImportError extends Error {
 constructor(message:string,readonly reason:ImportError){super(message)}
}
export class RecordingAnalysisError extends Error {
 constructor(message:string,readonly reason:AnalysisError){super(message)}
}
