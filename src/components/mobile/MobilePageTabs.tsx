import { NavLink } from 'react-router-dom'
import styles from './MobilePageTabs.module.css'

export function MobilePageTabs() {
  return (
    <nav className={styles.tabs} aria-label="页面切换">
      <NavLink to="/" end className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
        声音分析
      </NavLink>
      <NavLink to="/practice" className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
        音高参考
      </NavLink>
    </nav>
  )
}
