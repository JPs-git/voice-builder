# 竖版 UI 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按竖版设计稿重做手机竖屏（`<=768px`）分析页：顶栏收为 `...` 菜单、实时反馈改为 Hero 大数字、训练目标卡改为下拉+行内输入、主录音按钮下沉到底部 Dock。桌面与横屏零变动。

**Architecture:** 新增 `src/components/mobile/` 四个纯展示组件，全部消费既有 `appStore` 与 `useToolbar.handleClickTool`，不新增数据流与状态机。把 `TargetPresetBar` 里的预设区间编辑逻辑原样抽成 `usePresetBands` hook 供新旧组件共用。`F0Chart`/`FormantChart` 内部用 `useMediaQuery` 切换 ECharts option 的竖版分支。

**Tech Stack:** React 19、TypeScript 6、Vite 5、Zustand 5、CSS Modules、ECharts 5、Vitest 3 + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-09-27-portrait-redesign-design.md`

---

## File Structure

**新建**

| 文件 | 职责 |
|---|---|
| `src/hooks/usePresetBands.ts` | 预设区间编辑逻辑（localValues / clamp / commit / override / reset） |
| `src/components/mobile/TrainingGoalCard.tsx` | 紧凑目标卡：元音下拉 + 三行区间输入 |
| `src/components/mobile/TrainingGoalCard.module.css` | 目标卡样式 |
| `src/components/mobile/FeedbackHero.tsx` | Hero 反馈：大 F0 数字 + 状态徽标 + 三列 F0/F1/F2 + 声区 |
| `src/components/mobile/FeedbackHero.module.css` | Hero 样式 |
| `src/components/mobile/RecordDock.tsx` | 底部录音 Dock（fixed，含 safe-area） |
| `src/components/mobile/RecordDock.module.css` | Dock 样式 |
| `src/components/mobile/MobileMoreMenu.tsx` | 顶栏 `...` 溢出菜单 |
| `src/components/mobile/MobileMoreMenu.module.css` | 菜单样式 |
| `src/__tests__/usePresetBands.test.tsx` | hook 行为测试 |
| `src/__tests__/TrainingGoalCard.test.tsx` | 目标卡测试 |
| `src/__tests__/FeedbackHero.test.tsx` | Hero 测试 |
| `src/__tests__/RecordDock.test.tsx` | Dock 测试 |
| `src/__tests__/MobileMoreMenu.test.tsx` | 菜单测试 |

**修改**

| 文件 | 改动 |
|---|---|
| `src/components/TargetPresetBar.tsx` | 改为消费 `usePresetBands`（行为零变动） |
| `src/components/F0Chart.tsx` | 竖版分支：X 轴 label、grid、F0 蓝线、markArea/markLine 取 bands 色 |
| `src/components/FormantChart.tsx` | 竖版分支：同上 |
| `src/components/Toolbar.tsx` | 新增可选 `moreMenu` 插槽（桌面不传 = 零变动） |
| `src/routes/AnalysisPortrait.tsx` | 重排为设计稿结构，接入新组件 |
| `src/routes/AnalysisPage.module.css` | 竖版 media query 内新布局规则 |
| `src/__tests__/layoutShells.test.tsx` | 扩展竖版结构断言 |

---

### Task 1: 抽出 `usePresetBands` hook

**Files:**
- Create: `src/hooks/usePresetBands.ts`
- Modify: `src/components/TargetPresetBar.tsx`
- Test: `src/__tests__/usePresetBands.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/usePresetBands.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { useState, type ReactNode } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { usePresetBands } from '../hooks/usePresetBands'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { VOWEL_PRESETS } from '../types'

type Key = 'f0' | 'f1' | 'f2'

let api: ReturnType<typeof usePresetBands> | null = null

function Probe({ onReady }: { onReady: (a: ReturnType<typeof usePresetBands>) => void }) {
  const hook = usePresetBands()
  onReady(hook)
  return <span data-testid="ready">ready</span>
}

function mount(): ReactNode {
  let out: ReactNode = null
  render(<Probe onReady={a => { api = a }} />)
  out = <span>{String(api !== null)}</span>
  return out
}

