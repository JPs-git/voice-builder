export type RecordingMode = 'reading' | 'free'
export interface MaterialSnapshot { id: string; version: number; title: string; source: string }
export interface AudioClip {
  samples: Float32Array; sampleRate: number; duration: number; source: 'mic' | 'file'
  name: string; mode: RecordingMode | null; material: MaterialSnapshot | null; prompt: string | null
}
export interface PitchFrame {
  start: number; duration: number; time: number; rawF0: number | null; f0: number | null
  voiced: boolean; exclusion: 'invalid' | 'isolated-jump' | null
}
export interface HistogramBin { from: number; to: number; count: number; proportion: number }
export interface PitchSummary {
  median: number|null; minimum: number|null; maximum: number|null; minTime: number|null; maxTime: number|null
  range: number|null; semitoneRange: number|null; p10: number|null; p90: number|null
  validDuration: number; coverage: number; excludedCount: number; histogram: HistogramBin[]
}
export interface AnalysisSettings {
  sampleRate: number; frameSize: number; hopSize: number; f0Range: readonly [number,number]
  vad: {threshold:number;releaseThreshold:number;holdMs:number}; outlierVersion: string
}
export interface ClipAnalysis { frames: PitchFrame[]; summary: PitchSummary; version: string; settings: AnalysisSettings }
export interface RecordingReport { id: number; clip: AudioClip; analysis: ClipAnalysis }
export type RecordingPhase = 'prepared'|'requesting'|'recording'|'importing'|'analyzing'|'ready'|'error'
export interface RecordingSnapshot {
  phase: RecordingPhase; elapsed: number; progress: number; report: RecordingReport|null; error: string|null
}
