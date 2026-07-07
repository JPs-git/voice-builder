import type { AnalysisFrame } from '../types'

function fmtHz(v: number | null | undefined): string {
  return v == null ? '-- Hz' : `${Math.round(v)} Hz`
}

interface StatusBarProps {
  latestFrame: AnalysisFrame | null
  frameCount: number
}

export function StatusBar({ latestFrame, frameCount }: StatusBarProps) {
  return (
    <div style={{
      height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 20, fontSize: 13, fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace',
      background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '0 16px', flexShrink: 0,
    }}>
      <span>F0 = {fmtHz(latestFrame?.f0)}</span>
      <span>F1 = {fmtHz(latestFrame?.f1)}</span>
      <span>F2 = {fmtHz(latestFrame?.f2)}</span>
      <span>帧数: {frameCount}</span>
    </div>
  )
}
