# Phase 1: TS + React Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate VoiceBuilder UI from Vanilla JS (global state + DOM manipulation) to TypeScript + React, keeping all DSP algorithm modules (in `js/`) untouched.

**Architecture:** React 19 + TypeScript + Vite front-end. ECharts instances live in `useRef` — frame data never passes through React reconciliation. Legacy `js/` DSP modules import transparently via `allowJs`. One React Context: `AnalysisContext` (state machine + config + presets). Pipeline and AudioEngine instances live in `useRef` within the page component. Progressive migration — old `js/main.js` remains working until final step.

**Tech Stack:** React 19, TypeScript 5, Vite 5, ECharts 5, React Router v7, CSS Modules, @vitejs/plugin-react

---

### Task 1: Project Scaffold — Install Dependencies + TypeScript Config

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Modify: `vite.config.js` → `vite.config.ts`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Install React, Router, TypeScript, plugin-react**

Run:
```bash
npm install react react-dom react-router-dom
npm install -D typescript @types/react @types/react-dom @vitejs/plugin-react
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Key: `"allowJs": true` lets us import existing `js/` DSP modules from TypeScript.

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Replace `vite.config.js` with `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
})
```

- [ ] **Step 5: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: Verify compilation works**

```bash
npx tsc --noEmit
```
Expected: no errors (no source files yet, so empty success).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts src/vite-env.d.ts
git rm vite.config.js
git commit -m "feat: scaffold TypeScript + React + Vite config"
```

---

### Task 2: Shared Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

```ts
export interface AnalysisFrame {
  time: number
  f0: number | null
  f1: number | null
  f2: number | null
  f3?: number | null
  f4?: number | null
  voiced?: boolean
}

export interface TargetBand {
  range: [number, number]
  color: string
}

export interface FormantMethod {
  value: 'hybrid' | 'lpc' | 'cepstral'
  label: string
  description: string
}

export const FORMANT_METHODS: FormantMethod[] = [
  { value: 'hybrid', label: '混合法', description: 'LPC+倒谱回退，推荐' },
  { value: 'lpc', label: '纯 LPC', description: '自回归，可能找不到低 F1' },
  { value: 'cepstral', label: '纯倒谱法', description: '封闭元音 F2 偏大' },
]

export type AppPhase = 'idle' | 'requesting' | 'recording' | 'paused' | 'analyzing'

export interface TargetBands {
  f0: TargetBand
  f1: TargetBand
  f2: TargetBand
}

export interface VowelPreset {
  label: string
  f0: [number, number]
  f1: [number, number]
  f2: [number, number]
}

export const VOWEL_PRESETS: Record<string, VowelPreset> = {
  'vowel-a': { label: '元音 a', f0: [200, 280], f1: [800, 1000], f2: [1100, 1400] },
  'vowel-o': { label: '元音 o', f0: [200, 280], f1: [480, 620], f2: [700, 1000] },
  'vowel-e': { label: '元音 e', f0: [200, 280], f1: [500, 660], f2: [1000, 1300] },
  'vowel-i': { label: '元音 i', f0: [220, 300], f1: [280, 380], f2: [2500, 3000] },
  'vowel-u': { label: '元音 u', f0: [200, 280], f1: [300, 400], f2: [600, 900] },
  'vowel-yu': { label: '元音 ü', f0: [220, 300], f1: [280, 380], f2: [1800, 2200] },
}

export interface AppConfig {
  formantMethod: FormantMethod['value']
  formantSmoothing: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  formantMethod: 'hybrid',
  formantSmoothing: true,
}

export interface ChartHandles {
  pushFrame: (frame: AnalysisFrame) => void
  displayAll: (frames: AnalysisFrame[]) => void
  setLiveMode: () => void
  setTargetBands: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
  setCursorTime: (time: number) => void
  setSeriesVisible?: (key: string, visible: boolean) => void
  clear: () => void
}

export interface AnalysisStats {
  f0Mean: number | null
  hitRate: number | null
  duration: number
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3: useECharts Hook

**Files:**
- Create: `src/hooks/useECharts.ts`

- [ ] **Step 1: Create `src/hooks/useECharts.ts`**

```ts
import { useRef, useEffect, useCallback } from 'react'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'canvas' })
    const onResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [])

  const getInstance = useCallback(() => instanceRef.current, [])

  const setOption = useCallback((option: echarts.EChartsOption, opts?: { notMerge?: boolean }) => {
    instanceRef.current?.setOption(option, opts)
  }, [])

  return { chartRef, getInstance, setOption }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useECharts.ts
git commit -m "feat: add useECharts hook for ECharts instance lifecycle management"
```

---

### Task 4: EmptyState + StatusBar Leaf Components

**Files:**
- Create: `src/components/EmptyState.tsx`
- Create: `src/components/StatusBar.tsx`

- [ ] **Step 1: Create `src/components/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
  title: string
  description: string
  visible?: boolean
}

