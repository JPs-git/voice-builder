import { RingBuffer } from '../dsp/RingBuffer'

// Module-level shared raw audio buffer
// Written by useAnalysis, read by usePlayback
export const recordingBuffer = new RingBuffer(16000 * 10)
