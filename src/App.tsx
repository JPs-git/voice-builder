import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnalysisProvider } from './contexts/AnalysisContext'
import { AnalysisPage } from './routes/AnalysisPage'

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <Routes>
          <Route path="*" element={<AnalysisPage />} />
        </Routes>
      </AnalysisProvider>
    </BrowserRouter>
  )
}
