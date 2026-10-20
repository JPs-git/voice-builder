import {fftMagnitudes} from './fft'
import {VoiceActivityDetector,DEFAULT_VAD_OPTIONS} from './vad'
import type {VadOptions} from './vad'
import {hasSpeechSpectrum} from './speech-spectrum'

export class VoicedFrameAnalyzer {
  private vad:VoiceActivityDetector
  constructor(options:VadOptions=DEFAULT_VAD_OPTIONS) { this.vad=new VoiceActivityDetector(options) }
  analyze(frame:Float32Array,realLength:number,sampleRate:number,elapsedMs:number) {
    const samples=frame.subarray(0,Math.max(0,Math.min(frame.length,realLength)))
    const enough=samples.length>=400
    const magnitudes=fftMagnitudes(enough?samples:frame,2048)
    const {voiced,rms}=this.vad.compute(samples,elapsedMs,enough&&hasSpeechSpectrum(magnitudes,sampleRate))
    return {samples,magnitudes,voiced,rms}
  }
  reset(){this.vad.reset()}
}
