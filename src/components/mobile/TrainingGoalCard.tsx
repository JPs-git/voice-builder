import { useId, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { bandKeyToId, usePresetBands } from '../../hooks/usePresetBands'
import { BAND_INPUT_LIMITS } from '../../config/analysisRanges'
import { VOWEL_PRESETS, presetShortLabel } from '../../types'
import { BandRangeSlider } from './BandRangeSlider'
import { BandValidationBubble } from './BandValidationBubble'
import styles from './TrainingGoalCard.module.css'

const BAND_NAMES = { f0: '基频', f1: '第一共振峰', f2: '第二共振峰' } as const

export function TrainingGoalCard() {
  const messageId = useId()
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const bands = useAppStore(s => s.bands)
  const { localValues, inputMessages, showInputMessage, onInputChange, onSliderChange, onCommit, onInputKeyDown, onReset } = usePresetBands()

  return (
    <section className={styles.card} aria-label="训练目标" data-testid="training-goal-card">
      <div className={styles.intro}>
        <p className={styles.description}>选择元音，调整目标频率范围</p>
        <button type="button" className={styles.reset} aria-label="重置所有预设" title="恢复全部元音默认值"
          onClick={onReset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10a9 9 0 1 1 2.6 8.4" />
            <path d="M3 4v6h6" />
          </svg>
        </button>
      </div>
      <div className={styles.vowelLabel}>元音选择</div>
      <div className={styles.vowels} role="group" aria-label="元音预设">
        {Object.keys(VOWEL_PRESETS).map(key => (
          <button key={key} type="button" aria-pressed={activePreset === key}
            className={styles.vowel} onClick={() => switchPreset(key)}>
            {presetShortLabel(key)}
          </button>
        ))}
      </div>
      <div className={styles.bands}>
        {(['f0', 'f1', 'f2'] as const).map(key => (
          <div key={key} className={`${styles.band} ${styles[key]}`}>
            <div className={styles.bandHeader}>
              <h4 className={styles.bandTitle}><span className={styles.dot} />{key.toUpperCase()} <span>{BAND_NAMES[key]}</span></h4>
            </div>
            <div className={styles.inputs}>
              {([0, 1] as const).map(index => (
                <label key={index} className={styles.inputLabel}>
                  <span>{index === 0 ? '下限' : '上限'}</span>
                  <span className={`${styles.inputBox} ${inputMessages[bandKeyToId(key, index)] ? styles.inputWarning : ''}`}>
                    <input type="number" inputMode="decimal" {...BAND_INPUT_LIMITS[key]}
                      ref={node => { inputRefs.current[bandKeyToId(key, index)] = node }}
                      aria-label={`${key.toUpperCase()}${index === 0 ? '下限' : '上限'}`}
                      aria-describedby={inputMessages[bandKeyToId(key, index)] ? `${messageId}-${key}-${index}` : undefined}
                      value={localValues[bandKeyToId(key, index)]}
                      onChange={event => onInputChange(key, index, event.target.value)}
                      onBlur={() => onCommit(key, index)} onKeyDown={onInputKeyDown(key, index)} />
                    <span className={styles.unit}>Hz</span>
                  </span>
                </label>
              ))}
              {([0, 1] as const).map(index => inputMessages[bandKeyToId(key, index)] && (
                <BandValidationBubble key={index} id={`${messageId}-${key}-${index}`} index={index}
                  anchor={inputRefs.current[bandKeyToId(key, index)]}
                  message={inputMessages[bandKeyToId(key, index)]} onClose={() => showInputMessage(key, index, '')} />
              ))}
            </div>
            <BandRangeSlider bandKey={key} value={bands[key].range}
              onChange={(index, number) => onSliderChange(key, index, number)}
              onBoundary={(index, message) => showInputMessage(key, index, message)} />
          </div>
        ))}
      </div>
      <p className={styles.hint}>滑杆实时生效，输入数值后离开输入框生效</p>
    </section>
  )
}
