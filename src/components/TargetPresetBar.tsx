import { useCallback } from 'react'
import { VOWEL_PRESETS } from '../types'
import type { TargetBands } from '../types'

interface TargetPresetBarProps {
  activePreset: string | null
  bands: TargetBands
  onPresetSelect: (name: string) => void
  onBandsChange: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
}

export function TargetPresetBar({ activePreset, bands, onPresetSelect, onBandsChange }: TargetPresetBarProps) {
  const handleInputChange = useCallback((key: 'f0' | 'f1' | 'f2', index: 0 | 1, value: string) => {
    const num = parseFloat(value)
    if (!Number.isFinite(num)) return
    const current = bands[key].range
    const next: [number, number] = index === 0 ? [num, current[1]] : [current[0], num]
    onBandsChange({ [key]: next })
  }, [bands, onBandsChange])

  return (
    <section style={{ width: 180, flexShrink: 0 }} aria-label="共振峰目标区间">
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#4B5563' }}>目标区间</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {Object.entries(VOWEL_PRESETS).map(([name, preset]) => (
          <button
            key={name}
            onClick={() => onPresetSelect(name)}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB',
              background: activePreset === name ? '#E23E57' : '#FFF',
              color: activePreset === name ? '#FFF' : '#1F2937',
              cursor: 'pointer', fontSize: 13, fontWeight: activePreset === name ? 600 : 400,
              textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(['f0', 'f1', 'f2'] as const).map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <span style={{ width: 24, fontWeight: 600, color: '#4B5563' }}>
              {key.toUpperCase()}
            </span>
            <input
              type="number" min={key === 'f0' ? 20 : 100} max={key === 'f0' ? 600 : 3500} step={key === 'f0' ? 5 : 10}
              value={bands[key].range[0]}
              onChange={e => handleInputChange(key, 0, e.target.value)}
              style={{ width: 52, padding: '2px 4px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12 }}
            />
            <span style={{ color: '#9CA3AF' }}>—</span>
            <input
              type="number" min={key === 'f0' ? 20 : 100} max={key === 'f0' ? 600 : 3500} step={key === 'f0' ? 5 : 10}
              value={bands[key].range[1]}
              onChange={e => handleInputChange(key, 1, e.target.value)}
              style={{ width: 52, padding: '2px 4px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12 }}
            />
            <span style={{ color: '#9CA3AF', fontSize: 11 }}>Hz</span>
          </div>
        ))}
      </div>
    </section>
  )
}
