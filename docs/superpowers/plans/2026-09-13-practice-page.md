# Practice Page (钢琴训练页) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second route `/practice` — a piano (C2–B5) reference keyboard plus a pitch chart rendered in scientific pitch notation (C4, D4), switched via a centered toolbar button that does NOT interrupt recording.

**Architecture:** A shared persistent shell (`AppShell`) owns `useToolbar` (§ recording/playback lifecycle) and renders the routed page via `<Outlet context>`. New pure modules: `src/utils/pitch.ts` (note math), `src/audio/PianoSynth.ts` (Web Audio tone synth), `src/components/Piano.tsx`, `src/components/PitchChart.tsx`, `src/routes/PracticePage.tsx`. `AnalysisPage` slims to content only; `App.tsx` gains an index + `/practice` layout route.

**Tech Stack:** React 19, react-router-dom v7, Zustand v5, ECharts 5, Web Audio API (raw, no tone.js), Vite/Vitest (jsdom unit project under `src/__tests__/`).

**Spec:** `docs/superpowers/specs/2026-09-13-practice-page-design.md`

**Baseline verified:** 208 tests pass on `feat/practice-page` (fresh worktree), branch `feat/practice-page`.

---

### Task 1: Pitch notation utils (`src/utils/pitch.ts`)

Pure functions mapping between frequency ↔ MIDI ↔ scientific pitch name. A4 = 440 Hz, MIDI 69. All other tasks depend on this module.

**Files:**
- Create: `src/utils/pitch.ts` (note: `src/utils/` does not exist yet)
- Test: `src/__tests__/pitchNotation.test.ts`
- Modify: none

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/pitchNotation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  SEMITONE_NAMES,
  midiToFreq,
  freqToMidi,
  nearestMidi,
  midiToName,
  centsOffset,
  MIDI_C2,
  MIDI_C3,
  MIDI_C5,
  MIDI_C6,
} from '../utils/pitch'

