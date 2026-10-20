import {READING_MATERIALS,type ReadingMaterial} from './materials'

interface RecordingReference {
 id:string
 label:string
 kind:'none'|'material'|'prompt'
 material:ReadingMaterial|null
 prompt:string|null
}
export const REFERENCE_OPTIONS:RecordingReference[]=[
 ...READING_MATERIALS.map(material=>({id:material.id,label:material.title,kind:'material' as const,material,prompt:null})),
]
export function getRecordingReference(id:string):RecordingReference {
 return REFERENCE_OPTIONS.find(reference=>reference.id===id)??REFERENCE_OPTIONS[0]
}
