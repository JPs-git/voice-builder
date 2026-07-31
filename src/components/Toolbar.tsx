import logo from '../../assets/logo.png'
import { Button } from './Button'
import styles from './Toolbar.module.css'
import type { ToolItem } from '../hooks/useToolbar'

interface ToolbarProps {
  toolItems: ToolItem[]
  onToolClick: (toolId: string) => void
}

export function Toolbar({ toolItems, onToolClick }: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <div className={styles.brand}>
        <img src={logo} className={styles.logo} alt="" aria-hidden="true" />
        <span className={styles.title}>在线声音训练</span>
        <span className={styles.subtitle}>「看见自己的声音」</span>
      </div>

      <div className={styles.actions}>
        {toolItems.map(item => (
          <Button
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
    </header>
  )
}