describe('pitch notation utils', () => {
  it('exposes the 12 semitone names', () => {
    expect(SEMITONE_NAMES).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])
  })

  it('converts midi to frequency (A4 = 440, C4 ~ 261.63)', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6)
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1)
    expect(midiToFreq(48)).toBeCloseTo(130.81, 1)
  })

  it('converts frequency to continuous midi', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6)
    expect(freqToMidi(261.63)).toBeCloseTo(60, 6)
  })

  it('rounds to nearest midi note', () => {
    expect(nearestMidi(440)).toBe(69)
    expect(nearestMidi(262)).toBe(60)
    expect(nearestMidi(466.16)).toBe(70)
  })

  it('formats scientific pitch notation', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToName(61)).toBe('C#4')
    expect(midiToName(72)).toBe('C5')
    expect(midiToName(48)).toBe('C3')
    expect(midiToName(57)).toBe('A3')
    expect(midiToName(69)).toBe('A4')
  })

  it('computes cents offset to a reference note', () => {
    expect(centsOffset(440, 69)).toBeCloseTo(0, 6)
    expect(centsOffset(261.63, 60)).toBeCloseTo(0, 1)
    expect(centsOffset(264, 60)).toBeGreaterThan(0)
    expect(centsOffset(261.63, 69)).toBeLessThan(0)
  })

  it('provides chart boundary constants', () => {
    expect(MIDI_C2).toBe(36)
    expect(MIDI_C3).toBe(48)
    expect(MIDI_C5).toBe(72)
    expect(MIDI_C6).toBe(84)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/pitchNotation.test.ts`
Expected: FAIL — module `../utils/pitch` cannot be found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/utils/pitch.ts`:

```ts
export const SEMITONE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const A4_MIDI = 69
export const A4_FREQ = 440

export const MIDI_C2 = 36
export const MIDI_C3 = 48
export const MIDI_C4 = 60
export const MIDI_C5 = 72
export const MIDI_C6 = 84

export function midiToFreq(midi: number): number {
  return A4_FREQ * 2 ** ((midi - A4_MIDI) / 12)
}

export function freqToMidi(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ)
}

export function nearestMidi(freq: number): number {
  return Math.round(freqToMidi(freq))
}

export function midiToName(midi: number): string {
  const m = Math.round(midi)
  const name = SEMITONE_NAMES[((m % 12) + 12) % 12]
  const octave = Math.floor(m / 12) - 1
  return `${name}${octave}`
}

export function centsOffset(freq: number, refMidi: number): number {
  return 1200 * Math.log2(freq / midiToFreq(refMidi))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/pitchNotation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/pitch.ts src/__tests__/pitchNotation.test.ts
git commit -m "feat: scientific pitch notation utils (freq <-> midi <-> note name)"
```

---

### Task 2: Piano tone synthesizer (`src/audio/PianoSynth.ts`)

Web Audio tone generator for the reference keyboard. A dedicated `AudioContext` (default device rate) avoids aliasing through the 16 kHz analysis engine. Envelope: fundamental + 2×/3× harmonics with exponential decay (~0.9 s), piano-ish but clean enough for pitch reference.

**Files:**
- Create: `src/audio/PianoSynth.ts`
- Test: `src/__tests__/PianoSynth.test.ts`
- Modify (dependency, already done in Task 1): `src/utils/pitch.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/PianoSynth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PianoSynth, getPianoSynth } from '../audio/PianoSynth'
import { midiToFreq } from '../utils/pitch'

const createdOscs: any[] = []
const createdCtxs: any[] = []

function mockAudioContext() {
  createdOscs.length = 0
  createdCtxs.length = 0
  const osc = () => {
    const o: any = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }
    createdOscs.push(o)
    return o
  }
  const gain = () => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
  const ctx: any = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(osc),
    createGain: vi.fn(gain),
  }
  createdCtxs.push(ctx)
  return ctx
}

let origAudioContext: typeof globalThis.AudioContext

describe('PianoSynth', () => {
  beforeAll(() => {
    origAudioContext = globalThis.AudioContext
    globalThis.AudioContext = mockAudioContext as unknown as typeof AudioContext
  })

  afterAll(() => {
    globalThis.AudioContext = origAudioContext
  })

  it('creates 3 oscillators at 1x/2x/3x the note frequency', () => {
    const synth = new PianoSynth()
    synth.play(60)
    expect(createdOscs).toHaveLength(3)
    expect(createdOscs[0].frequency.value).toBeCloseTo(midiToFreq(60), 1)
    expect(createdOscs[1].frequency.value).toBeCloseTo(midiToFreq(60) * 2, 1)
    expect(createdOscs[2].frequency.value).toBeCloseTo(midiToFreq(60) * 3, 1)
  })

  it('resumes a suspended AudioContext on play', () => {
    const synth = new PianoSynth()
    synth.play(72)
    expect(createdCtxs[0].resume).toHaveBeenCalled()
  })

  it('stopAll() closes the AudioContext', () => {
    const synth = new PianoSynth()
    synth.play(60)
    synth.stopAll()
    expect(createdCtxs[0].close).toHaveBeenCalled()
  })

  it('returns the same singleton instance', () => {
    expect(getPianoSynth()).toBe(getPianoSynth())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/PianoSynth.test.ts`
Expected: FAIL — module `../audio/PianoSynth` cannot be found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/audio/PianoSynth.ts`:

```ts
import { midiToFreq } from '../utils/pitch'

interface SynthEntry {
  oscs: OscillatorNode[]
  gain: GainNode
  remaining: number
}

const DEFAULT_DURATION = 0.9
const HARMONIC_AMPS = [1, 0.5, 0.25]

export class PianoSynth {
  private ctx: AudioContext | null = null
  private active = new Map<number, SynthEntry>()

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  play(midi: number, duration: number = DEFAULT_DURATION): AudioContext {
    const ctx = this.getContext()
    const freq = midiToFreq(midi)
    const start = ctx.currentTime

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    gain.connect(ctx.destination)

    const oscs: OscillatorNode[] = []
    for (const amp of HARMONIC_AMPS) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * (oscs.length + 1)
      const vg = ctx.createGain()
      vg.gain.value = amp
      osc.connect(vg)
      vg.connect(gain)
      osc.start(start)
      osc.stop(start + duration)
      osc.onended = () => this.release(midi)
      oscs.push(osc)
    }

    this.active.set(midi, { oscs, gain, remaining: oscs.length })
    return ctx
  }

  private release(midi: number): void {
    const entry = this.active.get(midi)
    if (!entry) return
    entry.remaining -= 1
    if (entry.remaining <= 0) {
      entry.gain.disconnect()
      this.active.delete(midi)
    }
  }

  stopAll(): void {
    for (const entry of this.active.values()) {
      for (const osc of entry.oscs) {
        try { osc.stop() } catch { /* already stopped */ }
      }
      entry.gain.disconnect()
    }
    this.active.clear()
    if (this.ctx) {
      void this.ctx.close()
      this.ctx = null
    }
  }
}

let instance: PianoSynth | null = null

export function getPianoSynth(): PianoSynth {
  if (!instance) instance = new PianoSynth()
  return instance
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/PianoSynth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/audio/PianoSynth.ts src/__tests__/PianoSynth.test.ts
git commit -m "feat: PianoSynth Web Audio tone generator (3 harmonics + decay)"
```

---

### Task 3: Piano keyboard component (`src/components/Piano.tsx`)

48 keys C2–B5 (MIDI 36–83). White keys in a flex row; black keys absolutely positioned inside the preceding white key's wrap. Highlights the live detected note via `currentMidi`.

**Files:**
- Create: `src/components/Piano.tsx`
- Create: `src/components/Piano.module.css`
- Test: `src/__tests__/Piano.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/Piano.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Piano } from '../components/Piano'

describe('Piano', () => {
  it('renders 25 keys (C3-C5 inclusive)', () => {
    render(<Piano onKeyPress={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(25)
  })

  it('fires onKeyPress with the midi note on click', () => {
    const onKeyPress = vi.fn()
    render(<Piano onKeyPress={onKeyPress} />)
    fireEvent.click(screen.getByRole('button', { name: 'C4' }))
    expect(onKeyPress).toHaveBeenCalledWith(60)
  })

  it('highlights the current midi note', () => {
    render(<Piano currentMidi={61} onKeyPress={() => {}} />)
    const csharp4 = screen.getByRole('button', { name: 'C#4' })
    expect(csharp4.getAttribute('data-active')).toBe('true')
    const c4 = screen.getByRole('button', { name: 'C4' })
    expect(c4.getAttribute('data-active')).toBe('false')
  })

  it('holds no active key when currentMidi is null', () => {
    render(<Piano currentMidi={null} onKeyPress={() => {}} />)
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('data-active')).not.toBe('true')
    }
  })

  it('labels the C octave keys C3/C4/C5', () => {
    render(<Piano onKeyPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'C3' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'C4' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'C5' })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/Piano.test.tsx`
Expected: FAIL — module `../components/Piano` cannot be found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/Piano.tsx`:

```tsx
import styles from './Piano.module.css'
import { MIDI_C3, MIDI_C5, midiToName } from '../utils/pitch'

const BLACK_MIDI_RESIDUES = new Set([1, 3, 6, 8, 10])

function isWhite(midi: number): boolean {
  return !BLACK_MIDI_RESIDUES.has(midi % 12)
}

const WHITE_NOTES: number[] = (() => {
  const out: number[] = []
  for (let m = MIDI_C3; m <= MIDI_C5; m++) {
    if (isWhite(m)) out.push(m)
  }
  return out
})()

function hasBlackAfter(white: number): boolean {
  return white + 1 <= MIDI_C5 && BLACK_MIDI_RESIDUES.has((white + 1) % 12)
}

interface PianoProps {
  currentMidi?: number | null
  onKeyPress: (midi: number) => void
}

export function Piano({ currentMidi = null, onKeyPress }: PianoProps) {
  return (
    <div className={styles.piano} role="group" aria-label="钢琴 C3-C5">
      {WHITE_NOTES.map(white => (
        <div key={white} className={styles.whiteWrap}>
          <button
            type="button"
            className={styles.white}
            data-active={currentMidi === white}
            aria-label={midiToName(white)}
            aria-pressed={currentMidi === white}
            onClick={() => onKeyPress(white)}
          >
            {white % 12 === 0 && <span className={styles.noteLabel}>{midiToName(white)}</span>}
          </button>
          {hasBlackAfter(white) && (
            <button
              type="button"
              className={styles.black}
              data-active={currentMidi === white + 1}
              aria-label={midiToName(white + 1)}
              aria-pressed={currentMidi === white + 1}
              onClick={() => onKeyPress(white + 1)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
```

Create `src/components/Piano.module.css`:

```css
.piano {
  display: flex;
  gap: 2px;
  height: 170px;
  padding: 10px 12px;
  user-select: none;
  background: #F9FAFB;
  border-radius: var(--radius-sm);
}
.whiteWrap {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
}
.white {
  flex: 1;
  border: 1px solid var(--border-strong);
  border-radius: 0 0 5px 5px;
  background: linear-gradient(#fff, #F2F4F7);
  cursor: pointer;
  padding: 0;
  padding-bottom: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-mute);
}
.white:hover, .black:hover { filter: brightness(0.96); }
.white[data-active="true"] {
  background: var(--info-soft);
  border-color: var(--info);
  color: var(--info);
}
.black {
  position: absolute;
  top: 0;
  left: 58%;
  width: 58%;
  height: 62%;
  border: none;
  border-radius: 0 0 4px 4px;
  background: linear-gradient(#374151, #111827);
  cursor: pointer;
  z-index: 2;
}
.black[data-active="true"] { background: var(--info); }
.noteLabel { pointer-events: none; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/Piano.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/Piano.tsx src/components/Piano.module.css src/__tests__/Piano.test.tsx
git commit -m "feat: Piano keyboard component (C3-C5, live note highlight)"
```

---

### Task 4: Pitch chart in scientific notation (`src/components/PitchChart.tsx`)

F0 contour whose Y axis is note-index (MIDI) over G2–E5 (43–76), every natural note labeled with a horizontal gridline (no sharps), piano zone C2–B5 shaded via markArea, C4 dashed markLine, tooltip shows `♬ C4`. Mirrors `F0Chart`'s render structure (rAF on frames, sync on cursorTime, initial sync) so tests are deterministic.

**Files:**
- Create: `src/components/PitchChart.tsx`
- Test: `src/__tests__/PitchChart.test.tsx`
- Modify (dependency, already done in Task 1): `src/utils/pitch.ts` (adds `MIDI_C4`, already present)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/PitchChart.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PitchChart } from '../components/PitchChart'
import { useAppStore } from '../store/appStore'
import { freqToMidi, midiToFreq } from '../utils/pitch'

const { setOptionMock, getInstanceMock } = vi.hoisted(() => ({
  setOptionMock: vi.fn(),
  getInstanceMock: vi.fn(() => null),
}))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: getInstanceMock,
  }),
}))

