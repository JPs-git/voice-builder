import {BASE_SAMPLE_RATE,BASE_FRAME_SIZE,BASE_HOP_SIZE} from '../dsp/base-analysis'
import { DEFAULT_VAD_OPTIONS } from '../dsp/vad'
import { F0_RANGE } from '../config/analysisRanges'
import type { AnalysisSettings } from './types'
export const MAX_RECORDING_SECONDS = 60
export const STATISTICS_F0_RANGE = {min:60,max:500} as const
export const ANALYSIS_SETTINGS: AnalysisSettings = {
  sampleRate:BASE_SAMPLE_RATE, frameSize:BASE_FRAME_SIZE, hopSize:BASE_HOP_SIZE, f0Range:[F0_RANGE.min,F0_RANGE.max],
  statisticsRange:[STATISTICS_F0_RANGE.min,STATISTICS_F0_RANGE.max],
  vad:{...DEFAULT_VAD_OPTIONS}, outlierVersion:'isolated-jump-v1',
}
export const ANALYSIS_VERSION = 'recording-f0-v3'