export function EmptyState({ title, description, visible = true }: EmptyStateProps) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#98A2B3' }}>{title}</div>
      <div style={{ fontSize: 14, color: '#B0B7C3' }}>{description}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/StatusBar.tsx`**

```tsx
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
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/EmptyState.tsx src/components/StatusBar.tsx
git commit -m "feat: add EmptyState and StatusBar components"
```

---

### Task 5: TipWidget Component

**Files:**
- Create: `src/components/TipWidget.tsx`

- [ ] **Step 1: Create `src/components/TipWidget.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'

const TIPS = [
  '点击顶部「开始录音」或「导入 WAV」即可开始分析',
  '点击元音卡片 a/o/e/i/u/ü 快速切换目标区间',
  '元音开口度大小决定F1，舌位前后决定F2',
  '保持话筒距离 10–15cm，录音效果更佳',
  '持续平稳发声，能获得更稳定的共振峰曲线',
  '点击 ⚙ 配置可切换共振峰算法（混合法 / LPC / 倒谱法）',
  '点击图例可单独隐藏或显示 F0/F1/F2 曲线',
  '目标区间以绿色高亮显示，进入区间时数值变色',
  'F0 基频决定音高，女性通常 180–300Hz，男性 80–150Hz',
  '录音超过 10 秒时自动保留最近 10 秒数据',
  '点「清空」按钮重置所有数据和图表',
  '遇到问题？点击顶栏 ? 按钮查看完整使用说明',
]

interface TipWidgetProps {
  interval?: number
}

export function TipWidget({ interval = 5000 }: TipWidgetProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [visible, setVisible] = useState(true)

  const next = useCallback(() => {
    setIndex(i => (i + 1) % TIPS.length)
  }, [])

  useEffect(() => {
    if (!visible) return
    const id = setInterval(next, interval)
    return () => clearInterval(id)
  }, [interval, visible])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 16, zIndex: 50,
      background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '12px 16px',
      maxWidth: 320, display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <div style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.5, flex: 1 }}>
        💡 {TIPS[index]}
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
          color: '#98A2B3', padding: 0, lineHeight: 1, flexShrink: 0,
        }}
        aria-label="关闭提示"
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TipWidget.tsx
git commit -m "feat: add TipWidget component"
```

---

### Task 6: Toolbar Component

**Files:**
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Create `src/components/Toolbar.tsx`**

```tsx
import type { AppPhase } from '../types'

interface ToolbarProps {
  phase: AppPhase
  onRecord: () => void
  onImport: () => void
  onClear: () => void
  onConfig: () => void
  onHelp: () => void
}

const LABELS: Record<AppPhase, string> = {
  idle: '开始录音',
  requesting: '麦克风授权中…',
  recording: '停止录音',
  paused: '继续录音',
  analyzing: '分析中…',
}

export function Toolbar({ phase, onRecord, onImport, onClear, onConfig, onHelp }: ToolbarProps) {
  const label = LABELS[phase]
  const isRecording = phase === 'recording'
  const isRequesting = phase === 'requesting'
  const isPaused = phase === 'paused'

  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', background: '#FFF', borderBottom: '1px solid #E5E7EB',
      position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="assets/logo.png" alt="" style={{ width: 28, height: 28 }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>在线声音训练</span>
        <span style={{ fontSize: 13, color: '#6B7280' }}>「看见自己的声音」</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onRecord} disabled={isRequesting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: 'none', cursor: isRequesting ? 'not-allowed' : 'pointer',
            background: isRecording ? '#C81E37' : '#E23E57', color: '#FFF', fontSize: 14, fontWeight: 500,
          }}>
          <span>{isRecording ? '■' : '●'}</span>
          <span>{label}</span>
        </button>

        <ActionButton label="导入 WAV" icon="📁" onClick={onImport} />
        {isPaused && <ActionButton label="回放" icon="♫" onClick={() => {}} />}
        <ActionButton label="清空" icon="↺" onClick={onClear} />
        <ActionButton label="配置" icon="⚙" onClick={onConfig} />
        <ActionButton label="帮助" icon="?" onClick={onHelp} />

        <input type="file" id="wavInput" accept=".wav" hidden />
      </div>
    </header>
  )
}

function ActionButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
        border: '1px solid #D1D5DB', background: '#FFF', cursor: 'pointer', fontSize: 14, color: '#4B5563',
        fontWeight: 500,
      }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: add Toolbar component with button state management"
```

---

### Task 7: TargetPresetBar Component

**Files:**
- Create: `src/components/TargetPresetBar.tsx`

- [ ] **Step 1: Create `src/components/TargetPresetBar.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TargetPresetBar.tsx
git commit -m "feat: add TargetPresetBar component with vowel presets and range inputs"
```

---

### Task 8: ConfigDrawer + HelpDrawer Components

**Files:**
- Create: `src/components/ConfigDrawer.tsx`
- Create: `src/components/HelpDrawer.tsx`

- [ ] **Step 1: Create `src/components/ConfigDrawer.tsx`**

```tsx
import { FORMANT_METHODS } from '../types'
import type { AppConfig, FormantMethod as FM } from '../types'

