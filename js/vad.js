export class VoiceActivityDetector {
  constructor({ threshold = 0.008 } = {}) {
    this._threshold = threshold
  }

  compute(samples) {
    let sumSq = 0
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSq / samples.length)
    return { voiced: rms >= this._threshold, rms }
  }
}
