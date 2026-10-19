import { NavLink, Link, useMatch } from 'react-router-dom'
import styles from './MobilePageTabs.module.css'

export function MobilePageTabs({variant='mobile'}:{variant?:'mobile'|'desktop'}) {
  const report = useMatch('/reports/:reportId') != null
  const recording = useMatch('/recording') != null
  return (
    <nav className={`${styles.tabs} ${variant==='desktop'?styles.desktop:''}`} aria-label="页面切换">
      <NavLink to="/" end className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
        实时分析
      </NavLink>
      <NavLink to="/practice" className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
        音高参考
      </NavLink>
      <Link to="/recording" aria-current={recording||report?'page':undefined} className={`${styles.tab} ${recording||report ? styles.active : ''}`}>
        统计分析
      </Link>
    </nav>
  )
}
