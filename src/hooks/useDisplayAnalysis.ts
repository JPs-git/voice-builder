import { useSyncExternalStore } from 'react'
import { useAppStore } from '../store/appStore'
import { liveChartScheduler } from '../charts/liveChartScheduler'

type State = ReturnType<typeof useAppStore.getState>
type Snapshot = Pick<State, 'frames' | 'latestFrame'>
const listeners = new Set<() => void>()
let snapshot: Snapshot = useAppStore.getState()
let disconnect: (() => void) | undefined

function publish() {
  const state = useAppStore.getState()
  if (snapshot.frames === state.frames && snapshot.latestFrame === state.latestFrame) return
  snapshot = { frames: state.frames, latestFrame: state.latestFrame }
  listeners.forEach(listener => listener())
}

/** Stop/import/clear can publish immediately; scheduled draws then become no-ops. */
export function flushDisplayAnalysis(): void { publish() }

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!disconnect) {
    const unsubscribeDraw = liveChartScheduler.subscribe(publish)
    const onVisibility = () => liveChartScheduler.setVisible(document.visibilityState !== 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    const unsubscribeStore = useAppStore.subscribe((state, previous) => {
      if (state.frames === previous.frames && state.latestFrame === previous.latestFrame) return
      if (!state.frames.length) publish()
      else liveChartScheduler.invalidate()
    })
    disconnect = () => {
      unsubscribeStore()
      unsubscribeDraw()
      document.removeEventListener('visibilitychange', onVisibility)
    }
    publish()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { disconnect?.(); disconnect = undefined }
  }
}

function getSnapshot(): Snapshot {
  if (!listeners.size) snapshot = useAppStore.getState()
  return snapshot
}

export function useDisplayAnalysis(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
