import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './routes/AppShell'
import { AnalysisPage } from './routes/AnalysisPage'
import { PracticePage } from './routes/PracticePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<AnalysisPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
