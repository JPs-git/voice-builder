import { RingBuffer } from '../dsp/RingBuffer'
import { AUDIO_WINDOW_SECONDS } from '../config/audioLimits'

// Module-level shared raw audio buffer
// Written by useAnalysis, read by usePlayback
export const recordingBuffer = new RingBuffer(16000 * AUDIO_WINDOW_SECONDS)
