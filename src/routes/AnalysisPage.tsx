import { useMediaQuery } from '../hooks/useMediaQuery'
import { AnalysisLandscape } from './AnalysisLandscape'
import { AnalysisPortrait } from './AnalysisPortrait'

export function AnalysisPage() {
  const isPortrait = useMediaQuery('(max-width: 768px)')
  return isPortrait ? <AnalysisPortrait /> : <AnalysisLandscape />
}