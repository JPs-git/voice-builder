import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'

export const INTRO_HINT_KEY = 'voicebuilder-intro-hint-v1'

interface IntroHintState {
  handled: boolean
  markHandled: () => void
}

// Storage restrictions must never prevent practice or an in-session dismissal.
const storage: PersistStorage<Pick<IntroHintState, 'handled'>> = {
  getItem: name => {
    try {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      const saved = JSON.parse(raw)
      return saved?.state?.handled === true ? { state: { handled: true }, version: 0 } : null
    } catch { return null }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, JSON.stringify(value)) } catch { /* Keep in-memory state. */ }
  },
  removeItem: name => {
    try { localStorage.removeItem(name) } catch { /* Keep in-memory state. */ }
  },
}

export const useIntroHintStore = create<IntroHintState>()(persist(
  set => ({ handled: false, markHandled: () => set({ handled: true }) }),
  { name: INTRO_HINT_KEY, storage, partialize: state => ({ handled: state.handled }) },
))
