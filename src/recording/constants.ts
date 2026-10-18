import { DEFAULT_VAD_OPTIONS } from '../dsp/vad'
import { F0_RANGE } from '../config/analysisRanges'
import type { AnalysisSettings } from './types'
export const MAX_RECORDING_SECONDS = 60
export const ANALYSIS_SETTINGS: AnalysisSettings = {
  sampleRate:16000, frameSize:800, hopSize:160, f0Range:[F0_RANGE.min,F0_RANGE.max],
  vad:{...DEFAULT_VAD_OPTIONS}, outlierVersion:'isolated-jump-v1',
}
export const ANALYSIS_VERSION = 'recording-f0-v1'
