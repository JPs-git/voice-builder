import {it,expect,vi,beforeEach} from 'vitest'
import {importRecordingFile} from '../recording/importClip'
import {probeAudioDuration,decodeAudioFile,probeWavDuration} from '../audio/audioDecoder'
import {isWavFile,parseWav} from '../dsp/wav-parser'
vi.mock('../audio/audioDecoder',()=>({probeAudioDuration:vi.fn(),probeWavDuration:vi.fn(),decodeAudioFile:vi.fn()}))
vi.mock('../dsp/wav-parser',()=>({isWavFile:vi.fn(),parseWav:vi.fn()}))
const file={name:'test.mp3',size:12,slice:()=>({arrayBuffer:async()=>new ArrayBuffer(12)}),arrayBuffer:async()=>new ArrayBuffer(12)} as unknown as File
beforeEach(()=>{vi.resetAllMocks();vi.mocked(isWavFile).mockReturnValue(false);vi.mocked(probeAudioDuration).mockResolvedValue(45)})
it('accepts a complete 45 second clip and retains source metadata',async()=>{
 vi.mocked(decodeAudioFile).mockResolvedValue({samples:new Float32Array(16000*45),sampleRate:16000,numChannels:1})
 const clip=await importRecordingFile(file,new AbortController().signal)
 expect(clip.duration).toBe(45);expect(clip.mode).toBeNull();expect(clip.material).toBeNull()
})
it('rejects both metadata and decoded PCM exceeding 60 seconds',async()=>{
 vi.mocked(probeAudioDuration).mockResolvedValue(61)
 await expect(importRecordingFile(file,new AbortController().signal)).rejects.toThrow('60')
 expect(decodeAudioFile).not.toHaveBeenCalled()
 vi.mocked(probeAudioDuration).mockResolvedValue(60)
 vi.mocked(decodeAudioFile).mockResolvedValue({samples:new Float32Array(960001),sampleRate:16000,numChannels:1})
 await expect(importRecordingFile(file,new AbortController().signal)).rejects.toThrow('60')
})
it('probes WAV and checks actual PCM when header duration is unknown',async()=>{
 vi.mocked(isWavFile).mockReturnValue(true);vi.mocked(probeWavDuration).mockResolvedValue(null)
 vi.mocked(parseWav).mockReturnValue({samples:new Float32Array(960001),sampleRate:16000,numChannels:2} as ReturnType<typeof parseWav>)
 await expect(importRecordingFile(file,new AbortController().signal)).rejects.toThrow('60')
})
it('does not publish a decode which resolves after cancellation',async()=>{
 vi.mocked(decodeAudioFile).mockResolvedValue({samples:new Float32Array(16000),sampleRate:16000,numChannels:1})
 const abort=new AbortController();abort.abort()
 await expect(importRecordingFile(file,abort.signal)).rejects.toMatchObject({name:'AbortError'})
})

it('provides enum error reasons without parsing user-facing messages',async()=>{
 vi.mocked(probeAudioDuration).mockResolvedValue(61)
 await expect(importRecordingFile(file,new AbortController().signal)).rejects.toMatchObject({reason:'too_long'})
 vi.mocked(probeAudioDuration).mockResolvedValue(1)
 vi.mocked(decodeAudioFile).mockRejectedValue(new Error('private decoder details'))
 await expect(importRecordingFile(file,new AbortController().signal)).rejects.toMatchObject({reason:'unsupported_or_corrupt'})
})
