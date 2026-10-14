import { useId, useRef, type CSSProperties } from 'react'
import { BandValidationBubble } from './mobile/BandValidationBubble'
import { BAND_INPUT_LIMITS } from '../config/analysisRanges'
import { bandKeyToId } from '../hooks/usePresetBands'
import type { BandKey, PresetBandsApi } from '../hooks/usePresetBands'

export interface BandRangeRowProps {
  bandKey: BandKey
  localValues: PresetBandsApi['localValues']
  inputMessages?: PresetBandsApi['inputMessages']
  onDismissMessage?: (index: 0 | 1) => void
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
  inputMessages = {},
  onDismissMessage,
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
  const messageId = useId()
  const lowerRef = useRef<HTMLInputElement>(null)
  const upperRef = useRef<HTMLInputElement>(null)
  const [loClassName, hiClassName] = Array.isArray(inputClassName)
    ? inputClassName
    : [inputClassName, inputClassName]

  return (
    <div className={className} data-band={bandKey} style={style}>
      <span className={keyClassName}>{bandKey.toUpperCase()}</span>
      <input
        ref={lowerRef}
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
        aria-describedby={inputMessages[bandKeyToId(bandKey, 0)] ? `${messageId}-0` : undefined}
        style={inputMessages[bandKeyToId(bandKey, 0)] ? { boxShadow: 'inset 0 0 0 1px #F59E0B' } : undefined}
      />
      <span className={dashClassName}>—</span>
      <input
        ref={upperRef}
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
        aria-describedby={inputMessages[bandKeyToId(bandKey, 1)] ? `${messageId}-1` : undefined}
        style={inputMessages[bandKeyToId(bandKey, 1)] ? { boxShadow: 'inset 0 0 0 1px #F59E0B' } : undefined}
      />
      <span className={unitClassName}>Hz</span>
      {([0, 1] as const).map(index => inputMessages[bandKeyToId(bandKey, index)] && (
        <BandValidationBubble key={index} id={`${messageId}-${index}`} message={inputMessages[bandKeyToId(bandKey, index)]}
          index={index} anchor={index === 0 ? lowerRef.current : upperRef.current} onClose={() => onDismissMessage?.(index)} />
      ))}
    </div>
  )
}
