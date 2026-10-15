import type { ReactNode, Ref } from 'react'
import logo from '../../assets/logo.png'
import { Button } from './Button'
import styles from './Toolbar.module.css'
import type { ToolItem } from '../hooks/useToolbar'

interface ToolbarProps {
  toolItems: ToolItem[]
  onToolClick: (toolId: string) => void
  nav?: { label: string; onClick: () => void }
  pageTabs?: ReactNode
  moreMenu?: ReactNode
  recordButtonRef?: Ref<HTMLButtonElement>
  helpButtonRef?: Ref<HTMLButtonElement>
}

export function Toolbar({ toolItems, onToolClick, nav, pageTabs, moreMenu, recordButtonRef, helpButtonRef }: ToolbarProps) {
  return (
    <header className={styles.toolbar} data-compact={moreMenu ? 'true' : 'false'}>
      <div className={styles.brand}>
        <img src={logo} className={styles.logo} alt="" aria-hidden="true" />
        <span className={styles.title}>在线声音训练</span>
        <span className={styles.subtitle}>「看见自己的声音」</span>
      </div>

      {pageTabs && <div className={styles.pageTabs}>{pageTabs}</div>}

      {!pageTabs && nav && (
        <div className={styles.nav}>
          <Button icon="⇄" label={nav.label} onClick={nav.onClick} />
        </div>
      )}

      {moreMenu ?? (
        <div className={styles.actions}>
          {toolItems.map(item => (
            <Button
              ref={item.id === 'record' ? recordButtonRef : item.id === 'help' ? helpButtonRef : undefined}
              key={item.id}
              id={item.id}
              variant={item.variant}
              icon={item.icon}
              label={item.label}
              recording={item.recording}
              disabled={item.disabled}
              onClick={() => onToolClick(item.id)}
            />
          ))}
        </div>
      )}
    </header>
  )
}