interface ConfigDrawerProps {
  open: boolean
  config: AppConfig
  onChange: (config: Partial<AppConfig>) => void
  onClose: () => void
}

export function ConfigDrawer({ open, config, onChange, onClose }: ConfigDrawerProps) {
  if (!open) return null
  return (
    <aside style={{
      position: 'fixed', inset: 0, zIndex: 30, display: 'flex', pointerEvents: 'auto',
    }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        width: 320, background: '#FFF', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>配置</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>×</button>
        </header>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>共振峰算法</h4>
            {FORMANT_METHODS.map((m: FM) => (
              <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="radio" name="formantMethod" value={m.value}
                  checked={config.formantMethod === m.value}
                  onChange={() => onChange({ formantMethod: m.value })}
                />
                <span>{m.label} <small style={{ color: '#6B7280' }}>（{m.description}）</small></span>
              </label>
            ))}
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>生效于下次录音或导入</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>共振峰平滑</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={config.formantSmoothing}
                onChange={e => onChange({ formantSmoothing: e.target.checked })}
              />
              <span>中值滤波平滑 <small style={{ color: '#6B7280' }}>（减少毛刺跳变）</small></span>
            </label>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>实时 5 帧中值滤波，消除孤立异常跳变</p>
          </section>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create `src/components/HelpDrawer.tsx`**

```tsx
interface HelpDrawerProps {
  open: boolean
  onClose: () => void
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  if (!open) return null
  return (
    <aside style={{
      position: 'fixed', inset: 0, zIndex: 30, display: 'flex', pointerEvents: 'auto',
    }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        width: 360, background: '#FFF', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 12px rgba(0,0,0,0.1)',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>使用说明</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>×</button>
        </header>
        <div style={{ padding: 16, overflowY: 'auto', fontSize: 14, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>如何开始</h4>
            <p style={{ margin: 0, color: '#4B5563' }}>点击顶部「开始录音」，或点击「导入 WAV」选择已有音频文件。首次使用浏览器会询问麦克风权限。</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>基频</h4>
            <p style={{ margin: 0, color: '#4B5563' }}>展示 F0 基频随时间的变化曲线。蓝色区域为男性典型基频范围(80–150 Hz)，粉色区域为女性典型基频范围(180–300 Hz)。</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>共振峰</h4>
            <p style={{ margin: 0, color: '#4B5563' }}>F0 是基频（决定声音高低），F1/F2 决定音色。绿色区间为目标区间。</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>目标区间含义（女声普通话参考）</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['元音', 'F0', 'F1', 'F2', 'F3', 'F4'].map(h => (
                    <th key={h} style={{ padding: '4px 2px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { v: 'a', f0: '200–280', f1: '800–1000', f2: '1100–1400', f3: '2700–3100', f4: '3800–4200' },
                  { v: 'o', f0: '200–280', f1: '480–620', f2: '700–1000', f3: '2700–3100', f4: '3700–4100' },
                  { v: 'e', f0: '200–280', f1: '500–660', f2: '1000–1300', f3: '2700–3200', f4: '3800–4200' },
                  { v: 'i', f0: '220–300', f1: '280–380', f2: '2500–3000', f3: '3200–3600', f4: '4000–4400' },
                  { v: 'u', f0: '200–280', f1: '300–400', f2: '600–900', f3: '2500–3000', f4: '3600–4000' },
                  { v: 'ü', f0: '220–300', f1: '280–380', f2: '1800–2200', f3: '2400–2900', f4: '3800–4200' },
                ].map(row => (
                  <tr key={row.v} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '3px 2px', fontWeight: 600 }}>{row.v}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f0}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f1}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f2}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f3}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>常见问题</h4>
            <ul style={{ margin: 0, paddingLeft: 16, color: '#4B5563' }}>
              <li>麦克风没反应？请检查浏览器地址栏的权限图标。</li>
              <li>曲线过于抖动？说话尽量持续、平稳会更稳定。</li>
              <li>看不到任何图像？刷新页面并重新开始录音。</li>
            </ul>
          </section>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ConfigDrawer.tsx src/components/HelpDrawer.tsx
git commit -m "feat: add ConfigDrawer and HelpDrawer components"
```

---

### Task 9: F0Chart Component

**Files:**
- Create: `src/components/F0Chart.tsx`

This wraps the existing `F0ChartRenderer` logic (from `js/f0-chart.js`) in a React component. The ECharts option construction is copied verbatim from the working JS version.

- [ ] **Step 1: Create `src/components/F0Chart.tsx`**

```tsx
import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useECharts } from '../hooks/useECharts'
import type { AnalysisFrame, ChartHandles } from '../types'

const WINDOW = 10

const TARGET_ZONES = [
  { label: '男声', range: [80, 150], color: '#5BCEFA' },
  { label: '女声', range: [180, 300], color: '#F5A9B8' },
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildMarkAreas(zones: typeof TARGET_ZONES) {
  return zones.map(z => ([{
    yAxis: z.range[0],
    itemStyle: { color: hexToRgba(z.color, 0.15) },
  }, {
    yAxis: z.range[1],
  }]))
}

function buildMarkLineData(zones: typeof TARGET_ZONES) {
  return zones.map(z => {
    const mid = Math.round((z.range[0] + z.range[1]) / 2)
    return {
      yAxis: mid,
      lineStyle: { color: hexToRgba(z.color, 0.4), type: 'dashed' as const, width: 1 },
      label: {
        formatter: z.label,
        color: z.color,
        fontSize: 11,
      },
    }
  })
}

export const F0Chart = forwardRef<ChartHandles, {
  batchMode?: boolean
}>(({ batchMode = false }, ref) => {
  const { chartRef, setOption } = useECharts()
  const dataRef = useRef<AnalysisFrame[]>([])
  const isBatchRef = useRef(batchMode)
  const latestTimeRef = useRef(0)
  const throttledRef = useRef(false)
  const cursorTimeRef = useRef(-1)

  isBatchRef.current = batchMode

  const render = useCallback((useAnimation: boolean) => {
    const data = dataRef.current
    const seriesData = data.map(f => [f.time, f.f0 ?? null])

    const hasData = data.length > 0
    let minTime: number, maxTime: number
    if (isBatchRef.current) {
      minTime = hasData ? data[0].time : 0
      maxTime = hasData ? data[data.length - 1].time : WINDOW
    } else {
      if (hasData) {
        const currentTime = data[data.length - 1].time
        minTime = currentTime - WINDOW
        maxTime = currentTime
      } else {
        minTime = 0
        maxTime = WINDOW
      }
    }

    setOption({
      animation: useAnimation,
      backgroundColor: 'transparent',
      grid: { left: 72, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const p = params[0]
          const time = p.value?.[0]
          const f0 = p.value?.[1]
          const f0Text = (f0 != null && f0 > 0) ? `${Math.round(f0)} Hz` : '--'
          return `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>
<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1F2937;"></span>
  <span style="flex:0 0 auto;color:#475467;">F0</span>
  <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">${f0Text}</span>
</div>`
        },
      },
      xAxis: {
        type: 'value',
        min: minTime,
        max: maxTime,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 500,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v: number) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: ['#1F2937'],
      series: [{
        name: 'F0',
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: '#1F2937', width: 2 },
        itemStyle: { color: '#1F2937' },
        markArea: { silent: true, data: buildMarkAreas(TARGET_ZONES) },
        markLine: { silent: true, symbol: 'none', data: buildMarkLineData(TARGET_ZONES) },
        data: seriesData,
      }],
    } as any)
  }, [setOption])

  useImperativeHandle(ref, () => ({
    pushFrame(frame: AnalysisFrame) {
      if (isBatchRef.current) return
      const data = dataRef.current
      data.push({ ...frame })
      latestTimeRef.current = frame.time
      const cutoff = frame.time - WINDOW
      while (data.length > 0 && data[0].time < cutoff) data.shift()
      if (!throttledRef.current) {
        throttledRef.current = true
        requestAnimationFrame(() => {
          render(false)
          throttledRef.current = false
        })
      }
    },
    displayAll(frames: AnalysisFrame[]) {
      dataRef.current = frames
      if (frames.length > 0) latestTimeRef.current = frames[frames.length - 1].time
      render(true)
    },
    setLiveMode() {
      isBatchRef.current = false
      render(false)
    },
    setTargetBands() {},
    setCursorTime(time: number) {
      cursorTimeRef.current = time
    },
    clear() {
      dataRef.current = []
      isBatchRef.current = false
      latestTimeRef.current = 0
      throttledRef.current = false
      render(false)
    },
  }), [render])

  return (
    <div style={{ height: '42vh', minHeight: 280, position: 'relative' }} ref={chartRef} />
  )
})

F0Chart.displayName = 'F0Chart'
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/F0Chart.tsx
git commit -m "feat: add F0Chart React component wrapping ECharts"
```

---

### Task 10: FormantChart Component

**Files:**
- Create: `src/components/FormantChart.tsx`

- [ ] **Step 1: Create `src/components/FormantChart.tsx`**

```tsx
import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useECharts } from '../hooks/useECharts'
import type { AnalysisFrame, ChartHandles, TargetBands } from '../types'

const WINDOW = 10
const FREQ_MAX = 3500

const COLORS = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

const DEFAULT_BANDS: TargetBands = {
  f0: { range: [200, 290], color: '#10B981' },
  f1: { range: [400, 750], color: '#3B82F6' },
  f2: { range: [1200, 2200], color: '#F59E0B' },
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildMarkArea(band: { range: [number, number]; color: string }) {
  return [[{
    yAxis: band.range[0],
    itemStyle: { color: hexToRgba(band.color, 0.10) },
  }, { yAxis: band.range[1] }]]
}

function buildMarkLine(band: { range: [number, number]; color: string }, name: string) {
  const mid = Math.round((band.range[0] + band.range[1]) / 2)
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: hexToRgba(band.color, 0.55), type: 'dashed' as const, width: 1 },
    label: { formatter: name, color: band.color, fontSize: 11 },
    data: [{ yAxis: mid }],
  }
}

export const FormantChart = forwardRef<ChartHandles, {
  batchMode?: boolean
  onFrameClick?: (frame: AnalysisFrame) => void
}>(({ batchMode = false, onFrameClick }, ref) => {
  const { chartRef, setOption, getInstance } = useECharts()
  const dataRef = useRef<AnalysisFrame[]>([])
  const isBatchRef = useRef(batchMode)
  const latestTimeRef = useRef(0)
  const throttledRef = useRef(false)
  const cursorTimeRef = useRef(-1)
  const seriesVisibleRef = useRef({ f0: true, f1: true, f2: true })
  const bandsRef = useRef(DEFAULT_BANDS)

  isBatchRef.current = batchMode

  const render = useCallback((useAnimation: boolean) => {
    const data = dataRef.current
    const visible = seriesVisibleRef.current
    const keys = ['f0', 'f1', 'f2'] as const
    const seriesData: Record<string, any[]> = {}
    for (const k of keys) {
      seriesData[k] = visible[k] ? data.map(f => [f.time, f[k] ?? null]) : []
    }

    const hasData = data.length > 0
    let minTime: number, maxTime: number
    if (isBatchRef.current) {
      minTime = hasData ? data[0].time : 0
      maxTime = hasData ? data[data.length - 1].time : WINDOW
    } else {
      if (hasData) {
        const currentTime = data[data.length - 1].time
        minTime = currentTime - WINDOW
        maxTime = currentTime
      } else {
        minTime = 0
        maxTime = WINDOW
      }
    }

    const bands = bandsRef.current
    const tooltipKeys = ['f2', 'f1', 'f0']

    setOption({
      animation: useAnimation,
      backgroundColor: 'transparent',
      grid: { left: 72, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const byName: Record<string, any> = {}
          for (const p of params) byName[p.seriesName] = p
          const time = params[0].value[0]
          let html = `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>`
          for (const k of tooltipKeys) {
            const name = k.toUpperCase()
            const p = byName[name]
            const color = COLORS[k as keyof typeof COLORS]
            const raw = p?.value?.[1]
            const v = (raw != null && raw > 0) ? Math.round(raw) : null
            const text = v == null ? '--' : `${v} Hz`
            html += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
              <span style="flex:0 0 auto;color:#475467;">${name}</span>
              <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">${text}</span>
            </div>`
          }
          return html
        },
      },
      xAxis: {
        type: 'value',
        min: minTime,
        max: maxTime,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: FREQ_MAX,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v: number) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: keys.map(k => COLORS[k]),
      series: keys.map(k => ({
        name: k.toUpperCase(),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        color: COLORS[k],
        lineStyle: { color: COLORS[k], width: k === 'f0' ? 2 : 1.5 },
        itemStyle: { color: COLORS[k] },
        markArea: bands[k] ? { silent: true, data: buildMarkArea(bands[k]) } : undefined,
        markLine: (k === 'f0' || k === 'f1' || k === 'f2') ? buildMarkLine(bands[k], `${k.toUpperCase()} 目标`) : undefined,
        data: seriesData[k],
      })),
    } as any)
  }, [setOption])

  const handleChartClick = useCallback((params: any) => {
    if (!onFrameClick) return
    const t = params.value?.[0]
    if (t == null) return
    const data = dataRef.current
    let best: AnalysisFrame | null = null
    let bestDist = Infinity
    for (const f of data) {
      const d = Math.abs(f.time - t)
      if (d < bestDist) { bestDist = d; best = f }
    }
    if (best) onFrameClick(best)
  }, [onFrameClick])

  useImperativeHandle(ref, () => ({
    pushFrame(frame: AnalysisFrame) {
      if (isBatchRef.current) return
      const data = dataRef.current
      data.push({ ...frame })
      latestTimeRef.current = frame.time
      const cutoff = frame.time - WINDOW
      while (data.length > 0 && data[0].time < cutoff) data.shift()
      if (!throttledRef.current) {
        throttledRef.current = true
        requestAnimationFrame(() => {
          render(false)
          throttledRef.current = false
        })
      }
    },
    displayAll(frames: AnalysisFrame[]) {
      dataRef.current = frames
      if (frames.length > 0) latestTimeRef.current = frames[frames.length - 1].time
      render(true)
    },
    setLiveMode() {
      isBatchRef.current = false
      render(false)
    },
    setTargetBands(bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) {
      for (const k of ['f0', 'f1', 'f2'] as const) {
        const r = bands[k]
        if (r && r.length === 2 && r[0] < r[1]) {
          bandsRef.current[k].range = r
        }
      }
      render(true)
    },
    setCursorTime(time: number) {
      cursorTimeRef.current = time
    },
    clear() {
      dataRef.current = []
      isBatchRef.current = false
      latestTimeRef.current = 0
      throttledRef.current = false
      render(false)
    },
  }), [render])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 280 }} ref={chartRef} />
  )
})

