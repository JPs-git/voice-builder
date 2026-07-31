import { useEffect, useRef, useCallback } from 'react'
import { getAnalysisService } from '../services/AnalysisService'

export function useAnalysisService() {
  const startedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resolveRef = useRef<((buf: ArrayBuffer) => void) | null>(null)

  useEffect(() => {
    if (!startedRef.current) {
      getAnalysisService().start()
      startedRef.current = true
    }
    return () => {
      // Don't destroy on unmount — keep the service alive for the singleton
    }
  }, [])

  const importWav = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      await getAnalysisService().importWav(buf)
    } catch (err) {
      console.error('WAV import failed:', err)
    } finally {
      // Reset input so the same file can be re-imported
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [])

  return {
    importWav,
    fileInputRef,
    handleFileChange,
  }
}
