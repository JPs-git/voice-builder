import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useToastStore } from '../store/toastStore'

function resetStore() {
  useToastStore.setState({ toasts: [] })
}

describe('toastStore', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('showToast', () => {
    it('adds a toast with auto-incrementing id', () => {
      useToastStore.getState().showToast('error', 'first')
      const id1 = useToastStore.getState().toasts[0].id
      useToastStore.getState().showToast('info', 'second')
      const id2 = useToastStore.getState().toasts[1].id
      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(2)
      expect(toasts[0]).toMatchObject({ id: id1, type: 'error', message: 'first' })
      expect(toasts[1]).toMatchObject({ id: id2, type: 'info', message: 'second' })
      expect(id2).toBe(id1 + 1)
    })

    it('auto-dismisses a toast after 3 seconds', () => {
      useToastStore.getState().showToast('error', 'bye')
      expect(useToastStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(3000)
      expect(useToastStore.getState().toasts).toHaveLength(0)
    })

    it('keeps toasts within the stack limit', () => {
      for (let i = 0; i < 6; i++) {
        useToastStore.getState().showToast('info', `msg-${i}`)
      }
      expect(useToastStore.getState().toasts).toHaveLength(4)
    })
  })

  describe('dismissToast', () => {
    it('removes a toast by id', () => {
      useToastStore.getState().showToast('error', 'one')
      const id1 = useToastStore.getState().toasts[0].id
      useToastStore.getState().showToast('info', 'two')
      useToastStore.getState().dismissToast(id1)
      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('two')
    })
  })
})