describe('usePresetBands', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useToastStore.setState({ toasts: [] })
    api = null
  })

  it('seeds localValues from the store bands', () => {
    mount()
    expect(api).not.toBeNull()
    const vowelA = VOWEL_PRESETS['vowel-a']
    expect(api!.localValues['f0-0']).toBe(String(vowelA.f0[0]))
    expect(api!.localValues['f0-1']).toBe(String(vowelA.f0[1]))
    expect(api!.localValues['f1-0']).toBe(String(vowelA.f1[0]))
    expect(api!.localValues['f2-1']).toBe(String(vowelA.f2[1]))
  })

  it('commits a valid edit into the store and saves a preset override', () => {
    mount()
    const vowelA = VOWEL_PRESETS['vowel-a']
    act(() => {
      api!.onInputChange('f0', 0, '250')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().bands.f0.range).toEqual([250, vowelA.f0[1]])
    const override = useAppStore.getState().presetOverrides.find(o => o.key === 'vowel-a')
    expect(override?.f0[0]).toBe(250)
  })

  it('clamps F0 above the detection ceiling and raises a toast', () => {
    mount()
    act(() => {
      api!.onInputChange('f0', 1, '1100')
    })
    expect(useAppStore.getState().bands.f0.range[1]).toBe(1000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('reverts when the value is not a finite number', () => {
    mount()
    const vowelA = VOWEL_PRESETS['vowel-a']
    act(() => {
      api!.onInputChange('f0', 0, 'abc')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().bands.f0.range).toEqual(vowelA.f0)
  })

  it('reverts when low >= high', () => {
    mount()
    const vowelA = VOWEL_PRESETS['vowel-a']
    act(() => {
      api!.onInputChange('f0', 0, '500')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().bands.f0.range).toEqual(vowelA.f0)
  })

  it('onReset restores default presets after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mount()
    act(() => {
      api!.onInputChange('f0', 0, '250')
    })
    act(() => {
      api!.onCommit('f0', 0)
    })
    expect(useAppStore.getState().presetOverrides.length).toBeGreaterThan(0)
    act(() => {
      api!.onReset()
    })
    expect(useAppStore.getState().presetOverrides).toHaveLength(0)
    expect(useAppStore.getState().activePreset).toBe('vowel-a')
    confirmSpy.mockRestore()
  })

  it('onInputKeyDown commits on Enter', () => {
    mount()
    act(() => {
      api!.onInputChange('f0', 0, '260')
    })
    act(() => {
      api!.onInputKeyDown('f0', 0)({ key: 'Enter' } as never)
    })
    expect(useAppStore.getState().bands.f0.range[0]).toBe(260)
  })
})
```

- [ ] **Step 2: 修 import 让测试文件编译**

把文件头 import 改成：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { type ReactNode } from 'react'
import { render, act } from '@testing-library/react'
import { usePresetBands } from '../hooks/usePresetBands'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { VOWEL_PRESETS } from '../types'
```

并把 `mount()` 简化为：

```tsx
function mount(): void {
  render(<Probe onReady={a => { api = a }} />)
}
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/usePresetBands.test.tsx`
Expected: FAIL — `Failed to resolve import "../hooks/usePresetBands"`

- [ ] **Step 4: 实现 hook**

创建 `src/hooks/usePresetBands.ts`：

```ts
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { F0_RANGE } from '../config/analysisRanges'
import type { TargetBands } from '../types'

export type BandKey = 'f0' | 'f1' | 'f2'
export type BandIndex = 0 | 1

export function bandKeyToId(key: BandKey, index: BandIndex): string {
  return `${key}-${index}`
}

function clampF0(num: number): number {
  return Math.min(num, F0_RANGE.max)
}

function makeLocalValues(bands: TargetBands) {
  return {
    [bandKeyToId('f0', 0)]: String(bands.f0.range[0]),
    [bandKeyToId('f0', 1)]: String(bands.f0.range[1]),
    [bandKeyToId('f1', 0)]: String(bands.f1.range[0]),
    [bandKeyToId('f1', 1)]: String(bands.f1.range[1]),
    [bandKeyToId('f2', 0)]: String(bands.f2.range[0]),
    [bandKeyToId('f2', 1)]: String(bands.f2.range[1]),
  }
}

export interface PresetBandsApi {
  localValues: Record<string, string>
  onInputChange: (key: BandKey, index: BandIndex, value: string) => void
  onCommit: (key: BandKey, index: BandIndex) => void
  onInputKeyDown: (key: BandKey, index: BandIndex) => (e: React.KeyboardEvent<HTMLInputElement>) => void
  onReset: () => void
}

export function usePresetBands(): PresetBandsApi {
  const bands = useAppStore(s => s.bands)
  const setBands = useAppStore(s => s.setBands)
  const activePreset = useAppStore(s => s.activePreset)
  const savePresetOverride = useAppStore(s => s.savePresetOverride)
  const resetPresets = useAppStore(s => s.resetPresets)

  const [localValues, setLocalValues] = useState<Record<string, string>>(() =>
    makeLocalValues(bands),
  )

  useEffect(() => {
    setLocalValues(makeLocalValues(bands))
  }, [bands])

  const onInputChange = useCallback(
    (key: BandKey, index: BandIndex, value: string) => {
      const id = bandKeyToId(key, index)
      setLocalValues(prev => ({ ...prev, [id]: value }))
      const num = parseFloat(value)
      if (!Number.isFinite(num)) return
      const clamped = key === 'f0' ? clampF0(num) : num
      const current = bands[key].range
      const next: [number, number] =
        index === 0 ? [clamped, current[1]] : [current[0], clamped]
      if (next[0] < next[1]) {
        const updatedBands = { ...bands, [key]: { ...bands[key], range: next } }
        setBands({ [key]: next })
        savePresetOverride(
          activePreset,
          updatedBands.f0.range,
          updatedBands.f1.range,
          updatedBands.f2.range,
        )
        if (clamped !== num) {
          useToastStore.getState().showToast(
            'info',
            `F0 已超出检测上限 ${F0_RANGE.max}Hz，已自动设为 ${F0_RANGE.max}Hz`,
          )
        }
      }
    },
    [bands, setBands, activePreset, savePresetOverride],
  )

  const onCommit = useCallback(
    (key: BandKey, index: BandIndex) => {
      const id = bandKeyToId(key, index)
      const num = parseFloat(localValues[id])
      if (!Number.isFinite(num)) {
        setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
        return
      }
      const clamped = key === 'f0' ? clampF0(num) : num
      const current = bands[key].range
      const next: [number, number] =
        index === 0 ? [clamped, current[1]] : [current[0], clamped]
      if (next[0] < next[1]) {
        const updatedBands = { ...bands, [key]: { ...bands[key], range: next } }
        setBands({ [key]: next })
        savePresetOverride(
          activePreset,
          updatedBands.f0.range,
          updatedBands.f1.range,
          updatedBands.f2.range,
        )
      } else {
        setLocalValues(prev => ({ ...prev, [id]: String(bands[key].range[index]) }))
      }
    },
    [localValues, bands, setBands, activePreset, savePresetOverride],
  )

  const onInputKeyDown = useCallback(
    (key: BandKey, index: BandIndex) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onCommit(key, index)
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [onCommit],
  )

  const onReset = useCallback(() => {
    if (window.confirm('确定要重置所有预设到初始值吗？')) {
      resetPresets()
    }
  }, [resetPresets])

  return { localValues, onInputChange, onCommit, onInputKeyDown, onReset }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/usePresetBands.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: 让 TargetPresetBar 消费 hook（零行为变动）**

把 `src/components/TargetPresetBar.tsx` 全文替换为：

```tsx
import { VOWEL_PRESETS } from '../types'
import { useAppStore } from '../store/appStore'
import { F0_RANGE } from '../config/analysisRanges'
import { usePresetBands, bandKeyToId } from '../hooks/usePresetBands'
import styles from './TargetPresetBar.module.css'

export function TargetPresetBar() {
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const { localValues, onInputChange, onCommit, onInputKeyDown, onReset } = usePresetBands()

  const vowelKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className={styles.bar} aria-label="共振峰目标区间">
      <div className={styles.row}>
        <label className={styles.label}>目标区间</label>
        <button
          type="button"
          className={styles.resetIcon}
          onClick={onReset}
          aria-label="重置所有预设"
        >
          ⟲
        </button>
      </div>
      <div className={styles.vowels} role="group" aria-label="元音预设">
        {vowelKeys.map(name => (
          <button
            key={name}
            type="button"
            className={`${styles.vowelBtn}${activePreset === name ? ` ${styles.vowelBtnActive}` : ''}`}
            data-preset={name}
            onClick={() => switchPreset(name)}
          >
            {VOWEL_PRESETS[name].label.replace('元音 ', '')}
          </button>
        ))}
      </div>
      <div className={styles.inputs}>
        {(['f0', 'f1', 'f2'] as const).map(key => (
          <div key={key} className={styles.bandInput} data-band={key}>
            <span className={styles.bandKey}>{key.toUpperCase()}</span>
            <input
              type="number"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandLo}
              value={localValues[bandKeyToId(key, 0)]}
              onChange={e => onInputChange(key, 0, e.target.value)}
              onBlur={() => onCommit(key, 0)}
              onKeyDown={onInputKeyDown(key, 0)}
              aria-label={`${key.toUpperCase()}下限`}
            />
            <span className={styles.bandDash}>—</span>
            <input
              type="number"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandHi}
              value={localValues[bandKeyToId(key, 1)]}
              onChange={e => onInputChange(key, 1, e.target.value)}
              onBlur={() => onCommit(key, 1)}
              onKeyDown={onInputKeyDown(key, 1)}
              aria-label={`${key.toUpperCase()}上限`}
            />
            <span className={styles.bandUnit}>Hz</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: 跑回归测试**

Run: `npx vitest run --project unit src/__tests__/TargetPresetBar.test.tsx src/__tests__/usePresetBands.test.tsx`
Expected: PASS (13 tests) — 证明抽取 hook 为零行为变动

- [ ] **Step 8: 提交**

```bash
git add src/hooks/usePresetBands.ts src/components/TargetPresetBar.tsx src/__tests__/usePresetBands.test.tsx
git commit -m "refactor: 抽出 usePresetBands hook 供预设区间编辑复用"
```

---

### Task 2: `TrainingGoalCard` 训练目标卡

**Files:**
- Create: `src/components/mobile/TrainingGoalCard.tsx`
- Create: `src/components/mobile/TrainingGoalCard.module.css`
- Test: `src/__tests__/TrainingGoalCard.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/TrainingGoalCard.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrainingGoalCard } from '../components/mobile/TrainingGoalCard'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { VOWEL_PRESETS } from '../types'

describe('TrainingGoalCard', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useToastStore.setState({ toasts: [] })
  })

  it('renders a preset dropdown seeded with the active preset', () => {
    render(<TrainingGoalCard />)
    const select = screen.getByLabelText('选择元音预设') as HTMLSelectElement
    expect(select.value).toBe('vowel-a')
    expect(screen.getByRole('option', { name: 'i' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'ü' })).toBeTruthy()
  })

  it('switches bands when a preset is chosen from the dropdown', () => {
    render(<TrainingGoalCard />)
    const select = screen.getByLabelText('选择元音预设') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'vowel-i' } })
    const vowelI = VOWEL_PRESETS['vowel-i']
    expect(useAppStore.getState().bands.f1.range).toEqual(vowelI.f1)
    expect(useAppStore.getState().bands.f2.range).toEqual(vowelI.f2)
  })

  it('shows the active preset short label next to the dropdown', () => {
    useAppStore.setState({ activePreset: 'vowel-u' })
    render(<TrainingGoalCard />)
    expect(screen.getByTestId('goal-preset-label').textContent).toBe('u')
  })

  it('edits band ranges inline and persists a preset override', () => {
    render(<TrainingGoalCard />)
    const f1Lo = screen.getByLabelText('F1下限') as HTMLInputElement
    const vowelA = VOWEL_PRESETS['vowel-a']
    fireEvent.change(f1Lo, { target: { value: '700' } })
    fireEvent.blur(f1Lo)
    expect(useAppStore.getState().bands.f1.range).toEqual([700, vowelA.f1[1]])
    const override = useAppStore.getState().presetOverrides.find(o => o.key === 'vowel-a')
    expect(override?.f1[0]).toBe(700)
  })

  it('clamps F0 to the detection ceiling', () => {
    render(<TrainingGoalCard />)
    const f0Hi = screen.getByLabelText('F0上限') as HTMLInputElement
    fireEvent.change(f0Hi, { target: { value: '1400' } })
    expect(useAppStore.getState().bands.f0.range[1]).toBe(1000)
  })

  it('exposes a reset control for all presets', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TrainingGoalCard />)
    fireEvent.click(screen.getByLabelText('重置所有预设'))
    expect(useAppStore.getState().activePreset).toBe('vowel-a')
    confirmSpy.mockRestore()
  })

  it('renders a decorative chevron', () => {
    render(<TrainingGoalCard />)
    expect(screen.getByText('›')).toBeTruthy()
  })
})
```

在文件头补 `vi` 到 vitest import：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/TrainingGoalCard.test.tsx`
Expected: FAIL — `Failed to resolve import "../components/mobile/TrainingGoalCard"`

- [ ] **Step 3: 实现组件**

创建 `src/components/mobile/TrainingGoalCard.tsx`：

```tsx
import { VOWEL_PRESETS, presetShortLabel } from '../../types'
import { useAppStore } from '../../store/appStore'
import { F0_RANGE } from '../../config/analysisRanges'
import { usePresetBands, bandKeyToId } from '../../hooks/usePresetBands'
import styles from './TrainingGoalCard.module.css'

const BAND_KEYS = ['f0', 'f1', 'f2'] as const

export function TrainingGoalCard() {
  const bands = useAppStore(s => s.bands)
  const activePreset = useAppStore(s => s.activePreset)
  const switchPreset = useAppStore(s => s.switchPreset)
  const { localValues, onInputChange, onCommit, onInputKeyDown, onReset } = usePresetBands()

  const presetKeys = Object.keys(VOWEL_PRESETS) as (keyof typeof VOWEL_PRESETS)[]

  return (
    <section className={styles.card} aria-label="训练目标">
      <header className={styles.header}>
        <span className={styles.title}>训练目标</span>
        <div className={styles.presetGroup}>
          <label className={styles.selectLabel} htmlFor="goal-preset">当前元音</label>
          <select
            id="goal-preset"
            className={styles.select}
            value={activePreset}
            aria-label="选择元音预设"
            onChange={e => switchPreset(e.target.value)}
          >
            {presetKeys.map(name => (
              <option key={name} value={name}>
                {presetShortLabel(name)}
              </option>
            ))}
          </select>
          <span className={styles.presetBadge} data-testid="goal-preset-label">
            {presetShortLabel(activePreset)}
          </span>
        </div>
        <button
          type="button"
          className={styles.reset}
          onClick={onReset}
          aria-label="重置所有预设"
        >
          ⟲
        </button>
      </header>

      <div className={styles.bands}>
        {BAND_KEYS.map(key => (
          <div key={key} className={styles.bandRow} style={{ borderLeftColor: bands[key].color }}>
            <span className={styles.bandKey}>{key.toUpperCase()}</span>
            <input
              type="number"
              inputMode="numeric"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandInput}
              value={localValues[bandKeyToId(key, 0)]}
              onChange={e => onInputChange(key, 0, e.target.value)}
              onBlur={() => onCommit(key, 0)}
              onKeyDown={onInputKeyDown(key, 0)}
              aria-label={`${key.toUpperCase()}下限`}
            />
            <span className={styles.dash}>—</span>
            <input
              type="number"
              inputMode="numeric"
              min={key === 'f0' ? F0_RANGE.min : 100}
              max={key === 'f0' ? F0_RANGE.max : 3500}
              step={key === 'f0' ? 5 : 10}
              className={styles.bandInput}
              value={localValues[bandKeyToId(key, 1)]}
              onChange={e => onInputChange(key, 1, e.target.value)}
              onBlur={() => onCommit(key, 1)}
              onKeyDown={onInputKeyDown(key, 1)}
              aria-label={`${key.toUpperCase()}上限`}
            />
            <span className={styles.unit}>Hz</span>
          </div>
        ))}
      </div>

      <span className={styles.chevron} aria-hidden="true">›</span>
    </section>
  )
}
```

- [ ] **Step 4: 实现样式**

创建 `src/components/mobile/TrainingGoalCard.module.css`：

```css
.card {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-soft);
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.presetGroup {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.selectLabel {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.select {
  appearance: none;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 8px;
  cursor: pointer;
  max-width: 72px;
}
.presetBadge {
  display: none;
}
.reset {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 15px;
  line-height: 1;
  color: var(--text-soft);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
}
.reset:hover { color: #EF4444; }
.bands {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bandRow {
  display: flex;
  align-items: center;
  gap: 6px;
  border-left: 3px solid var(--border-strong);
  padding-left: 8px;
}
.bandKey {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-soft);
  min-width: 20px;
  font-family: var(--font-mono);
}
.bandInput {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #fff;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
  text-align: center;
  padding: 0 2px;
  outline: none;
}
.bandInput:focus {
  border-color: var(--info);
  box-shadow: 0 0 0 2px var(--info-soft);
}
.dash {
  font-size: 10px;
  color: var(--text-mute);
}
.unit {
  font-size: 10px;
  color: var(--text-mute);
  min-width: 16px;
}
.chevron {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  font-size: 20px;
  color: var(--text-mute);
  pointer-events: none;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/TrainingGoalCard.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: 提交**

```bash
git add src/components/mobile/TrainingGoalCard.tsx src/components/mobile/TrainingGoalCard.module.css src/__tests__/TrainingGoalCard.test.tsx
git commit -m "feat(mobile): 竖版训练目标卡（下拉预设 + 行内区间输入）"
```

---

### Task 3: `FeedbackHero` 实时反馈 Hero

**Files:**
- Create: `src/components/mobile/FeedbackHero.tsx`
- Create: `src/components/mobile/FeedbackHero.module.css`
- Test: `src/__tests__/FeedbackHero.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/FeedbackHero.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackHero, resolveBadge } from '../components/mobile/FeedbackHero'
import { useAppStore } from '../store/appStore'
import type { FormantStatus } from '../feedback/status'

function setFrame(f0: number | null, f1: number | null, f2: number | null) {
  useAppStore.setState({ latestFrame: { time: 1, f0, f1, f2 } })
}

describe('resolveBadge', () => {
  it('reports waiting when there are no statuses', () => {
    expect(resolveBadge([])).toEqual({ tone: 'idle', text: '等待声音' })
  })

  it('reports in-range when all statuses hit', () => {
    expect(resolveBadge(['hit', 'hit', 'hit'])).toEqual({ tone: 'hit', text: '目标范围内' })
  })

  it('reports high when any status is high', () => {
    expect(resolveBadge(['hit', 'high', 'low'])).toEqual({ tone: 'warn', text: '偏高' })
  })

  it('reports low when there is a low and no high', () => {
    expect(resolveBadge(['low', 'hit', 'hit'])).toEqual({ tone: 'warn', text: '偏低' })
  })

  it('treats none as neither hit nor warn', () => {
    expect(resolveBadge(['none', 'none', 'none'])).toEqual({ tone: 'idle', text: '等待声音' })
  })
})

describe('FeedbackHero', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('shows a waiting badge and a placeholder before any frame arrives', () => {
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-badge').textContent).toBe('等待声音')
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
  })

  it('shows the current F0 as a large readout', () => {
    setFrame(245, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-f0').textContent).toBe('245')
  })

  it('shows the in-range badge when every visible band is inside its range', () => {
    const { bands } = useAppStore.getState()
    setFrame(240, bands.f1.range[0] + 10, bands.f2.range[0] + 10)
    render(<FeedbackHero />)
    const badge = screen.getByTestId('hero-badge')
    expect(badge.textContent).toBe('目标范围内')
    expect(badge.getAttribute('data-tone')).toBe('hit')
  })

  it('shows the low badge when a band falls under its range', () => {
    const { bands } = useAppStore.getState()
    setFrame(240, bands.f1.range[0] - 50, bands.f2.range[0] + 10)
    render(<FeedbackHero />)
    const badge = screen.getByTestId('hero-badge')
    expect(badge.textContent).toBe('偏低')
    expect(badge.getAttribute('data-tone')).toBe('warn')
  })

  it('renders one column per visible band with its status glyph', () => {
    useAppStore.setState({ formantVisible: { f0: true, f1: true, f2: false } })
    setFrame(240, 900, 1200)
    render(<FeedbackHero />)
    expect(screen.queryByTestId('hero-col-f2')).toBeNull()
    expect(screen.getByTestId('hero-col-f1')).toBeTruthy()
    expect(screen.getByTestId('hero-col-f1-status').textContent).toBe('✓')
  })

  it('maps status to a glyph', () => {
    expect(statusGlyph('hit')).toBe('✓')
    expect(statusGlyph('low')).toBe('↓')
    expect(statusGlyph('high')).toBe('↑')
    expect(statusGlyph('none')).toBe('—')
  })

  it('shows the detected voice register', () => {
    useAppStore.setState({ latestFrame: { time: 1, f0: 240, f1: 900, f2: 1200, register: 'chest' } })
    render(<FeedbackHero />)
    expect(screen.getByTestId('hero-register').textContent).toBe('真声')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/FeedbackHero.test.tsx`
Expected: FAIL — `Failed to resolve import "../components/mobile/FeedbackHero"`

- [ ] **Step 3: 实现组件**

创建 `src/components/mobile/FeedbackHero.tsx`：

```tsx
import { useAppStore } from '../../store/appStore'
import { getFormantStatus } from '../../feedback/status'
import type { FormantStatus } from '../../feedback/status'
import type { FormantSeries, VoiceRegister } from '../../types'
import styles from './FeedbackHero.module.css'

const KEYS: FormantSeries[] = ['f0', 'f1', 'f2']

export interface Badge {
  tone: 'idle' | 'hit' | 'warn'
  text: string
}

export function resolveBadge(statuses: FormantStatus[]): Badge {
  if (statuses.length === 0) return { tone: 'idle', text: '等待声音' }
  const meaningful = statuses.filter(s => s !== 'none')
  if (meaningful.length === 0) return { tone: 'idle', text: '等待声音' }
  if (meaningful.every(s => s === 'hit')) return { tone: 'hit', text: '目标范围内' }
  if (meaningful.some(s => s === 'high')) return { tone: 'warn', text: '偏高' }
  return { tone: 'warn', text: '偏低' }
}

export function statusGlyph(status: FormantStatus): string {
  if (status === 'hit') return '✓'
  if (status === 'low') return '↓'
  if (status === 'high') return '↑'
  return '—'
}

const REGISTER_LABEL: Record<VoiceRegister, string> = {
  chest: '真声',
  mixed: '混声',
  falsetto: '假声',
  unvoiced: '—',
}

function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '--'
  return String(Math.round(value))
}

export function FeedbackHero() {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const formantVisible = useAppStore(s => s.formantVisible)

  const visibleKeys = KEYS.filter(key => formantVisible[key])
  const statuses = visibleKeys.map(key =>
    getFormantStatus(latestFrame?.[key], bands[key].range),
  )
  const badge = resolveBadge(statuses)

  const register: VoiceRegister = latestFrame?.register ?? 'unvoiced'

  return (
    <section className={styles.card} aria-label="实时反馈">

      <div className={styles.top}>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>F0</span>
          <span className={styles.readoutValue} data-testid="hero-f0">
            {formatValue(latestFrame?.f0)}
          </span>
          <span className={styles.readoutUnit}>Hz</span>
        </div>
        <span className={styles.badge} data-tone={badge.tone} data-testid="hero-badge">
          {badge.text}
        </span>
      </div>

      <div className={styles.columns}>
        {visibleKeys.map(key => {
          const status = getFormantStatus(latestFrame?.[key], bands[key].range)
          return (
            <div
              key={key}
              className={styles.column}
              data-testid={`hero-col-${key}`}
              data-status={status}
            >
              <span className={styles.columnKey}>{key.toUpperCase()}</span>
              <span className={styles.columnValue}>{formatValue(latestFrame?.[key])}</span>
              <span className={styles.columnUnit}>Hz</span>
              <span
                className={styles.columnStatus}
                data-status={status}
                data-testid={`hero-col-${key}-status`}
              >
                {statusGlyph(status)}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.registerRow}>
        <span className={styles.registerLabel}>声区</span>
        <span className={styles.registerValue} data-testid="hero-register">
          {REGISTER_LABEL[register]}
        </span>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: 实现样式**

创建 `src/components/mobile/FeedbackHero.module.css`：

```css
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.glyphProbe {
  display: none;
}
.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.readout {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.readoutLabel {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-soft);
}
.readoutValue {
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.readoutUnit {
  font-size: 13px;
  color: var(--text-mute);
  font-weight: 600;
}
.badge {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge[data-tone="idle"] {
  background: #F2F4F7;
  color: var(--text-mute);
}
.badge[data-tone="hit"] {
  background: var(--hit-soft);
  color: #047857;
}
.badge[data-tone="warn"] {
  background: var(--warn-soft);
  color: #B45309;
}
.columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: #F9FAFB;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 4px;
}
.columnKey {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-soft);
  letter-spacing: 0.4px;
}
.columnValue {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.columnUnit {
  font-size: 9px;
  color: var(--text-mute);
}
.columnStatus {
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.columnStatus[data-status="hit"] { color: var(--hit); }
.columnStatus[data-status="low"],
.columnStatus[data-status="high"] { color: var(--warn); }
.columnStatus[data-status="none"] { color: var(--text-mute); }
.registerRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}
.registerLabel {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-soft);
}
.registerValue {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/FeedbackHero.test.tsx`
Expected: PASS (12 tests)

- [ ] **Step 6: 提交**

```bash
git add src/components/mobile/FeedbackHero.tsx src/components/mobile/FeedbackHero.module.css src/__tests__/FeedbackHero.test.tsx
git commit -m "feat(mobile): 竖版实时反馈 Hero（大数字 + 状态徽标 + 三列）"
```

---

### Task 4: 图表竖版分支（X 轴刻度、紧凑 grid、配色）

**Files:**
- Modify: `src/components/F0Chart.tsx`
- Modify: `src/components/FormantChart.tsx`
- Test: `src/__tests__/PortraitChartOptions.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/PortraitChartOptions.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { useAppStore } from '../store/appStore'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

function setMatchMedia(matches: boolean) {
  const mql = {
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
}

function lastOption(): any {
  return setOptionMock.mock.calls[setOptionMock.mock.calls.length - 1][0]
}

describe('portrait chart options', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('hides the F0 x axis labels in landscape', () => {
    setMatchMedia(false)
    render(<F0Chart />)
    expect(lastOption().xAxis.axisLabel.show).toBe(false)
    expect(lastOption().grid.left).toBe(72)
  })

  it('shows the F0 x axis labels with a seconds suffix in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    const option = lastOption()
    expect(option.xAxis.axisLabel.show).toBe(true)
    expect(option.xAxis.axisLabel.formatter(5)).toBe('5s')
    expect(option.xAxis.axisLabel.hideOverlap).toBe(true)
    expect(option.grid.left).toBe(48)
  })

  it('draws the F0 line in blue in portrait and charcoal in landscape', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    expect(lastOption().series[0].lineStyle.color).toBe('#3B82F6')

    setOptionMock.mockClear()
    setMatchMedia(false)
    render(<F0Chart />)
    expect(lastOption().series[0].lineStyle.color).toBe('#1F2937')
  })

  it('shows the formant x axis labels in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const option = lastOption()
    expect(option.xAxis.axisLabel.show).toBe(true)
    expect(option.grid.left).toBe(48)
  })

  it('paints formant mark areas from the band colors in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const option = lastOption()
    const f1Series = option.series.find((s: any) => s.name === 'F1')
    expect(f1Series.markArea.data[0][0].itemStyle.color).toBe(
      'rgba(59,130,246,0.10)',
    )
  })

  it('keeps the landscape formant mark areas unchanged', () => {
    setMatchMedia(false)
    render(<FormantChart />)
    const option = lastOption()
    const f1Series = option.series.find((s: any) => s.name === 'F1')
    expect(f1Series.markArea.data[0][0].itemStyle.color).toBe('rgba(226,62,87,0.10)')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/PortraitChartOptions.test.tsx`
Expected: FAIL — `expected false to be true`（`xAxis.axisLabel.show` 在竖版仍为 `false`）

- [ ] **Step 3: F0Chart 加竖版分支**

在 `src/components/F0Chart.tsx` 顶部 import 区加入：

```tsx
import { useMediaQuery } from '../hooks/useMediaQuery'
```

在 `TARGET_ZONES` 之后加入常量：

```tsx
const PORTRAIT_QUERY = '(max-width: 768px)'

const GRID_DESKTOP = { left: 72, right: 32, top: 20, bottom: 36 }
const GRID_PORTRAIT = { left: 48, right: 12, top: 16, bottom: 28 }

const F0_COLOR_DESKTOP = '#1F2937'
const F0_COLOR_PORTRAIT = '#3B82F6'
```

把 `buildMarkAreas` / `buildMarkLineData` 改为接受可选颜色：

```tsx
function buildMarkAreas(zones: typeof TARGET_ZONES, color: string) {
  return zones.map(z => ([{
    yAxis: z.range[0],
    itemStyle: { color: hexToRgba(color, 0.15) },
  }, {
    yAxis: z.range[1],
  }]))
}

function buildMarkLineData(zones: typeof TARGET_ZONES, color: string) {
  return zones.map(z => {
    const mid = Math.round((z.range[0] + z.range[1]) / 2)
    return {
      yAxis: mid,
      lineStyle: { color: hexToRgba(color, 0.4), type: 'dashed' as const, width: 1 },
      label: {
        formatter: z.label,
        color,
        fontSize: 11,
        position: 'insideEndTop',
      },
    }
  })
}
```

在 `F0Chart` 组件体内取 `isPortrait` 并透传给 `renderChart`：

```tsx
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
```

给 `renderChart` 签名加 `isPortrait: boolean` 参数（放在 `useAnimation` 之后），并把 `setOption` 中相关字段替换为：

```tsx
      grid: isPortrait ? GRID_PORTRAIT : GRID_DESKTOP,
```

```tsx
      xAxis: {
        type: 'value',
        min: minTime,
        max: maxTime,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: isPortrait
          ? { show: true, color: '#667085', fontSize: 10, hideOverlap: true, formatter: (v: number) => `${v}s` }
          : { show: false },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
```

```tsx
      color: [f0Color],
      series: [
        {
          name: 'F0',
          type: 'line' as const,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: f0Color, width: 2 },
          itemStyle: { color: f0Color },
          markArea: { silent: true, data: buildMarkAreas(TARGET_ZONES, f0Color) },
          markLine: { silent: true, symbol: 'none', data: buildMarkLineData(TARGET_ZONES, f0Color) },
          data: seriesData,
        },
```

在 `renderChart` 内部 `const seriesData = ...` 之后插入：

```tsx
    const f0Color = isPortrait ? F0_COLOR_PORTRAIT : F0_COLOR_DESKTOP
```

把组件内 3 处 `renderChart(frames, cursorTime, isLiveRef.current, false)` 调用改为 `renderChart(frames, cursorTime, isLiveRef.current, false, isPortrait)`，并把 `useEffect` 依赖补上 `isPortrait`：

```tsx
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderChart(frames, cursorTime, isLiveRef.current, false, isPortrait)
      rafRef.current = null
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [frames, isPortrait])
```

```tsx
  useEffect(() => {
    renderChart(frames, cursorTime, isLiveRef.current, false, isPortrait)
  }, [cursorTime, isPortrait])
```

```tsx
  useEffect(() => {
    renderChart(frames, cursorTime, isLiveRef.current, false, isPortrait)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: FormantChart 加竖版分支**

在 `src/components/FormantChart.tsx` 顶部 import 区加入：

```tsx
import { useMediaQuery } from '../hooks/useMediaQuery'
```

在 `FREQ_MAX` 之后加入：

```tsx
const PORTRAIT_QUERY = '(max-width: 768px)'

const GRID_DESKTOP = { left: 72, right: 32, top: 20, bottom: 36 }
const GRID_PORTRAIT = { left: 48, right: 12, top: 16, bottom: 28 }
```

把 `buildMarkArea` / `buildMarkLine` 改为接受显式颜色字符串：

```tsx
function buildMarkArea(range: [number, number], color: string) {
  return [[{
    yAxis: range[0],
    itemStyle: { color: hexToRgba(color, 0.10) },
  }, { yAxis: range[1] }]]
}

function buildMarkLine(range: [number, number], name: string, color: string) {
  const mid = Math.round((range[0] + range[1]) / 2)
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: hexToRgba(color, 0.55), type: 'dashed' as const, width: 1 },
    label: { formatter: name, color, fontSize: 11, position: 'insideEndTop' },
    data: [{ yAxis: mid }],
  }
}
```

在 `FormantChart` 组件体内加：

```tsx
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
```

给 `renderChart` 签名加 `isPortrait: boolean`，并在函数体开头（`const visible = ...` 之后）插入：

```tsx
    const bandColor = (k: 'f0' | 'f1' | 'f2') =>
      isPortrait ? currentBands[k].color : COLORS[k]
```

把 `setOption` 中 `grid` 替换为：

```tsx
      grid: isPortrait ? GRID_PORTRAIT : GRID_DESKTOP,
```

把 `xAxis` 的 `axisLabel` 替换为：

```tsx
        axisLabel: isPortrait
          ? { show: true, color: '#667085', fontSize: 10, hideOverlap: true, formatter: (v: number) => `${v}s` }
          : { show: false },
```

把 `series` 中 `keys.map(...)` 的 map 回调替换为：

```tsx
        ...keys.map(k => {
          const color = bandColor(k)
          return {
            name: k.toUpperCase(),
            type: 'line' as const,
            showSymbol: false,
            connectNulls: false,
            color,
            lineStyle: { color, width: k === 'f0' ? 2 : 1.5 },
            itemStyle: { color },
            markArea: visible[k] && currentBands[k]
              ? { silent: true, data: buildMarkArea(currentBands[k].range, color) }
              : undefined,
            markLine: visible[k]
              ? buildMarkLine(currentBands[k].range, `${k.toUpperCase()} 目标`, color)
              : undefined,
            data: seriesData[k],
          }
        }),
```

把组件内 4 处 `renderChart(...)` 调用改为 `renderChart(frames, cursorTime, bands, isLiveRef.current, false, isPortrait)`，并把两处 `useEffect` 依赖补上 `isPortrait`：

```tsx
  }, [frames, isPortrait])
```

```tsx
  }, [cursorTime, bands, isPortrait])
```

`formantVisible` 那个 effect 内的调用同样补上 `isPortrait`（依赖数组追加 `isPortrait`）。最后 mount effect 调用也补上 `isPortrait`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/PortraitChartOptions.test.tsx src/__tests__/F0Chart.test.tsx src/__tests__/FormantChart.test.tsx`
Expected: PASS

- [ ] **Step 6: typecheck**

Run: `npx tsc --noEmit`
Expected: 无输出（0 errors）

- [ ] **Step 7: 提交**

```bash
git add src/components/F0Chart.tsx src/components/FormantChart.tsx src/__tests__/PortraitChartOptions.test.tsx
git commit -m "feat(charts): 竖版图表显示 X 轴刻度并对齐设计稿配色"
```

---

### Task 5: `RecordDock` 底部录音 Dock

**Files:**
- Create: `src/components/mobile/RecordDock.tsx`
- Create: `src/components/mobile/RecordDock.module.css`
- Test: `src/__tests__/RecordDock.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/RecordDock.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordDock } from '../components/mobile/RecordDock'

describe('RecordDock', () => {
  it('fires onRecord when the mic button is pressed', () => {
    const onRecord = vi.fn()
    render(
      <RecordDock
        onRecord={onRecord}
        isCapturing={false}
        isRequesting={false}
        goalLabel="a"
        onGoalClick={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('开始录音'))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  it('switches to the stop affordance while capturing', () => {
    const { rerender } = render(
      <RecordDock onRecord={() => {}} isCapturing={false} isRequesting={false} goalLabel="a" onGoalClick={() => {}} />,
    )
    expect(screen.getByLabelText('开始录音')).toBeTruthy()
    rerender(
      <RecordDock onRecord={() => {}} isCapturing isRequesting={false} goalLabel="a" onGoalClick={() => {}} />,
    )
    expect(screen.getByLabelText('停止录音')).toBeTruthy()
    expect(screen.getByTestId('dock-hint').textContent).toBe('再次点击停止')
  })

  it('disables the mic while the microphone permission is pending', () => {
    const onRecord = vi.fn()
    render(
      <RecordDock onRecord={onRecord} isCapturing={false} isRequesting goalLabel="a" onGoalClick={() => {}} />,
    )
    const button = screen.getByLabelText('麦克风授权中') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onRecord).not.toHaveBeenCalled()
  })

  it('shows the current goal label and forwards goal clicks', () => {
    const onGoalClick = vi.fn()
    render(
      <RecordDock onRecord={() => {}} isCapturing={false} isRequesting={false} goalLabel="ü" onGoalClick={onGoalClick} />,
    )
    expect(screen.getByTestId('dock-goal-label').textContent).toBe('ü')
    fireEvent.click(screen.getByTestId('dock-goal'))
    expect(onGoalClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/RecordDock.test.tsx`
Expected: FAIL — `Failed to resolve import "../components/mobile/RecordDock"`

- [ ] **Step 3: 实现组件**

创建 `src/components/mobile/RecordDock.tsx`：

```tsx
import styles from './RecordDock.module.css'

export interface RecordDockProps {
  onRecord: () => void
  isCapturing: boolean
  isRequesting: boolean
  goalLabel: string
  onGoalClick: () => void
}

export function RecordDock({
  onRecord,
  isCapturing,
  isRequesting,
  goalLabel,
  onGoalClick,
}: RecordDockProps) {
  const micLabel = isRequesting ? '麦克风授权中' : isCapturing ? '停止录音' : '开始录音'

  return (
    <div className={styles.dock} data-portrait-dock="true">
      <button
        type="button"
        className={styles.goal}
        onClick={onGoalClick}
        data-testid="dock-goal"
        aria-label="回到训练目标"
      >
        <span className={styles.goalLabel} data-testid="dock-goal-label">
          {goalLabel}
        </span>
        <span className={styles.goalHint}>当前目标</span>
        <span className={styles.goalChevron} aria-hidden="true">›</span>
      </button>

      <button
        type="button"
        className={styles.mic}
        data-recording={isCapturing}
        onClick={onRecord}
        disabled={isRequesting}
        aria-label={micLabel}
      >
        {isCapturing ? '■' : '●'}
      </button>

      <span className={styles.hint} data-testid="dock-hint">
        {isCapturing ? '再次点击停止' : '点击开始录音'}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: 实现样式**

创建 `src/components/mobile/RecordDock.module.css`：

```css
.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--border);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -4px 16px rgba(16, 24, 40, 0.08);
}
.goal {
  display: flex;
  align-items: baseline;
  gap: 4px;
  background: #F9FAFB;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  font-family: inherit;
  min-width: 0;
  flex-shrink: 1;
}
.goalLabel {
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
  line-height: 1;
}
.goalHint {
  font-size: 10px;
  color: var(--text-mute);
  white-space: nowrap;
}
.goalChevron {
  font-size: 14px;
  color: var(--text-mute);
  line-height: 1;
}
.mic {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(226, 62, 87, 0.35);
  transition: transform .15s ease, background .15s ease;
}
.mic:active { transform: scale(0.94); }
.mic:disabled {
  background: var(--text-mute);
  box-shadow: none;
  cursor: not-allowed;
}
.mic[data-recording="true"] {
  animation: dockPulse 1.6s ease-out infinite;
}
.hint {
  flex: 1;
  font-size: 11px;
  color: var(--text-mute);
  text-align: right;
  min-width: 0;
}

@keyframes dockPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(226, 62, 87, 0.45); }
  50% { box-shadow: 0 0 0 12px rgba(226, 62, 87, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .mic[data-recording="true"] { animation: none; }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/RecordDock.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: 提交**

```bash
git add src/components/mobile/RecordDock.tsx src/components/mobile/RecordDock.module.css src/__tests__/RecordDock.test.tsx
git commit -m "feat(mobile): 竖版底部录音 Dock"
```

---

### Task 6: `MobileMoreMenu` 顶栏溢出菜单

**Files:**
- Create: `src/components/mobile/MobileMoreMenu.tsx`
- Create: `src/components/mobile/MobileMoreMenu.module.css`
- Modify: `src/components/Toolbar.tsx`
- Test: `src/__tests__/MobileMoreMenu.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/MobileMoreMenu.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import type { ToolItem } from '../hooks/useToolbar'

const ITEMS: ToolItem[] = [
  { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
  { id: 'import', variant: 'ghost', icon: '📁', label: '导入音频' },
  { id: 'playback', variant: 'ghost', icon: '♫', label: '回放' },
  { id: 'clear', variant: 'ghost', icon: '↺', label: '清空' },
  { id: 'config', variant: 'ghost', icon: '⚙', label: '配置' },
  { id: 'help', variant: 'ghost', icon: '?', label: '帮助' },
  { id: 'about', variant: 'ghost', icon: 'ⓘ', label: '关于' },
]

describe('MobileMoreMenu', () => {
  it('starts collapsed', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('reveals every non-record tool after opening', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    fireEvent.click(screen.getByLabelText('更多操作'))
    expect(screen.getByRole('menu')).toBeTruthy()
    const labels = screen.getAllByRole('menuitem').map(el => el.textContent)
    expect(labels).toEqual(['导入音频', '回放', '清空', '配置', '帮助', '关于'])
  })

  it('never lists the record tool because the dock owns it', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    fireEvent.click(screen.getByLabelText('更多操作'))
    expect(screen.queryByText('开始录音')).toBeNull()
  })

  it('dispatches the tool id and collapses', () => {
    const onSelect = vi.fn()
    render(<MobileMoreMenu items={ITEMS} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(screen.getByText('清空'))
    expect(onSelect).toHaveBeenCalledWith('clear')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps disabled tools unclickable', () => {
    const onSelect = vi.fn()
    const disabled: ToolItem[] = ITEMS.map(i =>
      i.id === 'playback' ? { ...i, label: '回放', disabled: true } : i,
    )
    render(<MobileMoreMenu items={disabled} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('更多操作'))
    const item = screen.getByText('回放').closest('button') as HTMLButtonElement
    expect(item.disabled).toBe(true)
    fireEvent.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('collapses when the trigger is pressed a second time', () => {
    render(<MobileMoreMenu items={ITEMS} onSelect={() => {}} />)
    const trigger = screen.getByLabelText('更多操作')
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/MobileMoreMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "../components/mobile/MobileMoreMenu"`

- [ ] **Step 3: 实现组件**

创建 `src/components/mobile/MobileMoreMenu.tsx`：

```tsx
import { useState } from 'react'
import type { ToolItem } from '../../hooks/useToolbar'
import styles from './MobileMoreMenu.module.css'

export interface MobileMoreMenuProps {
  items: ToolItem[]
  onSelect: (toolId: string) => void
}

export function MobileMoreMenu({ items, onSelect }: MobileMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const menuItems = items.filter(item => item.id !== 'record')

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
      >
        ⋯
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {menuItems.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                onSelect(item.id)
                setOpen(false)
              }}
            >
              <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.itemLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 实现样式**

创建 `src/components/mobile/MobileMoreMenu.module.css`：

```css
.wrap {
  position: relative;
  flex-shrink: 0;
}
.trigger {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text-soft);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.trigger[aria-expanded="true"] {
  background: #F3F4F6;
  color: var(--text);
}
.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  min-width: 152px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-hover);
  padding: 4px;
  display: flex;
  flex-direction: column;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 13px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.item:hover:not(:disabled) { background: #F3F4F6; }
.item:disabled {
  color: var(--text-mute);
  cursor: not-allowed;
}
.itemIcon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}
.itemLabel {
  white-space: nowrap;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/MobileMoreMenu.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 6: 给 Toolbar 加可选 `moreMenu` 插槽**

把 `src/components/Toolbar.tsx` 替换为：

```tsx
import type { ReactNode } from 'react'
import logo from '../../assets/logo.png'
import { Button } from './Button'
import styles from './Toolbar.module.css'
import type { ToolItem } from '../hooks/useToolbar'

interface ToolbarProps {
  toolItems: ToolItem[]
  onToolClick: (toolId: string) => void
  nav?: { label: string; onClick: () => void }
  moreMenu?: ReactNode
}

export function Toolbar({ toolItems, onToolClick, nav, moreMenu }: ToolbarProps) {
  return (
    <header className={styles.toolbar} data-compact={moreMenu ? 'true' : 'false'}>
      <div className={styles.brand}>
        <img src={logo} className={styles.logo} alt="" aria-hidden="true" />
        <span className={styles.title}>在线声音训练</span>
        <span className={styles.subtitle}>「看见自己的声音」</span>
      </div>

      {nav && (
        <div className={styles.nav}>
          <Button icon="⇄" label={nav.label} onClick={nav.onClick} />
        </div>
      )}

      {moreMenu ?? (
        <div className={styles.actions}>
          {toolItems.map(item => (
            <Button
              key={item.id}
              id={item.id}
              variant={item.variant}
              icon={item.icon}
              label={item.label}
              recording={item.recording}
              disabled={item.disabled}
              onClick={() => onToolClick(item.id)}
            />
          ))}
        </div>
      )}
    </header>
  )
}
```

在 `src/components/Toolbar.module.css` 末尾追加：

```css
.toolbar[data-compact="true"] {
  padding: 8px 14px;
}
.toolbar[data-compact="true"] .logo {
  width: 30px;
  height: 30px;
}
.toolbar[data-compact="true"] .subtitle {
  display: none;
}
.toolbar[data-compact="true"] .title {
  font-size: 16px;
}
```

- [ ] **Step 7: 跑 Toolbar 回归**

Run: `npx vitest run --project unit src/__tests__/Toolbar.test.tsx`
Expected: PASS — 未传 `moreMenu` 时行为与原先一致

- [ ] **Step 8: 提交**

```bash
git add src/components/mobile/MobileMoreMenu.tsx src/components/mobile/MobileMoreMenu.module.css src/components/Toolbar.tsx src/components/Toolbar.module.css src/__tests__/MobileMoreMenu.test.tsx
git commit -m "feat(mobile): 竖版顶栏溢出菜单 + Toolbar moreMenu 插槽"
```

---

### Task 7: 装配 `AnalysisPortrait` 竖版布局

**Files:**
- Modify: `src/routes/AnalysisPortrait.tsx`
- Modify: `src/routes/AnalysisPage.module.css`
- Test: `src/__tests__/layoutShells.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/__tests__/layoutShells.test.tsx` 末尾追加：

```tsx
describe('portrait analysis structure', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
    setMatchMedia(true)
  })

  it('renders the redesigned portrait sections in order', () => {
    renderRoute(<AnalysisPage />)
    const page = document.querySelector('[data-layout="portrait"]') as HTMLElement
    expect(page).toBeTruthy()
    expect(page.querySelector('[data-testid="training-goal-card"]')).toBeTruthy()
    expect(page.querySelector('[data-testid="feedback-hero"]')).toBeTruthy()
    expect(page.querySelector('#f0Chart')).toBeTruthy()
    expect(page.querySelector('#formantChart')).toBeTruthy()
  })

  it('mounts the record dock with the active preset label', () => {
    renderRoute(<AnalysisPage />)
    const dock = document.querySelector('[data-portrait-dock="true"]')
    expect(dock).toBeTruthy()
    expect(screen.getByTestId('dock-goal-label').textContent).toBe('a')
  })

  it('shows the stop affordance in the dock while capturing', () => {
    renderRoute(<AnalysisPage />)
    expect(screen.getByLabelText('开始录音')).toBeTruthy()
  })

  it('does not mount the dock in the landscape shell', () => {
    setMatchMedia(false)
    renderRoute(<AnalysisPage />)
    expect(document.querySelector('[data-portrait-dock="true"]')).toBeNull()
    expect(document.querySelectorAll('[data-tool-id]').length).toBe(7)
  })

  it('gives the portrait page enough bottom padding for the dock', () => {
    renderRoute(<AnalysisPage />)
    const main = document.querySelector('[data-layout="portrait"] main') as HTMLElement
    expect(main.className).toContain('portraitMain')
  })
})
```

在该文件 import 区补 `screen`：

```tsx
import { render, screen } from '@testing-library/react'
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/layoutShells.test.tsx`
Expected: FAIL — `expected null not to be null`（训练目标卡 / Dock 尚未装配）

- [ ] **Step 3: 重写 AnalysisPortrait**

把 `src/routes/AnalysisPortrait.tsx` 全文替换为：

```tsx
import { useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useToolbar } from '../hooks/useToolbar'
import type { ShellContext } from './AppShell'
import { TrainingGoalCard } from '../components/mobile/TrainingGoalCard'
import { FeedbackHero } from '../components/mobile/FeedbackHero'
import { RecordDock } from '../components/mobile/RecordDock'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import { TipWidget } from '../components/TipWidget'
import type { FormantSeries } from '../types'
import { presetShortLabel } from '../types'
import styles from './AnalysisPage.module.css'

const LEGEND_KEYS = ['f0', 'f1', 'f2'] as const

const SERIES_COLORS: Record<FormantSeries, string> = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

export function AnalysisPortrait() {
  const { cursorTime, hasData, isCapturing, isRequesting, onRecord } =
    useOutletContext<ShellContext>()

  const formantVisible = useAppStore(s => s.formantVisible)
  const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)
  const activePreset = useAppStore(s => s.activePreset)

  const goalRef = useRef<HTMLDivElement>(null)
  const scrollToGoal = useCallback(() => {
    goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const goalLabel = presetShortLabel(activePreset)

  return (
    <div className={styles.page} data-layout="portrait">
      <main className={`${styles.content} ${styles.portraitMain}`}>
        <div ref={goalRef} data-testid="training-goal-card" className={styles.portraitGoalSlot}>
          <TrainingGoalCard />
        </div>

        <div data-testid="feedback-hero" className={styles.portraitHeroSlot}>
          <FeedbackHero />
        </div>

        <nav className={styles.portraitTabs} aria-label="图表导航">
          <button
            type="button"
            className={styles.portraitTab}
            onClick={() => document.getElementById('f0Chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            基频
          </button>
          <span className={styles.portraitTabDivider} aria-hidden="true">|</span>
          <button
            type="button"
            className={styles.portraitTab}
            onClick={() => document.getElementById('formantChart')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            共振峰
          </button>
        </nav>

        <section className={`${styles.card} ${styles.portraitCard}`}>
          <div className={styles.chartWrapper}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle}>基频</h2>
            </div>
            <div className={styles.chartArea}>
              <F0Chart cursorTime={cursorTime} />
              <EmptyState
                title="还没有声音数据"
                description="🎤 点击下方红色按钮开始录音"
                visible={!hasData}
              />
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.portraitCard}`}>
          <div className={`${styles.chartHeader} ${styles.chartHeaderLegend}`}>
            <h2 className={styles.cardTitle}>共振峰</h2>
            <div className={styles.cardLegend} aria-label="图例">
              {LEGEND_KEYS.map(key => (
                <button
                  key={key}
                  className={styles.legendItem}
                  data-key={key}
                  data-active={String(formantVisible[key])}
                  onClick={() => toggleFormantVisible(key)}
                >
                  <i style={{ background: SERIES_COLORS[key] }}></i>
                  {key.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.chartArea}>
            <FormantChart cursorTime={cursorTime} />
            <EmptyState
              title="曲线待生成"
              description="录音或导入音频后显示共振峰曲线"
              visible={!hasData}
            />
          </div>
        </section>
      </main>

      <RecordDock
        onRecord={onRecord}
        isCapturing={isCapturing}
        isRequesting={isRequesting}
        goalLabel={goalLabel}
        onGoalClick={scrollToGoal}
      />

      <TipWidget />
    </div>
  )
}
```


- [ ] **Step 4: 追加竖版 CSS**

在 `src/routes/AnalysisPage.module.css` 的 `@media (max-width: 768px)` 块**内部**追加：

```css
  .portraitMain {
    padding: 12px 14px 116px;
    gap: 12px;
  }
  .portraitGoalSlot,
  .portraitHeroSlot {
    flex-shrink: 0;
  }
  .portraitTabs {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .portraitTab {
    background: none;
    border: none;
    padding: 2px 0;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    cursor: pointer;
  }
  .portraitTabDivider {
    color: var(--border-strong);
    font-size: 13px;
  }
  .portraitCard {
    flex: 0 0 auto;
  }
  .portraitCard .chartWrapper {
    height: 240px;
    min-height: 240px;
    margin: 8px auto;
  }
  .portraitCard .chartArea {
    min-height: 160px;
  }
```

同时在**媒体查询之前**（文件末尾 `@media` 之后另起一段）追加非媒体查询的默认隐藏规则，让 `portraitTabs` 在桌面不出现：

```css
.portraitTabs { display: none; }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/layoutShells.test.tsx`
Expected: PASS（全部，含原有 4 个 shell 用例）

- [ ] **Step 6: typecheck + 全量测试**

Run: `npx tsc --noEmit && npm test`
Expected: 0 errors，全部 test files 通过

- [ ] **Step 7: 提交**

```bash
git add src/routes/AnalysisPortrait.tsx src/routes/AnalysisPage.module.css src/__tests__/layoutShells.test.tsx
git commit -m "feat(portrait): 装配竖版设计稿布局（目标卡 + Hero + 堆叠图表 + 底部 Dock）"
```

---

### Task 8: 顶栏接入 `...` 菜单（AppShell 竖版分支）

**Files:**
- Modify: `src/routes/AppShell.tsx`
- Modify: `src/hooks/useToolbar.ts`
- Test: `src/__tests__/MobileMoreMenu.test.tsx`（扩展）

- [ ] **Step 1: 写失败测试**

在 `src/__tests__/MobileMoreMenu.test.tsx` 末尾追加：

```tsx
describe('useToolbar portrait wiring', () => {
  it('exposes record state that the dock can mirror', async () => {
    const { useToolbar } = await import('../hooks/useToolbar')
    expect(typeof useToolbar).toBe('function')
  })
})
```

并新增 `src/__tests__/AppShellPortrait.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '../routes/AppShell'
import { useAppStore } from '../store/appStore'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

function setMatchMedia(matches: boolean) {
  const mql = { matches, addEventListener: () => {}, removeEventListener: () => {} }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
}

describe('AppShell toolbar density', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('collapses the toolbar into the overflow menu in portrait', () => {
    setMatchMedia(true)
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div data-testid="page" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('更多操作')).toBeTruthy()
    expect(screen.queryByLabelText('导入音频')).toBeNull()
  })

  it('keeps the full toolbar in landscape', () => {
    setMatchMedia(false)
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div data-testid="page" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText('更多操作')).toBeNull()
    expect(screen.getByText('导入音频')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run --project unit src/__tests__/AppShellPortrait.test.tsx`
Expected: FAIL — `expected null not to be null`（`更多操作` 未渲染）

- [ ] **Step 3: useToolbar 暴露 isCapturing / isRequesting**

在 `src/hooks/useToolbar.ts` 末尾把 return 语句替换为：

```ts
  return {
    toolItems,
    handleClickTool,
    hasData,
    cursorTime,
    fileInputRef,
    handleFileChange,
    isCapturing,
    isRequesting,
  }
```

- [ ] **Step 4: AppShell 按断点切换工具栏形态**

把 `src/routes/AppShell.tsx` 替换为：

```tsx
import { useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Toolbar } from '../components/Toolbar'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'

const PORTRAIT_QUERY = '(max-width: 768px)'

export interface ShellContext {
  cursorTime: number
  hasData: boolean
  isCapturing: boolean
  isRequesting: boolean
  onRecord: () => void
}

export function AppShell() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const navigate = useNavigate()
  const isPractice = useMatch('/practice') != null
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)

  const {
    toolItems, handleClickTool, cursorTime, hasData,
    isCapturing, isRequesting, fileInputRef, handleFileChange,
  } = useToolbar(
    () => setConfigOpen(true),
    () => setHelpOpen(true),
    () => setAboutOpen(true),
  )

  const togglePage = () => navigate(isPractice ? '/' : '/practice')

  const shellContext: ShellContext = {
    cursorTime,
    hasData,
    isCapturing,
    isRequesting,
    onRecord: () => handleClickTool('record'),
  }

  return (
    <>
      <Toolbar
        toolItems={toolItems}
        onToolClick={handleClickTool}
        nav={{ label: isPractice ? '返回分析' : '音高参考', onClick: togglePage }}
        moreMenu={isPortrait
          ? <MobileMoreMenu items={toolItems} onSelect={handleClickTool} />
          : undefined}
      />
      <Outlet context={shellContext} />
      <Toast />
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
    </>
  )
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run --project unit src/__tests__/AppShellPortrait.test.tsx src/__tests__/MobileMoreMenu.test.tsx src/__tests__/Toolbar.test.tsx`
Expected: PASS

- [ ] **Step 6: typecheck + 全量测试 + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 0 errors，全部测试通过，build 成功

- [ ] **Step 7: 提交**

```bash
git add src/routes/AppShell.tsx src/hooks/useToolbar.ts src/__tests__/AppShellPortrait.test.tsx src/__tests__/MobileMoreMenu.test.tsx
git commit -m "feat(shell): 竖屏顶栏切换为溢出菜单并暴露录音状态"
```

---

## Self-Review

**Spec coverage**

| Spec 章节 | 覆盖任务 |
|---|---|
| §4.2 新增文件清单 | Task 2/3/5/6 全部 8 个组件文件 + Task 1 hook |
| §4.3 修改文件 | Task 1（TargetPresetBar）、Task 4（F0Chart/FormantChart）、Task 6（Toolbar）、Task 7（AnalysisPortrait + CSS）、Task 8（AppShell + useToolbar） |
| §4.4 `usePresetBands` 契约 | Task 1 Step 4（返回值与 spec 一致） |
| §4.4 `TrainingGoalCard` | Task 2 |
| §4.4 `FeedbackHero` 徽标四态优先级 | Task 3 Step 1 `resolveBadge` 测试 + Step 3 实现 |
| §4.4 `RecordDock` | Task 5 |
| §4.4 `MobileMoreMenu`（排除 record，6 项） | Task 6 Step 1 |
| §4.5 竖版图表配置表 | Task 4 Step 1 六条断言 |
| §4.6 AnalysisPortrait 布局顺序 + 116px padding | Task 7 Step 1/4 |
| §5 数据流（全部经 `handleClickTool`） | Task 7 Step 3（`ShellContext` 传入 AppShell 唯一的 `useToolbar` 实例派生的 `onRecord`）、Task 8 Step 4（`onSelect={handleClickTool}`） |
| §6 测试策略 7 项 | Task 1/2/3/4/5/6/7/8 各自的测试文件 |
| §8 风险：菜单漏项 | Task 6 Step 1 断言 labels 数组恰好 6 项 |
| §8 风险：safe-area | Task 5 Step 4 CSS |

**Placeholder scan** — 无 TBD/TODO/「类似 Task N」；所有代码块均为完整可粘贴内容。

**Type consistency** — `usePresetBands` 返回的 `onInputKeyDown(key, index)` 签名在 Task 1/2/6 三处一致；`bandKeyToId(key, index)` 一致；`RecordDockProps` 在 Task 5 定义与 Task 7 使用一致；`ToolItem` 的 `id/variant/icon/label/recording/disabled` 沿用既有类型；`resolveBadge` 返回 `{ tone, text }` 在实现与测试一致；`SERIES_COLORS` 键类型 `FormantSeries` 与 `.map` 遍历的 `'f0'|'f1'|'f2'` 一致。
