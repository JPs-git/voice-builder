import { create } from 'zustand'

export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

const TOAST_DURATION = 3000
const MAX_TOASTS = 4

interface ToastState {
  toasts: Toast[]
  showToast: (type: ToastType, message: string) => void
  dismissToast: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (type, message) => {
    const id = nextId++
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }].slice(-MAX_TOASTS),
    }))

    window.setTimeout(() => {
      if (get().toasts.some((t) => t.id === id)) {
        get().dismissToast(id)
      }
    }, TOAST_DURATION)
  },

  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}))
