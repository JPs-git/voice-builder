import { useReducer, useEffect, useCallback, useRef } from 'react'

type TipStatus = 'idle' | 'showing' | 'pausing' | 'closing' | 'stopped'

type TipState = {
  status: TipStatus
  index: number
}

type TipAction =
  | { type: 'OPEN'; index: number }
  | { type: 'CLOSE' }
  | { type: 'MOUSE_ENTER' }
  | { type: 'MOUSE_LEAVE' }
  | { type: 'TIMER_EXPIRE' }
  | { type: 'TRANSITION_END' }

function reducer(state: TipState, action: TipAction): TipState {
  switch (state.status) {
    case 'stopped':
      if (action.type === 'OPEN') {
        return { status: 'showing', index: action.index }
      }
      break
    case 'showing':
      if (action.type === 'TIMER_EXPIRE') {
        return { status: 'idle', index: state.index }
      }
      if (action.type === 'CLOSE') {
        return { status: 'closing', index: state.index }
      }
      if (action.type === 'MOUSE_ENTER') {
        return { status: 'pausing', index: state.index }
      }
      break
    case 'pausing':
      if (action.type === 'MOUSE_LEAVE') {
        return { status: 'showing', index: state.index }
      }
      if (action.type === 'CLOSE') {
        return { status: 'closing', index: state.index }
      }
      break
    case 'idle':
      if (action.type === 'TIMER_EXPIRE') {
        return { status: 'showing', index: state.index }
      }
      break
    case 'closing':
      if (action.type === 'TRANSITION_END') {
        return { status: 'stopped', index: state.index }
      }
      break
  }
  return state
}

export function useTipStateMachine(
  tips: string[],
  interval: number,
  initialIndex: number
) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'idle' as TipStatus,
    index: initialIndex,
  })

  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const transitionRef = useRef<{ card: HTMLDivElement; onEnd: () => void } | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const pickNextIndex = useCallback(() => {
    return Math.floor(Math.random() * tips.length)
  }, [tips.length])

  const wrappedDispatch = useCallback(
    (action: TipAction) => {
      if (action.type === 'OPEN') {
        dispatch({ type: 'OPEN', index: pickNextIndex() })
        return
      }
      dispatch(action)
    },
    [pickNextIndex]
  )

  useEffect(() => {
    clearTimer()
    if (transitionRef.current) {
      const { card, onEnd } = transitionRef.current
      card.removeEventListener('transitionend', onEnd)
      transitionRef.current = null
    }

    switch (state.status) {
      case 'showing': {
        timerRef.current = window.setTimeout(() => {
          dispatch({ type: 'TIMER_EXPIRE' })
        }, interval)
        break
      }
      case 'idle': {
        timerRef.current = window.setTimeout(() => {
          dispatch({ type: 'TIMER_EXPIRE' })
        }, interval)
        break
      }
      case 'closing': {
        const card = cardRef.current
        if (card) {
          const onEnd = () => {
            card.removeEventListener('transitionend', onEnd)
            transitionRef.current = null
            dispatch({ type: 'TRANSITION_END' })
          }
          card.addEventListener('transitionend', onEnd)
          transitionRef.current = { card, onEnd }
        } else {
          dispatch({ type: 'TRANSITION_END' })
        }
        break
      }
    }

    return () => {
      clearTimer()
      if (transitionRef.current) {
        const { card, onEnd } = transitionRef.current
        card.removeEventListener('transitionend', onEnd)
        transitionRef.current = null
      }
    }
  }, [state.status, interval, clearTimer])

  return { state, dispatch: wrappedDispatch, cardRef }
}
