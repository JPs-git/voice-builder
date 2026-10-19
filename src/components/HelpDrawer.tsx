import { useEffect, useRef } from 'react'
import { Modal } from './Modal'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { HELP_TOPIC_ORDER, getHelpTopicTitle, getHelpSections, getPresetRows, RECORDING_HELP, type HelpTopic } from '../content/helpContent'
import styles from './HelpDrawer.module.css'

interface HelpDrawerProps {
  open: boolean
  onClose: () => void
  topic: HelpTopic
  onTopicChange: (topic: HelpTopic) => void
  getFallbackFocus?: () => HTMLElement | null
  recording?: boolean
}

export function HelpDrawer({ open, onClose, topic, onTopicChange, getFallbackFocus, recording }: HelpDrawerProps) {
  const portrait = useMediaQuery('(max-width: 768px)')
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    contentRef.current?.closest('[data-modal-body]')?.scrollTo?.({ top: 0 })
  }, [topic, open])
  return (
    <Modal open={open} title="使用说明" onClose={onClose} getFallbackFocus={getFallbackFocus}>
      {!recording && <nav className={styles.topics} aria-label="帮助主题">
        {HELP_TOPIC_ORDER.map(item => <button key={item} type="button" aria-pressed={topic === item}
          onClick={() => onTopicChange(item)}>{getHelpTopicTitle(item)}</button>)}
      </nav>}
      <div ref={contentRef} className={styles.content}>
        <h4 className={styles.chapterTitle}>{recording ? '统计分析' : getHelpTopicTitle(topic)}</h4>
        {(recording ? RECORDING_HELP : getHelpSections(topic, portrait ? 'portrait' : 'landscape')).map((section, index) => (
          <section key={section.title} className={styles.section}>
            <h5>{!recording && topic === 'quick-start' && <span className={styles.step}>{index + 1}</span>}{section.title}</h5>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
        {!recording && topic === 'targets' && <table className={styles.refTable}>
          <caption>默认预设（Hz）</caption>
          <thead><tr>{['元音', 'F0', 'F1', 'F2'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{getPresetRows().map(row => <tr key={row.vowel}>
            <th scope="row">{row.vowel}</th>
            {row.ranges.map((range, index) => <td key={index}>{range.join('–')}</td>)}
          </tr>)}</tbody>
        </table>}
      </div>
    </Modal>
  )
}