function lastOption() {
  const calls = setOptionMock.mock.calls
  return calls[calls.length - 1][0]
}

function pitchSeries() {
  return lastOption().series.find((s: { name: string }) => s.name === 'PITCH')
}

describe('PitchChart', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('maps Y axis to C2-C6 midi range', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    expect(lastOption().yAxis.min).toBe(36)
    expect(lastOption().yAxis.max).toBe(84)
  })

  it('labels Y axis with scientific pitch names', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    expect(lastOption().yAxis.axisLabel.formatter(60)).toBe('C4')
    expect(lastOption().yAxis.axisLabel.formatter(61)).toBe('C#4')
  })

  it('renders f0 as continuous midi values', () => {
    useAppStore.getState().setFrames([
      { time: 0.1, f0: 220, f1: 0, f2: 0 },
      { time: 0.2, f0: 225, f1: 0, f2: 0 },
    ])
    render(<PitchChart />)
    const data = pitchSeries().data as [number, number | null][]
    expect(data).toHaveLength(2)
    expect(data[0][0]).toBe(0.1)
    expect(data[0][1]).toBeCloseTo(freqToMidi(220), 4)
    expect(data[1][1]).toBeCloseTo(freqToMidi(225), 4)
  })

  it('shades the C3-C5 piano zone and marks C4', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const markArea = pitchSeries().markArea.data[0]
    expect(markArea[0].yAxis).toBe(48)
    expect(markArea[1].yAxis).toBe(72)
    const markLine = pitchSeries().markLine.data[0]
    expect(markLine.yAxis).toBe(60)
  })

  it('formats tooltip with note name and cents', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    const html = formatter([{ value: [0.1, freqToMidi(261.63)] }])
    expect(html).toContain('C4')
    expect(html).toContain('+0')
    expect(html).toContain('音分')
  })

  it('formats tooltip as placeholder when pitch is null', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: null, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    expect(formatter([{ value: [0.1, null] }])).toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/PitchChart.test.tsx`
Expected: FAIL — module `../components/PitchChart` cannot be found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/PitchChart.tsx`:

```tsx
import { useRef, useEffect } from 'react'
import { useECharts } from '../hooks/useECharts'
import { useAppStore } from '../store/appStore'
import type { AnalysisFrame } from '../types'
import {
  freqToMidi,
  midiToName,
  midiToFreq,
  nearestMidi,
  centsOffset,
  MIDI_C2,
  MIDI_C3,
  MIDI_C4,
  MIDI_C5,
  MIDI_C6,
} from '../utils/pitch'

const WINDOW = 10

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface PitchChartProps {
  cursorTime?: number
}

export function PitchChart({ cursorTime = -1 }: PitchChartProps) {
  const frames = useAppStore(s => s.frames)
  const { chartRef, setOption } = useECharts()
  const rafRef = useRef<number | null>(null)
  const isLiveRef = useRef(false)

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderChart(frames, cursorTime, isLiveRef.current)
      rafRef.current = null
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [frames, cursorTime]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    renderChart(frames, cursorTime, isLiveRef.current)
  }, [cursorTime]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    isLiveRef.current = frames.length > 1
  }, [frames.length])

  function renderChart(data: AnalysisFrame[], cursor: number, isLive: boolean) {
    const seriesData = data.map(f =>
      f.f0 && f.f0 > 0 ? [f.time, freqToMidi(f.f0)] : [f.time, null],
    )

    const hasData = data.length > 0
    let minTime: number, maxTime: number
    if (isLive && hasData) {
      const currentTime = data[data.length - 1].time
      minTime = currentTime - WINDOW
      maxTime = currentTime
    } else if (hasData) {
      minTime = data[0].time
      maxTime = Math.max(data[data.length - 1].time, minTime + WINDOW)
    } else {
      minTime = 0
      maxTime = WINDOW
    }

    setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 60, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const p = params[0]
          const time = p.value?.[0]
          const midi = p.value?.[1]
          let pitchText = '--'
          if (midi != null && Number.isFinite(midi)) {
            const freq = midiToFreq(midi)
            const note = nearestMidi(freq)
            const cents = Math.round(centsOffset(freq, note))
            pitchText = `${midiToName(note)} ${cents >= 0 ? '+' : ''}${cents} 音分`
          }
          return `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>
<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E23E57;"></span>
  <span style="flex:0 0 auto;color:#475467;">音高</span>
  <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">♬ ${pitchText}</span>
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
        min: MIDI_C2,
        max: MIDI_C6,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v: number) => midiToName(v) },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: ['#E23E57'],
      series: [
        {
          name: 'PITCH',
          type: 'line' as const,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: '#E23E57', width: 2 },
          itemStyle: { color: '#E23E57' },
          markArea: {
            silent: true,
            data: [[{
              yAxis: MIDI_C3,
              itemStyle: { color: hexToRgba('#3B82F6', 0.05) },
            }, { yAxis: MIDI_C5 }]],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: hexToRgba('#3B82F6', 0.45), type: 'dashed' as const, width: 1 },
            label: { formatter: 'C4', color: '#667085', fontSize: 11, position: 'insideEndTop' },
            data: [{ yAxis: MIDI_C4 }],
          },
          data: seriesData,
        },
        {
          name: '__cursor',
          type: 'line' as const,
          showSymbol: false,
          data: [],
          markLine: cursor >= 0 ? {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#E23E57', width: 2, type: 'solid' as const },
            label: { show: false },
            data: [{ xAxis: cursor }],
          } : undefined,
        },
      ],
    } as any)
  }

  useEffect(() => {
    renderChart(frames, cursorTime, isLiveRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="pitchChart" ref={chartRef} />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/PitchChart.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/PitchChart.tsx src/__tests__/PitchChart.test.tsx
git commit -m "feat: PitchChart with scientific pitch notation Y-axis and C4 tooltip"
```

---

### Task 5: Toolbar centered page-switch slot

Adds an optional `nav` slot centered between brand and actions. Pure renderer: AppShell passes label + handler; nothing routed through `handleClickTool` (page switch must not interrupt audio).

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/Toolbar.module.css`
- Test: `src/__tests__/Toolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/Toolbar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from '../components/Toolbar'
import type { ToolItem } from '../hooks/useToolbar'

const ITEMS: ToolItem[] = [
  { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
]

describe('Toolbar', () => {
  it('renders centered nav button when nav prop is provided', () => {
    render(
      <Toolbar
        toolItems={ITEMS}
        onToolClick={() => {}}
        nav={{ label: '⇄ 钢琴训练', onClick: vi.fn() }}
      />,
    )
    expect(screen.getByRole('button', { name: /钢琴训练/ })).toBeDefined()
  })

  it('omits nav region when nav prop is undefined', () => {
    render(<Toolbar toolItems={ITEMS} onToolClick={() => {}} />)
    expect(screen.queryByRole('button', { name: /钢琴训练/ })).toBeNull()
  })

  it('fires nav onClick', () => {
    const onNav = vi.fn()
    render(
      <Toolbar
        toolItems={ITEMS}
        onToolClick={() => {}}
        nav={{ label: '⇄ 返回分析', onClick: onNav }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /返回分析/ }))
    expect(onNav).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/Toolbar.test.tsx`
Expected: FAIL — the nav button is not rendered (prop doesn't exist yet).

- [ ] **Step 3: Implement**

Modify `src/components/Toolbar.tsx`. Replace lines 6–10 (interface) and lines 11–35 (function) with:

```tsx
interface ToolbarProps {
  toolItems: ToolItem[]
  onToolClick: (toolId: string) => void
  nav?: { label: string; onClick: () => void }
}

export function Toolbar({ toolItems, onToolClick, nav }: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
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
    </header>
  )
}
```

Modify `src/components/Toolbar.module.css`. Add after the `.actions` rule (line 40):

```css
.nav {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/Toolbar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/Toolbar.tsx src/components/Toolbar.module.css src/__tests__/Toolbar.test.tsx
git commit -m "feat: centered page-switch slot in Toolbar"
```

---

### Task 6: Shared shell + routing (`AppShell`, `App.tsx`), slim `AnalysisPage`

`AppShell` permanently holds `useToolbar` (recording/playback lifecycle survives page switches), the drawers, toast, and hidden file input. Pages receive `cursorTime`/`hasData` via `<Outlet context>`. `App.tsx` becomes a layout route. Nothing here should break existing behavior.

**Files:**
- Create: `src/routes/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/routes/AnalysisPage.tsx` (slim)
- Modify: `src/__tests__/AnalysisPage.test.tsx` (wrap in route context harness)
- Test: `src/__tests__/AppShell.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-13-practice-page-design.md` (line in §1 that says AnalysisPage uses no router hooks)

- [ ] **Step 1: Write the failing AppShell test**

Create `src/__tests__/AppShell.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { AppShell } from '../routes/AppShell'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

vi.mock('../hooks/useToolbar', () => ({
  useToolbar: () => ({
    toolItems: [
      { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
    ],
    handleClickTool: vi.fn(),
    hasData: true,
    cursorTime: 3,
    fileInputRef: { current: null },
    handleFileChange: vi.fn(),
  }),
}))

function ProbePage() {
  const ctx = useOutletContext<{ cursorTime: number; hasData: boolean }>()
  return <div>practice-content {ctx.cursorTime}</div>
}

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>analysis-content</div>} />
          <Route path="practice" element={<ProbePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('shows analysis page with "go to practice" nav by default', () => {
    renderApp('/')
    expect(screen.getByText('analysis-content')).toBeDefined()
    expect(screen.getByRole('button', { name: /钢琴训练/ })).toBeDefined()
  })

  it('navigates to practice and flips the nav label', () => {
    renderApp('/')
    fireEvent.click(screen.getByRole('button', { name: /钢琴训练/ }))
    expect(screen.getByText(/practice-content/)).toBeDefined()
    expect(screen.getByRole('button', { name: /返回分析/ })).toBeDefined()
  })

  it('passes cursorTime through outlet context', () => {
    renderApp('/practice')
    expect(screen.getByText('practice-content 3')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AppShell.test.tsx`
Expected: FAIL — module `../routes/AppShell` cannot be found.

- [ ] **Step 3: Create `src/routes/AppShell.tsx`**

```tsx
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { Toolbar } from '../components/Toolbar'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'

export interface ShellContext {
  cursorTime: number
  hasData: boolean
}

export function AppShell() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isPractice = pathname === '/practice'

  const { toolItems, handleClickTool, cursorTime, hasData, fileInputRef, handleFileChange }
    = useToolbar(
      () => setConfigOpen(true),
      () => setHelpOpen(true),
      () => setAboutOpen(true),
    )

  const togglePage = () => navigate(isPractice ? '/' : '/practice')

  return (
    <>
      <Toolbar
        toolItems={toolItems}
        onToolClick={handleClickTool}
        nav={{ label: isPractice ? '⇄ 返回分析' : '⇄ 钢琴训练', onClick: togglePage }}
      />
      <Outlet context={{ cursorTime, hasData } satisfies ShellContext} />
      <Toast />
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
    </>
  )
}
```

- [ ] **Step 4: Update `src/App.tsx`**

Replace the whole file:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './routes/AppShell'
import { AnalysisPage } from './routes/AnalysisPage'
import { PracticePage } from './routes/PracticePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<AnalysisPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

Note: `PracticePage` doesn't exist until Task 7 — `npx tsc --noEmit` will fail until then. That is expected; run tests (which do not compile App.tsx) rather than typecheck in the inter-step below.

- [ ] **Step 5: Slim `src/routes/AnalysisPage.tsx`**

Remove these imports/lines: `useState`, `useToolbar`, `Toolbar`, `ConfigDrawer`, `HelpDrawer`, `AboutModal`, `Toast`, and the `input` at the bottom. The page reads shared context via `useOutletContext` instead of `useToolbar`. Final file:

```tsx
import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ShellContext } from './AppShell'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { FeedbackCard } from '../components/FeedbackCard'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { EmptyState } from '../components/EmptyState'
import { TipWidget } from '../components/TipWidget'
import type { FormantSeries } from '../types'
import styles from './AnalysisPage.module.css'

const LEGEND_KEYS = ['f0', 'f1', 'f2'] as const

const COLORS: Record<FormantSeries, string> = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

export function AnalysisPage() {
  const { cursorTime, hasData } = useOutletContext<ShellContext>()

  const formantVisible = useAppStore(s => s.formantVisible)
  const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <div className={styles.sidePanel}>
          <TargetPresetBar />
          <FeedbackCard />
        </div>

        <div className={styles.chartsColumn}>
          <section className={`${styles.card} ${styles.chartsColumnCard}`}>
            <div className={styles.chartWrapper}>
              <div className={styles.chartHeader}>
                <h2 className={styles.cardTitle}>基频</h2>
              </div>
              <div className={styles.chartArea}>
                <F0Chart cursorTime={cursorTime} />
                <EmptyState
                  title="还没有声音数据"
                  description="🎤 点击顶栏'开始录音'试试"
                  visible={!hasData}
                />
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.chartsColumnCard}`}>
            <div className={styles.chartWrapper}>
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
                      <i style={{ background: COLORS[key] }}></i>{key.toUpperCase()}
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
            </div>
          </section>
        </div>
      </main>

      <TipWidget />
    </div>
  )
}
```

- [ ] **Step 6: Update `src/__tests__/AnalysisPage.test.tsx` harness**

Wrap rendering in a router so `useOutletContext` resolves. Replace lines 1–28 and the `render(<AnalysisPage />)` call. New header + helper:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AnalysisPage } from '../routes/AnalysisPage'
import { useAppStore } from '../store/appStore'

const { setOptionMock, getInstanceMock } = vi.hoisted(() => ({
  setOptionMock: vi.fn(),
  getInstanceMock: vi.fn(() => null),
}))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: getInstanceMock,
  }),
}))

function renderAnalysisPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Outlet context={{ cursorTime: -1, hasData: true }} />}>
          <Route index element={<AnalysisPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
```

The rest of the file (FRAMES, `lastFormantOption`, `f1Series`, describe block) stays unchanged except `render(<AnalysisPage />)` → `renderAnalysisPage()`.

- [ ] **Step 7: Run the two affected tests**

Run: `npx vitest run src/__tests__/AppShell.test.tsx src/__tests__/AnalysisPage.test.tsx`
Expected: PASS — 3 AppShell + 1 AnalysisPage. (Modify the `render(<AnalysisPage />)` line first.)

- [ ] **Step 8: Amend the spec line about AnalysisPage router usage**

In `docs/superpowers/specs/2026-09-13-practice-page-design.md` §1, replace:

> 不使用任何 router hook，现有测试裸渲染不变。

with:

> 通过 `useOutletContext` 接收 `cursorTime` / `hasData`；测试改为在 MemoryRouter + 布局 Route 中渲染。

- [ ] **Step 9: Commit**

```bash
git add src/routes/AppShell.tsx src/App.tsx src/routes/AnalysisPage.tsx src/__tests__/AppShell.test.tsx src/__tests__/AnalysisPage.test.tsx docs/superpowers/specs/2026-09-13-practice-page-design.md
git commit -m "refactor: shared AppShell shell with route layout and outlet context"
```

---

### Task 7: Practice page (`src/routes/PracticePage.tsx`) + chart sizing

Wires Piano + PitchChart into a page with cards, reading `cursorTime`/`hasData` from shell context. Highlights the piano key only when the detected pitch falls inside C2–B5.

**Files:**
- Create: `src/routes/PracticePage.tsx`
- Create: `src/routes/PracticePage.module.css`
- Modify: `css/style.css` (add `#pitchChart` sizing)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/PracticePage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { PracticePage } from '../routes/PracticePage'
import { getPianoSynth } from '../audio/PianoSynth'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

vi.mock('../audio/PianoSynth', () => ({
  getPianoSynth: () => ({ play: vi.fn(), stopAll: vi.fn() }),
}))

function framelessFrames(f0: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1: 0, f2: 0 }])
}

