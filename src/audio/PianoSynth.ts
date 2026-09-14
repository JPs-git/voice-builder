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
  private active = new Set<SynthEntry>()

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  play(midi: number, duration: number = DEFAULT_DURATION): void {
    const ctx = this.getContext()
    const freq = midiToFreq(midi)
    const start = ctx.currentTime

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    gain.connect(ctx.destination)

    const entry: SynthEntry = { oscs: [], gain, remaining: HARMONIC_AMPS.length }
    this.active.add(entry)

    for (const amp of HARMONIC_AMPS) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * (entry.oscs.length + 1)
      const vg = ctx.createGain()
      vg.gain.value = amp
      osc.connect(vg)
      vg.connect(gain)
      osc.start(start)
      osc.stop(start + duration)
      osc.onended = () => this.release(entry)
      entry.oscs.push(osc)
    }
  }

  private release(entry: SynthEntry): void {
    if (!this.active.has(entry)) return
    entry.remaining -= 1
    if (entry.remaining <= 0) {
      entry.gain.disconnect()
      this.active.delete(entry)
    }
  }

  stopAll(): void {
    for (const entry of this.active) {
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