FormantChart.displayName = 'FormantChart'
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FormantChart.tsx
git commit -m "feat: add FormantChart React component wrapping ECharts with target bands"
```

---

### Task 11: AnalysisContext

**Files:**
- Create: `src/contexts/AnalysisContext.tsx`

- [ ] **Step 1: Create `src/contexts/AnalysisContext.tsx`**

```tsx
import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AppPhase, AppConfig, TargetBands, AnalysisFrame, AnalysisStats } from '../types'
import { DEFAULT_CONFIG } from '../types'

interface AnalysisState {
  phase: AppPhase
  config: AppConfig
  activePreset: string | null
  bands: TargetBands
  latestFrame: AnalysisFrame | null
  frameCount: number
  stats: AnalysisStats
  configDrawerOpen: boolean
  helpDrawerOpen: boolean
}

type Action =
  | { type: 'SET_PHASE'; phase: AppPhase }
  | { type: 'SET_CONFIG'; config: Partial<AppConfig> }
  | { type: 'SET_ACTIVE_PRESET'; name: string | null }
  | { type: 'SET_BANDS'; bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>> }
  | { type: 'SET_LATEST_FRAME'; frame: AnalysisFrame }
  | { type: 'SET_FRAME_COUNT'; count: number }
  | { type: 'SET_STATS'; stats: AnalysisStats }
  | { type: 'SET_CONFIG_DRAWER'; open: boolean }
  | { type: 'SET_HELP_DRAWER'; open: boolean }
  | { type: 'RESET' }

