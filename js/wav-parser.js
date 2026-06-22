function readSample(view, offset, bitsPerSample) {
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
      return view.getFloat32(offset, true)
    default:
      throw new Error(`Unsupported bitsPerSample: ${bitsPerSample}`)
  }
}

export function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer)

  const riff = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4))
  if (riff !== 'RIFF') throw new Error('Not a RIFF file')

  const wave = String.fromCharCode(...new Uint8Array(arrayBuffer, 8, 4))
  if (wave !== 'WAVE') throw new Error('Not a WAV file')

  let audioFormat = 0, numChannels = 0, sampleRate = 0, bitsPerSample = 0
  let fmtFound = false
  let dataStart = 0, dataSize = 0

  let offset = 12
  while (offset < arrayBuffer.byteLength - 8) {
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
      dataSize = chunkSize
      break
    }

    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }

  if (!dataSize) throw new Error('data chunk not found')

  const bytesPerSample = bitsPerSample / 8
  const totalSamples = dataSize / bytesPerSample
  const totalFrames = totalSamples / numChannels

  const samples = new Float32Array(totalFrames)
  for (let i = 0; i < totalFrames; i++) {
    const byteOff = dataStart + i * numChannels * bytesPerSample
    samples[i] = readSample(view, byteOff, bitsPerSample)
  }

  return { samples, sampleRate, numChannels, bitsPerSample, audioFormat }
}
