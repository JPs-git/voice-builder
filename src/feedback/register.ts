import type { VoiceRegister } from '../types'

export const VOICE_REGISTER_LABELS: Readonly<Record<VoiceRegister, string>> = {
  chest: '真声',
  mixed: '混声',
  falsetto: '假声',
  unvoiced: '—',
}
