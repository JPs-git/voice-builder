import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { placeValidationBubble } from './validationBubblePosition'
import styles from './TrainingGoalCard.module.css'

interface BandValidationBubbleProps {
  id: string
  message: string
  index: 0 | 1
  anchor: HTMLInputElement | null
  onClose: () => void
}

export function BandValidationBubble({ id, message, index, anchor, onClose }: BandValidationBubbleProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<ReturnType<typeof placeValidationBubble> | null>(null)
  const dialog = anchor?.closest('[role="dialog"]')
  const layer = dialog?.parentElement ?? document.body
  useLayoutEffect(() => {
    // The native focusin that follows the validating blur belongs to the same interaction.
    let dismissalArmed = false
    const armTimer = window.setTimeout(() => { dismissalArmed = true }, 0)
    let scrolledForSpace = false
    let pendingFrame: number | null = null
    const update = () => {
      const bubble = ref.current
      const inputs = anchor?.closest('label')?.parentElement ?? anchor?.closest('[data-band]')
      if (!bubble || !anchor || !inputs) return
      const viewport = window.visualViewport
      const view = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight }
      const box = inputs.getBoundingClientRect()
      const body = anchor.closest('[data-modal-body]')?.getBoundingClientRect()
      const obstacles = Array.from(layer.querySelectorAll('[data-band-slider]')).map(node => node.getBoundingClientRect())
        .map(rect => ({ top: Math.max(rect.top, body?.top ?? view.top), bottom: Math.min(rect.bottom, body?.bottom ?? view.top + view.height) }))
        .filter(rect => rect.bottom > rect.top)
      const content = bubble.querySelector<HTMLElement>('[data-bubble-text]')
      const naturalHeight = Math.max(52, (content?.scrollHeight ?? bubble.scrollHeight) + 26)
      const next = placeValidationBubble({ left: box.left, top: anchor.getBoundingClientRect().top, width: box.width }, naturalHeight, view, obstacles)
      if (next.height < 52 && box.width > 0) {
        setPosition(null)
        if (!scrolledForSpace) {
          scrolledForSpace = true
          anchor.scrollIntoView({ block: 'center', inline: 'nearest' })
          pendingFrame = window.requestAnimationFrame(update)
        }
        return
      }
      setPosition(prev => prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next)
    }
    update()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (ref.current) observer?.observe(ref.current)
    if (anchor) observer?.observe(anchor)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    const dismissOutside = (event: Event) => {
      if (!dismissalArmed) return
      const target = event.target as Node | null
      if (target && target !== anchor && !ref.current?.contains(target)) onClose()
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('focusin', dismissOutside)
    return () => {
      window.clearTimeout(armTimer)
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame)
      observer?.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('focusin', dismissOutside)
    }
  }, [anchor, layer, message, onClose])
  const dismiss = () => { onClose(); anchor?.focus({ preventScroll: true }) }
  const [headline, ...details] = message.split('；')
  return createPortal(
    <div ref={ref} id={id} role="status" className={styles.bubble}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, width: position?.width ?? 300, height: position?.height,
        '--bubble-text-height': `${Math.max(0, (position?.height ?? 200) - 26)}px`,
        '--arrow-position': index === 0 ? '25%' : '75%', visibility: position ? 'visible' : 'hidden' } as CSSProperties}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); dismiss() }
      }}>
      <span className={styles.bubbleIcon} aria-hidden="true">i</span>
      <div className={styles.bubbleText} data-bubble-text>
        <strong>{headline}</strong>
        {details.map((detail, detailIndex) => <span key={detailIndex}>{detail}</span>)}
      </div>
      <button type="button" className={styles.bubbleClose} aria-label="关闭校验提示" onClick={dismiss}>×</button>
    </div>, layer,
  )
}
