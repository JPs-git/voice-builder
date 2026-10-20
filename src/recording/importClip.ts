import {probeAudioDuration,probeWavDuration,decodeAudioFile} from '../audio/audioDecoder'
import {isWavFile,parseWav} from '../dsp/wav-parser'
import {useToastStore} from '../store/toastStore'
import {MAX_RECORDING_SECONDS} from './constants'
import type {AudioClip} from './types'
const check=(signal:AbortSignal)=>{if(signal.aborted)throw new DOMException('已取消','AbortError')}
const checkDuration=(duration:number)=>{
 if(!Number.isFinite(duration)||duration<=0)throw new Error('无法读取有效音频，请检查文件。')
 if(duration>MAX_RECORDING_SECONDS)throw new Error('音频不能超过 60 秒，请裁剪后重试。')
}
export async function importRecordingFile(file:File,signal:AbortSignal):Promise<AudioClip> {
 check(signal)
 if(!file.size)throw new Error('文件为空，请选择有效音频。')
 const head=await file.slice(0,12).arrayBuffer();check(signal)
 const wav=isWavFile(head)
 const duration=wav?await probeWavDuration(file):await probeAudioDuration(file);check(signal)
 if(duration!=null)checkDuration(duration)
 const buffer=await file.arrayBuffer();check(signal)
 const decoded=wav?parseWav(buffer):await decodeAudioFile(buffer);check(signal)
 const actual=decoded.samples.length/decoded.sampleRate
 checkDuration(actual)
 if(decoded.numChannels>1)useToastStore.getState().showToast('info','该音频为多声道，仅使用第 0 声道进行分析')
 return {samples:decoded.samples.slice(),sampleRate:decoded.sampleRate,duration:actual,
  source:'file',name:file.name,mode:null,material:null,prompt:null}
}