const DEFAULT_BANDS: TargetBands = {
  f0: { range: [200, 290], color: '#10B981' },
  f1: { range: [400, 750], color: '#3B82F6' },
  f2: { range: [1200, 2200], color: '#F59E0B' },
}

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } }
    case 'SET_ACTIVE_PRESET':
      return { ...state, activePreset: action.name }
    case 'SET_BANDS': {
      const bands = { ...state.bands }
      for (const k of ['f0', 'f1', 'f2'] as const) {
        const r = action.bands[k]
        if (r && r.length === 2 && r[0] < r[1]) {
          bands[k] = { ...bands[k], range: r }
        }
      }
      return { ...state, bands }
    }
    case 'SET_LATEST_FRAME':
      return { ...state, latestFrame: action.frame }
    case 'SET_FRAME_COUNT':
      return { ...state, frameCount: action.count }
    case 'SET_STATS':
      return { ...state, stats: action.stats }
    case 'SET_CONFIG_DRAWER':
      return { ...state, configDrawerOpen: action.open }
    case 'SET_HELP_DRAWER':
      return { ...state, helpDrawerOpen: action.open }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

const initialState: AnalysisState = {
  phase: 'idle',
  config: DEFAULT_CONFIG,
  activePreset: 'vowel-a',
  bands: DEFAULT_BANDS,
  latestFrame: null,
  frameCount: 0,
  stats: { f0Mean: null, hitRate: null, duration: 0 },
  configDrawerOpen: false,
  helpDrawerOpen: false,
}

