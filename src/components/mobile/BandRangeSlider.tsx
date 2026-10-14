import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { BAND_INPUT_LIMITS, FORMANT_MIN_GAP_HZ } from '../../config/analysisRanges'
import { getFormantEditBounds } from '../../config/targetBandRules'
import { useAppStore } from '../../store/appStore'
import type { BandIndex, BandKey } from '../../hooks/usePresetBands'
import styles from './TrainingGoalCard.module.css'

interface BandRangeSliderProps {
  bandKey: BandKey
  value: [number, number]
  onChange: (index: BandIndex, value: number) => void
  onBoundary: (index: BandIndex, message: string) => void
}

export function BandRangeSlider({ bandKey, value, onChange, onBoundary }: BandRangeSliderProps) {
  const { min, max, step } = BAND_INPUT_LIMITS[bandKey]
  const bands = useAppStore(s => s.bands)
  const f2Lower = bands.f2.range[0]
  const dragging = useRef<BandIndex | null>(null)
  const lastBoundary = useRef('')
  const shownBoundaries = useRef(new Set<string>())
  const grabOffset = useRef(0)
  const gestureGap = useRef<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lowerRef = useRef<HTMLButtonElement>(null)
  const upperRef = useRef<HTMLButtonElement>(null)
  const percent = (number: number) => Math.max(0, Math.min(100, (number - min) / (max - min) * 100))
  // Preserve the step grid even next to a manually entered decimal.
  const pointerGap = () => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0
    const handleWidth = lowerRef.current?.getBoundingClientRect().width ?? 14
    const visualGap = width > 0 ? Math.ceil((max - min) * (handleWidth + 2) / width / step) * step : step
    // Existing legal narrow ranges must not jump just because the thumbs are close.
    return Math.max(step, bandKey === 'f0' ? 0 : FORMANT_MIN_GAP_HZ, Math.min(visualGap, value[1] - value[0]))
  }
  const bounds = (index: BandIndex): [number, number] => {
    const gap = gestureGap.current ?? (bandKey === 'f0' ? step : FORMANT_MIN_GAP_HZ)
    const [edgeMin, edgeMax] = bandKey === 'f0' ? [min, max] : getFormantEditBounds(bandKey, index, bands)
    return index === 0
      ? [min + Math.ceil((edgeMin - min) / step) * step,
        min + Math.floor((Math.min(edgeMax, value[1] - gap) - min) / step) * step]
      : [min + Math.ceil((Math.max(edgeMin, value[0] + gap) - min) / step) * step,
        min + Math.floor((edgeMax - min) / step) * step]
  }
  const update = (index: BandIndex, number: number) => {
    const [lo, hi] = bounds(index)
    const notify = (message: string) => {
      const identity = `${index}:${message}`
      if (lastBoundary.current === identity) return
      if (message && shownBoundaries.current.has(identity)) return
      if (message) shownBoundaries.current.add(identity)
      lastBoundary.current = identity
      onBoundary(index, message)
    }
    if (lo > hi) {
      notify('')
      return
    }
    const snapped = min + Math.round((number - min) / step) * step
    const next = Math.max(lo, Math.min(hi, snapped))
    if ((number > value[index] && next < value[index]) || (number < value[index] && next > value[index])) {
      notify('')
      return
    }
    if (next !== value[index]) onChange(index, next)
    if (bandKey === 'f1' && index === 1 && snapped >= hi && f2Lower < max) {
      notify(`已达可调上限 ${hi} Hz；F1 上限不能超过 F2 下限 ${f2Lower} Hz`)
    } else if (bandKey === 'f2' && index === 0 && snapped <= lo && bands.f1.range[1] > min) {
      notify(`已达可调下限 ${lo} Hz；F2 下限不能低于 F1 上限 ${bands.f1.range[1]} Hz`)
    } else {
      notify('')
    }
  }
  const move = (event: PointerEvent<HTMLDivElement>, index: BandIndex) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width) update(index, min + (event.clientX - rect.left - grabOffset.current) / rect.width * (max - min))
  }
  const onKeyDown = (event: KeyboardEvent, index: BandIndex) => {
    let next: number
    switch (event.key) {
      case 'ArrowLeft': case 'ArrowDown': next = value[index] - step; break
      case 'ArrowRight': case 'ArrowUp': next = value[index] + step; break
      case 'PageDown': next = value[index] - step * 10; break
      case 'PageUp': next = value[index] + step * 10; break
      case 'Home': next = min; break
      case 'End': next = max; break
      default: return
    }
    event.preventDefault()
    gestureGap.current = null
    lastBoundary.current = ''
    shownBoundaries.current.clear()
    update(index, next)
  }
  return (
    <div>
      <div ref={trackRef} className={styles.slider} role="group" data-band-slider aria-label={`${bandKey.toUpperCase()}范围滑杆`}
        style={{ '--lo': `${percent(value[0])}%`, '--hi': `${percent(value[1])}%` } as CSSProperties}
        onPointerDown={event => {
          if (event.button !== 0 || dragging.current !== null) return
          const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]')
          const centers = [lowerRef, upperRef].map(ref => {
            const box = ref.current!.getBoundingClientRect()
            return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
          })
          const distance = (index: BandIndex) => Math.hypot(event.clientX - centers[index].x, event.clientY - centers[index].y)
          const index: BandIndex = distance(0) <= distance(1) ? 0 : 1
          event.preventDefault()
          lastBoundary.current = ''
          shownBoundaries.current.clear()
          dragging.current = index
          gestureGap.current = pointerGap()
          grabOffset.current = handle ? event.clientX - centers[index].x : 0
          event.currentTarget.setPointerCapture(event.pointerId)
          ;(index === 0 ? lowerRef : upperRef).current?.focus({ preventScroll: true })
          if (!handle) move(event, index)
        }}
        onPointerMove={event => {
          if (dragging.current !== null && event.currentTarget.hasPointerCapture(event.pointerId)) move(event, dragging.current)
        }}
        onPointerUp={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          dragging.current = null
          gestureGap.current = null
        }}
        onPointerCancel={() => { dragging.current = null; gestureGap.current = null }}
        onLostPointerCapture={() => { dragging.current = null; gestureGap.current = null }}>
        <div className={styles.track}><div className={styles.selection} /></div>
        {([0, 1] as const).map(index => (
          <button key={index} ref={index === 0 ? lowerRef : upperRef} type="button" role="slider"
            data-handle={index} className={styles.handle} style={{
              left: `${percent(value[index])}%`,
            }}
            aria-label={`${bandKey.toUpperCase()}${index === 0 ? '下限' : '上限'}滑块`}
            aria-valuemin={min} aria-valuemax={max} aria-valuenow={value[index]}
            aria-valuetext={`${value[index]} Hz`} aria-orientation="horizontal"
            onKeyDown={event => onKeyDown(event, index)} />
        ))}
      </div>
      <div className={styles.scale}><span>{min}</span><span>{max} Hz</span></div>
    </div>
  )
}
