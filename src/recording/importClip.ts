import {RecordingImportError} from './errors'
import {probeAudioDuration,probeWavDuration,decodeAudioFile} from '../audio/audioDecoder'
import {isWavFile,parseWav} from '../dsp/wav-parser'
import {useToastStore} from '../store/toastStore'
import {MAX_RECORDING_SECONDS} from './constants'
import type {AudioClip} from './types'
const check=(signal:AbortSignal)=>{if(signal.aborted)throw new DOMException('已取消','AbortError')}
const checkDuration=(duration:number)=>{
 if(!Number.isFinite(duration)||duration<=0)throw new RecordingImportError('无法读取有效音频，请检查文件。','unsupported_or_corrupt')
 if(duration>MAX_RECORDING_SECONDS)throw new RecordingImportError('音频不能超过 60 秒，请裁剪后重试。','too_long')
}
export async function importRecordingFile(file:File,signal:AbortSignal):Promise<AudioClip> {
 check(signal)
 if(!file.size)throw new RecordingImportError('文件为空，请选择有效音频。','unsupported_or_corrupt')
 const head=await file.slice(0,12).arrayBuffer();check(signal)
 const wav=isWavFile(head)
 const duration=await decodeStep(()=>wav?probeWavDuration(file):probeAudioDuration(file));check(signal)
 if(duration!=null)checkDuration(duration)
 const buffer=await file.arrayBuffer();check(signal)
 const decoded=await decodeStep(()=>wav?parseWav(buffer):decodeAudioFile(buffer));check(signal)
 const actual=decoded.samples.length/decoded.sampleRate
 checkDuration(actual)
 if(decoded.numChannels>1)useToastStore.getState().showToast('info','该音频为多声道，仅使用第 0 声道进行分析')
 return {samples:decoded.samples.slice(),sampleRate:decoded.sampleRate,duration:actual,
  source:'file',name:file.name,mode:null,material:null,prompt:null}
}

async function decodeStep<T>(action:()=>T|Promise<T>):Promise<T>{
 try{return await action()}catch(error){
  if(error instanceof DOMException&&error.name==='AbortError')throw error
  throw new RecordingImportError(error instanceof Error?error.message:'导入失败，请检查文件格式。','unsupported_or_corrupt')
 }
}