function renderPracticePage() {
  return render(
    <MemoryRouter initialEntries={['/practice']}>
      <Routes>
        <Route element={<Outlet context={{ cursorTime: -1, hasData: true }} />}>
          <Route path="practice" element={<PracticePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PracticePage', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('renders the piano and pitch chart cards', () => {
    renderPracticePage()
    expect(screen.getByRole('group', { name: /钢琴/ })).toBeDefined()
    expect(screen.getByText('音高谱（科学记谱法）')).toBeDefined()
  })

  it('highlights the detected note when within C3-C5', () => {
    framelessFrames(261.63) // C4
    renderPracticePage()
    const c4 = screen.getByRole('button', { name: 'C4' })
    expect(c4.getAttribute('data-active')).toBe('true')
  })

  it('does not highlight when pitch is outside C3-C5', () => {
    framelessFrames(1300) // E6 > C5
    renderPracticePage()
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('data-active')).not.toBe('true')
    }
  })

  it('does not highlight when pitch is null', () => {
    framelessFrames(null)
    renderPracticePage()
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('data-active')).not.toBe('true')
    }
  })

  it('plays the reference tone on key press', () => {
    const play = vi.fn()
    vi.mocked(getPianoSynth).mockReturnValue({ play, stopAll: vi.fn() } as any)
    renderPracticePage()
    fireEvent.click(screen.getByRole('button', { name: 'C4' }))
    expect(play).toHaveBeenCalledWith(60)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/PracticePage.test.tsx`
Expected: FAIL — module `../routes/PracticePage` cannot be found.

- [ ] **Step 3: Create `src/routes/PracticePage.tsx`**

```tsx
import { useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ShellContext } from './AppShell'
import { Piano } from '../components/Piano'
import { PitchChart } from '../components/PitchChart'
import { EmptyState } from '../components/EmptyState'
import { getPianoSynth } from '../audio/PianoSynth'
import { nearestMidi, MIDI_C3, MIDI_C5 } from '../utils/pitch'
import styles from './PracticePage.module.css'

export function PracticePage() {
  const { cursorTime, hasData } = useOutletContext<ShellContext>()
  const latestFrame = useAppStore(s => s.latestFrame)

  const f0 = latestFrame?.f0 ?? null
  let currentMidi: number | null = null
  if (f0 && f0 > 0) {
    const m = nearestMidi(f0)
    if (m >= MIDI_C3 && m <= MIDI_C5) currentMidi = m
  }

  const playNote = (midi: number) => getPianoSynth().play(midi)

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <section className={styles.card}>
          <div className={styles.chartHeader}>
            <h2 className={styles.cardTitle}>钢琴 C3–C5 · 点击听参考音</h2>
          </div>
          <div className={styles.pianoArea}>
            <Piano currentMidi={currentMidi} onKeyPress={playNote} />
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.chartWrapper}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle}>音高谱（科学记谱法）</h2>
            </div>
            <div className={styles.chartArea}>
              <PitchChart cursorTime={cursorTime} />
              <EmptyState
                title="还没有声音数据"
                description="🎤 点击顶栏'开始录音'试试"
                visible={!hasData}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
```

Create `src/routes/PracticePage.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cardTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  white-space: nowrap;
}
.chartHeader {
  display: flex;
  gap: 6px;
  padding: 12px 14px 0;
}
.pianoArea {
  padding: 10px 14px 14px;
}
.chartWrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: calc(100% - 20px);
  height: min(42vh, 420px);
  min-height: 280px;
  background: #FAFBFC;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 10px auto;
  padding: 8px 10px;
}
.chartArea {
  position: relative;
  flex: 1 1 auto;
  min-height: 120px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .content { padding: 14px; }
}
```

- [ ] **Step 4: Add `#pitchChart` sizing to `css/style.css`**

