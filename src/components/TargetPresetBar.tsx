import { useCallback, useState, useEffect } from 'react'
import { VOWEL_PRESETS } from '../types'
import type { TargetBands } from '../types'

interface TargetPresetBarProps {
  activePreset: string | null
  bands: TargetBands
  onPresetSelect: (name: string) => void
  onBandsChange: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
}

const BAND_COLORS: Record<'f0' | 'f1' | 'f2', string> = {
  f0: '#10B981',
  f1: '#3B82F6',
  f2: '#F59E0B',
}

function bandKeyToId(key: 'f0' | 'f1' | 'f2', index: 0 | 1): string {
  return `${key}-${index}`
}

export function TargetPresetBar({ activePreset, bands, onPresetSelect, onBandsChange }: TargetPresetBarProps) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => ({
    [bandKeyToId('f0', 0)]: String(bands.f0.range[0]),
    [bandKeyToId('f0', 1)]: String(bands.f0.range[1]),
    [bandKeyToId('f1', 0)]: String(bands.f1.range[0]),
    [bandKeyToId('f1', 1)]: String(bands.f1.range[1]),
    [bandKeyToId('f2', 0)]: String(bands.f2.range[0]),
    [bandKeyToId('f2', 1)]: String(bands.f2.range[1]),
  }))

  useEffect(() => {
    setLocalValues({
      [bandKeyToId('f0', 0)]: String(bands.f0.range[0]),
      [bandKeyToId('f0', 1)]: String(bands.f0.range[1]),
      [bandKeyToId('f1', 0)]: String(bands.f1.range[0]),
      [bandKeyToId('f1', 1)]: String(bands.f1.range[1]),
      [bandKeyToId('f2', 0)]: String(bands.f2.range[0]),
      [bandKeyToId('f2', 1)]: String(bands.f2.range[1]),
    })
  }, [bands])

  const handleInputChange = useCallback((key: 'f0' | 'f1' | 'f2', index: 0 | 1, value: string) => {
    setLocalValues(prev => ({ ...prev, [bandKeyToId(key, index)]: value }))
  }, [])

  const handleInputBlur = useCallback((key: 'f0' | 'f1' | 'f2', index: 0 | 1) => {
    const id = bandKeyToId(key, index)
    const num = parseFloat(localValues[id])
    if (!Number.isFinite(num)) {
      setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
      return
    }
    const current = bands[key].range
    const next: [number, number] = index === 0 ? [num, current[1]] : [current[0], num]
    if (next[0] < next[1]) {
      onBandsChange({ [key]: next })
    } else {
      setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
    }
  }, [localValues, bands, onBandsChange])

  const vowelKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className="preset-bar" aria-label="共振峰目标区间">
      <div className="preset-row">
        <label className="preset-label">目标区间</label>
      </div>
      <div className="preset-vowels" role="group" aria-label="元音预设">
        {vowelKeys.map((name) => (
          <button
            key={name}
            type="button"
            className={`vowel-btn${activePreset === name ? ' is-active' : ''}`}
            data-preset={name}
            onClick={() => onPresetSelect(name)}
          >
            {VOWEL_PRESETS[name].label.replace('元音 ', '')}
          </button>
        ))}
      </div>
      <div className="preset-inputs">
        {(['f0', 'f1', 'f2'] as const).map((key) => (
          <div key={key} className="band-input" data-band={key}>
            <span className="band-key">{key.toUpperCase()}</span>
            <input
              type="number"
              min={key === 'f0' ? 20 : 100}
              max={key === 'f0' ? 600 : 3500}
              step={key === 'f0' ? 5 : 10}
              className="band-lo"
              value={localValues[bandKeyToId(key, 0)]}
              onChange={e => handleInputChange(key, 0, e.target.value)}
              onBlur={() => handleInputBlur(key, 0)}
              aria-label={`${key.toUpperCase()}下限`}
            />
            <span className="band-dash">—</span>
            <input
              type="number"
              min={key === 'f0' ? 20 : 100}
              max={key === 'f0' ? 600 : 3500}
              step={key === 'f0' ? 5 : 10}
              className="band-hi"
              value={localValues[bandKeyToId(key, 1)]}
              onChange={e => handleInputChange(key, 1, e.target.value)}
              onBlur={() => handleInputBlur(key, 1)}
              aria-label={`${key.toUpperCase()}上限`}
            />
            <span className="band-unit">Hz</span>
          </div>
        ))}
      </div>
    </section>
  )
}