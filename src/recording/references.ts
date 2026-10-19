import {READING_MATERIALS,SPEAKING_PROMPTS,type ReadingMaterial} from './materials'

interface RecordingReference {
 id:string
 label:string
 kind:'none'|'material'|'prompt'
 material:ReadingMaterial|null
 prompt:string|null
}
export const REFERENCE_OPTIONS:RecordingReference[]=[
 {id:'none',label:'无参考内容',kind:'none',material:null,prompt:null},
 ...READING_MATERIALS.map(material=>({id:material.id,label:material.title,kind:'material' as const,material,prompt:null})),
 ...SPEAKING_PROMPTS.map((prompt,index)=>({id:`prompt:${index}`,label:prompt,kind:'prompt' as const,material:null,prompt})),
]
export function getRecordingReference(id:string):RecordingReference {
 return REFERENCE_OPTIONS.find(reference=>reference.id===id)??REFERENCE_OPTIONS[0]
}
