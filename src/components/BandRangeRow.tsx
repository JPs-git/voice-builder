import type { CSSProperties } from 'react'
import { BAND_INPUT_LIMITS } from '../config/analysisRanges'
import { bandKeyToId } from '../hooks/usePresetBands'
import type { BandKey, PresetBandsApi } from '../hooks/usePresetBands'

export interface BandRangeRowProps {
  bandKey: BandKey
  localValues: PresetBandsApi['localValues']
  onInputChange: PresetBandsApi['onInputChange']
  onCommit: PresetBandsApi['onCommit']
  onInputKeyDown: PresetBandsApi['onInputKeyDown']
  className?: string
  keyClassName?: string
  inputClassName?: string | [string, string]
  dashClassName?: string
  unitClassName?: string
  style?: CSSProperties
}

export function BandRangeRow({
  bandKey,
  localValues,
  onInputChange,
  onCommit,
  onInputKeyDown,
  className,
  keyClassName,
  inputClassName,
  dashClassName,
  unitClassName,
  style,
}: BandRangeRowProps) {
  const limits = BAND_INPUT_LIMITS[bandKey]
  const [loClassName, hiClassName] = Array.isArray(inputClassName)
    ? inputClassName
    : [inputClassName, inputClassName]

  return (
    <div className={className} data-band={bandKey} style={style}>
      <span className={keyClassName}>{bandKey.toUpperCase()}</span>
      <input
        type="number"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        className={loClassName}
        value={localValues[bandKeyToId(bandKey, 0)]}
        onChange={e => onInputChange(bandKey, 0, e.target.value)}
        onBlur={() => onCommit(bandKey, 0)}
        onKeyDown={onInputKeyDown(bandKey, 0)}
        aria-label={`${bandKey.toUpperCase()}下限`}
      />
      <span className={dashClassName}>—</span>
      <input
        type="number"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        className={hiClassName}
        value={localValues[bandKeyToId(bandKey, 1)]}
        onChange={e => onInputChange(bandKey, 1, e.target.value)}
        onBlur={() => onCommit(bandKey, 1)}
        onKeyDown={onInputKeyDown(bandKey, 1)}
        aria-label={`${bandKey.toUpperCase()}上限`}
      />
      <span className={unitClassName}>Hz</span>
    </div>
  )
}
