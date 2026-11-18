import { useState } from 'react'
import styles from './SurveyBanner.module.css'

interface SurveyBannerProps {
  surveyId: string
  href: string
  onDismiss?: () => void
}

export function SurveyBanner({ surveyId, href, onDismiss }: SurveyBannerProps) {
  const key = `voice-builder:survey-dismissed:${surveyId}`
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  let storedDismissal = false
  try { storedDismissal = sessionStorage.getItem(key) === '1' } catch { /* Storage is optional. */ }
  if (dismissed[key] || storedDismissal) return null

  const dismiss = () => {
    try { sessionStorage.setItem(key, '1') } catch { /* Keep in-memory dismissal available. */ }
    setDismissed(previous => ({ ...previous, [key]: true }))
    onDismiss?.()
  }

  return <section className={styles.banner} aria-label="用户问卷调查">
    <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">你平时如何练习声音？我们正在探索新的声音训练产品，邀你填写约2分钟的问卷，报名参与用户访谈。</a>
    <button className={styles.close} type="button" aria-label="关闭问卷邀请" onClick={dismiss}>×</button>
  </section>
}

