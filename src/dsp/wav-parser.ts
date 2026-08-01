export interface WavResult {
  samples: Float32Array
  sampleRate: number
  numChannels: number
  bitsPerSample: number
  audioFormat: number
}

function readSample(view: DataView, offset: number, bitsPerSample: number, audioFormat: number): number {
  switch (bitsPerSample) {
    case 8:
      return (view.getUint8(offset) - 128) / 128
    case 16:
      return view.getInt16(offset, true) / 32768
    case 24: {
      let val = view.getUint8(offset)
        | (view.getUint8(offset + 1) << 8)
        | (view.getUint8(offset + 2) << 16)
      if (val & 0x800000) val |= ~0xffffff
      return val / 8388608
    }
    case 32:
      return audioFormat === 3
        ? view.getFloat32(offset, true)
        : view.getInt32(offset, true) / 2147483648
    default:
      throw new Error(`Unsupported bitsPerSample: ${bitsPerSample}`)
  }
}

export function isWavFile(arrayBuffer: ArrayBuffer): boolean {
  if (arrayBuffer.byteLength < 12) return false
  const uint8 = new Uint8Array(arrayBuffer, 0, 12)
  const riff = String.fromCharCode(...uint8.subarray(0, 4))
  const wave = String.fromCharCode(...uint8.subarray(8, 12))
  return riff === 'RIFF' && wave === 'WAVE'
}

export function parseWav(arrayBuffer: ArrayBuffer): WavResult {
  const view = new DataView(arrayBuffer)
  const uint8 = new Uint8Array(arrayBuffer, 0, 4)

  const riff = String.fromCharCode(...uint8)
  if (riff !== 'RIFF') throw new Error('Not a RIFF file')

  const wave = String.fromCharCode(...new Uint8Array(arrayBuffer, 8, 4))
  if (wave !== 'WAVE') throw new Error('Not a WAV file')

  let audioFormat = 0, numChannels = 0, sampleRate = 0, bitsPerSample = 0
  let fmtFound = false
  let dataStart = 0, dataSize = 0
  let dataFound = false

  let offset = 12
  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkId = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4))
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true)
      numChannels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
      fmtFound = true
    } else if (chunkId === 'data') {
      if (!fmtFound) throw new Error('fmt chunk not found before data')
      dataStart = offset + 8
      dataSize = Math.min(chunkSize, arrayBuffer.byteLength - dataStart)
      dataFound = true
      break
    }

    let nextOffset = offset + 8 + chunkSize
    if (nextOffset > arrayBuffer.byteLength) break
    if (chunkSize % 2 !== 0) nextOffset++
    if (nextOffset > arrayBuffer.byteLength) break
    offset = nextOffset
  }

  if (!dataFound) throw new Error('data chunk not found')
  if (dataSize === 0) {
    return { samples: new Float32Array(0), sampleRate, numChannels, bitsPerSample, audioFormat }
  }

  const bytesPerSample = bitsPerSample / 8
  const totalSamples = Math.floor(dataSize / bytesPerSample)
  const totalFrames = Math.floor(totalSamples / numChannels)

  const samples = new Float32Array(totalFrames)
  for (let i = 0; i < totalFrames; i++) {
    const byteOff = dataStart + i * numChannels * bytesPerSample
    samples[i] = readSample(view, byteOff, bitsPerSample, audioFormat)
  }

  return { samples, sampleRate, numChannels, bitsPerSample, audioFormat }
}
