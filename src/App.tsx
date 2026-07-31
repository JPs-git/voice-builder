import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnalysisPage } from './routes/AnalysisPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<AnalysisPage />} />
      </Routes>
    </BrowserRouter>
  )
}
