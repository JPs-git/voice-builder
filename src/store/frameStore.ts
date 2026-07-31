import { create } from 'zustand'
import type { AnalysisFrame, AnalysisStats } from '../types'
import { useAnalysisStore } from './analysisStore'

const WINDOW_FRAMES = 1000

interface FrameState {
  frames: AnalysisFrame[]
  latestFrame: AnalysisFrame | null
  stats: AnalysisStats
  cursorTime: number
}

interface FrameActions {
  appendFrame: (frame: AnalysisFrame) => void
  setFrames: (frames: AnalysisFrame[]) => void
  setCursorTime: (time: number) => void
  clear: () => void
}

type FrameStore = FrameState & FrameActions

function computeStats(frames: AnalysisFrame[]): AnalysisStats {
  if (frames.length === 0) {
    return { f0Mean: null, hitRate: null, duration: 0 }
  }

  let f0Sum = 0
  let f0Count = 0
  let hitCount = 0
  let voicedCount = 0

  const bands = useAnalysisStore.getState().bands
  const f0Range = bands.f0.range

  for (const frame of frames) {
    if (frame.f0 != null) {
      f0Sum += frame.f0
      f0Count++
      voicedCount++
      if (frame.f0 >= f0Range[0] && frame.f0 <= f0Range[1]) {
        hitCount++
      }
    } else if (frame.voiced) {
      voicedCount++
    }
  }

  const lastFrame = frames[frames.length - 1]

  return {
    f0Mean: f0Count > 0 ? f0Sum / f0Count : null,
    hitRate: voicedCount > 0 ? hitCount / voicedCount : null,
    duration: lastFrame.time,
  }
}

export const useFrameStore = create<FrameStore>((set) => ({
  frames: [],
  latestFrame: null,
  stats: { f0Mean: null, hitRate: null, duration: 0 },
  cursorTime: -1,

  appendFrame: (frame) => set((state) => {
    const frames = state.frames.length >= WINDOW_FRAMES
      ? [...state.frames.slice(1), frame]
      : [...state.frames, frame]
    return {
      frames,
      latestFrame: frame,
      stats: computeStats(frames),
    }
  }),

  setFrames: (frames) => set({
    frames,
    latestFrame: frames.length > 0 ? frames[frames.length - 1] : null,
    stats: computeStats(frames),
  }),

  setCursorTime: (cursorTime) => set({ cursorTime }),

  clear: () => set({
    frames: [],
    latestFrame: null,
    stats: { f0Mean: null, hitRate: null, duration: 0 },
    cursorTime: -1,
  }),
}))
