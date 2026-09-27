import { useMediaQuery } from '../hooks/useMediaQuery'
import { PracticeLandscape } from './PracticeLandscape'
import { PracticePortrait } from './PracticePortrait'

export function PracticePage() {
  const isPortrait = useMediaQuery('(max-width: 768px)')
  return isPortrait ? <PracticePortrait /> : <PracticeLandscape />
}