Replace lines 66–71:

```css
/* ---------- ECharts 容器 (ID 选择器) ---------- */
#f0Chart, #formantChart, #pitchChart {
  width: 100%;
  height: 100%;
  display: block;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/PracticePage.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Full verification**

```bash
npx tsc --noEmit
npm test
```

Expected: typecheck clean; all tests pass (208 baseline + new: 7 pitch + 4 PianoSynth + 5 Piano + 6 PitchChart + 3 Toolbar + 3 AppShell + 5 PracticePage = 241).

- [ ] **Step 7: Commit**

```bash
git add src/routes/PracticePage.tsx src/routes/PracticePage.module.css css/style.css src/__tests__/PracticePage.test.tsx
git commit -m "feat: practice page wiring Piano + PitchChart with live note highlight"
```

---

### Task 8: Manual sanity check (dev server)

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify in browser**
  1. Toolbar shows no centered button removal — brand left, centered ⇄ **音高参考** (icon `⇄`, label `音高参考`), actions right.
  2. Analysis page still renders charts; clicking record works.
  3. Click `⇄ 音高参考` → practice page: C2–B5 piano renders, click keys → distinct pitched tones, pitch chart card visible.
  4. Record while on piano page → consecutive notes light up the matching piano key; tooltip over curve shows `♬ C4`.
  5. Click `⇄ 返回分析` while recording → recording did NOT stop, charts continue, `isCapturing` button still shows 停止录音.
  6. Import a WAV → frames populate pitch chart; playback cursor line works.