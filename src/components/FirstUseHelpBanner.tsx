import {useEffect,useRef} from 'react'
import styles from './FirstUseHelpBanner.module.css'

interface FirstUseHelpBannerProps {
  visible: boolean
  suppressed: boolean
  layout: 'portrait' | 'landscape'
  dockHeight?: number
  onOpen: () => void
  onDismiss: () => void
  description?:string
  onHeightChange?:(height:number)=>void
}

export function FirstUseHelpBanner({ visible, suppressed, layout, dockHeight = 0, onOpen, onDismiss, description='了解录音、读图与目标设置', onHeightChange }: FirstUseHelpBannerProps) {
  const root=useRef<HTMLElement>(null)
  useEffect(()=>{
    const measure=()=>onHeightChange?.(visible&&!suppressed&&layout==='portrait'&&dockHeight>0?(root.current?.getBoundingClientRect().height??0)+10:0)
    measure()
    if(!root.current||typeof ResizeObserver==='undefined')return
    const observer=new ResizeObserver(measure);observer.observe(root.current)
    return()=>observer.disconnect()
  },[visible,suppressed,layout,dockHeight,onHeightChange,description])
  if (!visible || (layout === 'portrait' && dockHeight <= 0)) return null
  return <section ref={root} aria-label="首次使用帮助" className={styles.anchor} style={{ bottom: layout === 'portrait' ? dockHeight + 10 : 24 }}
    data-layout={layout}
    data-suppressed={suppressed} aria-hidden={suppressed || undefined}>
    <div className={styles.banner}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
        <path d="M12 5v15" />
      </svg>
      <div className={styles.copy}><strong>第一次使用？</strong><span>{description}</span></div>
      <button type="button" className={styles.open} disabled={suppressed} onClick={onOpen}>查看说明</button>
      <button type="button" className={styles.close} disabled={suppressed} onClick={onDismiss} aria-label="关闭首次使用提示">×</button>
    </div>
  </section>
}