const AnalysisContext = createContext<{
  state: AnalysisState
  dispatch: React.Dispatch<Action>
} | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AnalysisContext.Provider value={{ state, dispatch }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider')
  return ctx
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AnalysisContext.tsx
git commit -m "feat: add AnalysisContext with useReducer for app state management"
```

---

### Task 12: AnalysisPage — Wire All Components Together

**Files:**
- Create: `src/routes/AnalysisPage.tsx`

This is the orchestrator page. JS modules from `js/` are imported statically (TypeScript with `allowJs` will type them as `any` — acceptable for Phase 1).

- [ ] **Step 1: Create `src/routes/AnalysisPage.tsx`**

```tsx
import { useRef, useCallback, useEffect, useState } from 'react'
import { useAnalysis } from '../contexts/AnalysisContext'
import { Toolbar } from '../components/Toolbar'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { StatusBar } from '../components/StatusBar'
import { EmptyState } from '../components/EmptyState'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { TipWidget } from '../components/TipWidget'
import { VOWEL_PRESETS } from '../types'
import type { AnalysisFrame, ChartHandles } from '../types'
import { AudioEngine } from '../../js/audio-engine.js'
import { AnalysisPipeline } from '../../js/analysis-pipeline.js'
import { parseWav } from '../../js/wav-parser.js'
import { Resampler } from '../../js/resampler.js'

export function AnalysisPage() {
  const { state, dispatch } = useAnalysis()
  const f0Ref = useRef<ChartHandles>(null)
  const formantRef = useRef<ChartHandles>(null)
  const audioRef = useRef<InstanceType<typeof AudioEngine> | null>(null)
  const pipelineRef = useRef<InstanceType<typeof AnalysisPipeline> | null>(null)
  const wavInputRef = useRef<HTMLInputElement>(null)
  const sessionFramesRef = useRef<AnalysisFrame[]>([])
  const WINDOW_FRAMES = 1000

  useEffect(() => {
    audioRef.current = new AudioEngine()
  }, [])

  const onFrame = useCallback((frame: AnalysisFrame) => {
    sessionFramesRef.current.push(frame)
    if (sessionFramesRef.current.length > WINDOW_FRAMES) {
      sessionFramesRef.current.shift()
    }
    dispatch({ type: 'SET_LATEST_FRAME', frame })
    f0Ref.current?.pushFrame(frame)
    formantRef.current?.pushFrame(frame)
  }, [dispatch])

  const startNewRecording = useCallback(async () => {
    if (!audioRef.current) return
    pipelineRef.current?.reset()
    audioRef.current.clearRecordedBuffer()
    f0Ref.current?.setLiveMode()
    formantRef.current?.setLiveMode()
    pipelineRef.current = new AnalysisPipeline({
      onFrame,
      formantMethod: state.config.formantMethod,
      formantSmoothing: state.config.formantSmoothing,
      frameOffset: state.frameCount,
    })
    audioRef.current.startStream(
      (chunk: Float32Array, rate: number) => pipelineRef.current?.pushChunk(chunk, rate),
      10
    )
    dispatch({ type: 'SET_PHASE', phase: 'recording' })
  }, [onFrame, state.config, state.frameCount, dispatch])

  const onRecord = useCallback(async () => {
    if (!audioRef.current) return

    if (state.phase === 'recording') {
      audioRef.current.stopStream()
      if (pipelineRef.current) {
        pipelineRef.current.flush()
        const totalFrames = state.frameCount + pipelineRef.current.frameCount
        dispatch({ type: 'SET_FRAME_COUNT', count: totalFrames })
        pipelineRef.current.reset()
        pipelineRef.current = null
      }
      if (sessionFramesRef.current.length > WINDOW_FRAMES) {
        sessionFramesRef.current.splice(0, sessionFramesRef.current.length - WINDOW_FRAMES)
        audioRef.current.trimBufferToDuration(10)
      }
      dispatch({ type: 'SET_PHASE', phase: 'paused' })
      return
    }

    if (state.phase === 'paused') {
      pipelineRef.current?.reset()
      pipelineRef.current = null
      await startNewRecording()
      return
    }

    try {
      dispatch({ type: 'SET_PHASE', phase: 'requesting' })
      await startNewRecording()
    } catch (err) {
      console.error('Stream start failed:', err)
      dispatch({ type: 'SET_PHASE', phase: 'idle' })
    }
  }, [state.phase, state.frameCount, startNewRecording, dispatch])

  const clearAll = useCallback(() => {
    const ae = audioRef.current
    if (!ae) return
    pipelineRef.current?.reset()
    pipelineRef.current = null
    ae.stopPlayback?.()
    ae.stopStream()
    ae.clearRecordedBuffer()
    f0Ref.current?.clear()
    formantRef.current?.clear()
    sessionFramesRef.current = []
    dispatch({ type: 'RESET' })
  }, [dispatch])

  const onImport = useCallback(() => {
    if (state.phase === 'recording' || state.phase === 'paused') clearAll()
    wavInputRef.current?.click()
  }, [state.phase, clearAll])

  const onWavSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ae = audioRef.current
    if (!ae) return
    clearAll()
    try {
      const buf = await file.arrayBuffer()
      const parsed: any = parseWav(buf)
      let samples = parsed.samples as Float32Array
      let rate = parsed.sampleRate as number
      if (rate !== 16000) {
        const r = new Resampler(rate, 16000)
        samples = r.process(samples)
        rate = 16000
      }
      ae.setImportedBuffer(samples)
      ;(ae as any)._recordingSampleRate = rate
      const frames: AnalysisFrame[] = AnalysisPipeline.analyze(
        samples as any, rate, state.config.formantMethod, state.config.formantSmoothing
      )
      sessionFramesRef.current = frames
      dispatch({ type: 'SET_FRAME_COUNT', count: frames.length })
      f0Ref.current?.displayAll(frames)
      formantRef.current?.displayAll(frames)
      if (frames.length > 0) dispatch({ type: 'SET_PHASE', phase: 'paused' })
    } catch (err) {
      console.error('WAV analysis failed:', err)
      dispatch({ type: 'SET_PHASE', phase: 'idle' })
    }
    e.target.value = ''
  }, [state.config, clearAll, dispatch])

  const onPresetSelect = useCallback((name: string) => {
    const preset = VOWEL_PRESETS[name]
    if (!preset) return
    dispatch({ type: 'SET_ACTIVE_PRESET', name })
    formantRef.current?.setTargetBands({ f0: preset.f0, f1: preset.f1, f2: preset.f2 })
  }, [dispatch])

  const onBandsChange = useCallback(
    (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => {
      dispatch({ type: 'SET_BANDS', bands })
      formantRef.current?.setTargetBands(bands)
    },
    [dispatch]
  )

  const [hasData, setHasData] = useState(false)
  useEffect(() => {
    if (sessionFramesRef.current.length > 0) setHasData(true)
    else setHasData(false)
  }, [state.phase])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar
        phase={state.phase}
        onRecord={onRecord}
        onImport={onImport}
        onClear={clearAll}
        onConfig={() => dispatch({ type: 'SET_CONFIG_DRAWER', open: true })}
        onHelp={() => dispatch({ type: 'SET_HELP_DRAWER', open: true })}
      />

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 16, gap: 24 }}>
        <TargetPresetBar
          activePreset={state.activePreset}
          bands={state.bands}
          onPresetSelect={onPresetSelect}
          onBandsChange={onBandsChange}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section style={{ background: '#FFF', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>基频</h2>
            </div>
            <div style={{ position: 'relative' }}>
              <F0Chart ref={f0Ref} batchMode={false} />
              <EmptyState
                title="还没有声音数据"
                description="🎤 点击顶栏「开始录音」试试"
                visible={!hasData}
              />
            </div>
          </section>

          <section style={{
            flex: 1, background: '#FFF', borderRadius: 8, border: '1px solid #E5E7EB',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>共振峰</h2>
            </div>
            <div style={{ position: 'relative', flex: 1 }}>
              <FormantChart ref={formantRef} batchMode={false} />
              <EmptyState
                title="曲线待生成"
                description="录音或导入音频后显示共振峰曲线"
                visible={!hasData}
              />
            </div>
          </section>
        </div>
      </main>

      <StatusBar latestFrame={state.latestFrame} frameCount={state.frameCount} />
      <TipWidget />

      <ConfigDrawer
        open={state.configDrawerOpen}
        config={state.config}
        onChange={cfg => dispatch({ type: 'SET_CONFIG', config: cfg })}
        onClose={() => dispatch({ type: 'SET_CONFIG_DRAWER', open: false })}
      />

      <HelpDrawer
        open={state.helpDrawerOpen}
        onClose={() => dispatch({ type: 'SET_HELP_DRAWER', open: false })}
      />

      <input ref={wavInputRef} type="file" accept=".wav" hidden onChange={onWavSelected} />
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors (the JS imports are typed as `any` via `allowJs`).

- [ ] **Step 3: Commit**

```bash
git add src/routes/AnalysisPage.tsx
git commit -m "feat: add AnalysisPage orchestrator with JS module integration"
```

---

### Task 13: App Root + Entry Point + Router

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Modify: `index.html` (point to new entry)

- [ ] **Step 1: Create `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnalysisProvider } from './contexts/AnalysisContext'
import { AnalysisPage } from './routes/AnalysisPage'

// Future pages added here as routes
export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <Routes>
          <Route path="*" element={<AnalysisPage />} />
        </Routes>
      </AnalysisProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '../css/style.css'

const root = document.getElementById('app')
if (!root) throw new Error('Root element #app not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Update `index.html`**

Change the script tag from:
```html
<script type="module" src="js/main.js"></script>
```
to:
```html
<script type="module" src="src/main.tsx"></script>
```

And remove the `id="app"` element's inner HTML content (the React app will render all that), keeping only:
```html
<div id="app"></div>
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Verify Vite build works**

```bash
npm run build
```
Expected: builds successfully, output in `dist/`.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.tsx index.html
git commit -m "feat: add App root, entry point, and Router wiring"
```

---

### Task 14: Verify Old Tests Still Pass

**Files:** None

- [ ] **Step 1: Run all existing tests**

```bash
npm test
```
Expected: all 50 tests pass.

If any tests fail, investigate and fix.

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: verify all existing tests pass after migration"
```

---

### Task 15: Clean Up Old Entry Point (Optional, end of Phase 1)

**Files:**
- Remove: `js/main.js` (only when React app is fully verified)

- [ ] **Step 1: Remove old main.js when React app is verified stable**

```bash
git rm js/main.js
# Also remove old script from index.html if not already done
```

- [ ] **Step 2: Update test command to verify tests still use JS modules**

```bash
npm test
```
Expected: all tests still pass (tests import JS modules directly, not through main.js).

- [ ] **Step 3: Commit**

```bash
git commit -m "cleanup: remove old main.js entry point, fully migrated to React"
```

---

## Post-Migration Verification Checklist

After all tasks are complete, verify the following:

1. [ ] `npm run dev` — development server starts without errors
2. [ ] `npm test` — all 50 tests pass
3. [ ] `npm run build` — production build succeeds
4. [ ] `npm start` — preview server serves the app
5. [ ] Toolbar buttons render correctly with all states
6. [ ] Config drawer opens/closes, radio/checkbox work
7. [ ] Help drawer opens/closes, content renders
8. [ ] Vowel preset buttons toggle active state
9. [ ] Target band input fields reflect changes
10. [ ] F0 chart renders empty state
11. [ ] Formant chart renders empty state
12. [ ] Tip widget displays and cycles tips
13. [ ] Status bar shows at bottom
