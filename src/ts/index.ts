import { AudioEngine, type AudioEngineOptions } from './AudioEngine'

export { AudioEngine, type AudioEngineOptions }

let instance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!instance) {
    instance = new AudioEngine()
  }
  return instance
}

export function resetAudioEngine(): void {
  instance?.destroy()
  instance = null
}
