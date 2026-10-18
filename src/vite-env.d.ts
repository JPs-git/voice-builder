/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANALYTICS_ENABLED?: string
  readonly VITE_VERCEL_ANALYTICS_ENABLED?: string
  readonly VITE_UMAMI_WEBSITE_ID?: string
  readonly VITE_UMAMI_DOMAINS?: string
}

type UmamiPayload = Record<string, unknown>
interface Window {
  umami?: {
    track: (input: UmamiPayload | ((defaults: UmamiPayload) => UmamiPayload)) => void | Promise<unknown>
  }
  voiceBuilderAnalyticsBeforeSend?: (type: string, payload: UmamiPayload) => UmamiPayload | false
}
