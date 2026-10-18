import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAnalytics } from './analytics/analytics'
import App from './App'
import '../css/style.css'

initAnalytics()

const root = document.getElementById('app')
if (!root) throw new Error('Root element #app not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
