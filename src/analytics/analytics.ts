import type { HelpTopic } from '../content/helpContent'
import { HELP_TOPIC_ORDER } from '../content/helpContent'
import { inject } from '@vercel/analytics'

export type AnalyticsPage = 'analysis' | 'practice'
export interface AnalyticsEventMap {
  record_start: { page: AnalyticsPage }
  record_error: { page: AnalyticsPage; reason: 'permission' | 'device' | 'unsupported' | 'unknown' }
  practice_engaged: { page: AnalyticsPage }
  playback_start: { page: AnalyticsPage }
  audio_import: { page: AnalyticsPage } & ({ result: 'success' } | { result: 'failure'; reason: 'too_long' | 'unsupported_or_corrupt' | 'unknown' })
  help_open: { page: AnalyticsPage; topic: HelpTopic }
}

const PREFERENCE_KEY = 'voicebuilder-analytics-disabled'
const TITLE = '在线声音训练 · 看见自己的声音'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
const listeners = new Set<() => void>()
let preferenceInitialized = false
let disabled = false
let storageAvailable = true
let vercelInitialized = false
let trackerState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'
type PendingEvent = { payload: UmamiPayload; queuedAt: number }
let pending: PendingEvent[] = []

function initializePreference() {
  if (preferenceInitialized) return
  preferenceInitialized = true
  try {
    disabled = localStorage.getItem(PREFERENCE_KEY) === 'true'
  } catch {
    disabled = true
    storageAvailable = false
  }
  window.addEventListener('storage', event => {
    if (event.key !== PREFERENCE_KEY && event.key !== null) return
    try {
      if (event.storageArea && event.storageArea !== localStorage) return
    } catch { return }
    disabled = event.key === null ? false : event.newValue === 'true'
    preferenceChanged()
  })
}

function preferenceChanged() {
  if (disabled) pending = []
  else initAnalytics()
  listeners.forEach(listener => listener())
}

export function getAnalyticsDisabled(): boolean {
  initializePreference()
  return disabled
}

export function isAnalyticsStorageAvailable(): boolean {
  initializePreference()
  return storageAvailable
}

export function setAnalyticsDisabled(value: boolean): void {
  initializePreference()
  disabled = value
  try {
    localStorage.setItem(PREFERENCE_KEY, String(value))
    storageAvailable = true
  } catch { storageAvailable = false }
  preferenceChanged()
}

export function subscribeAnalyticsPreference(listener: () => void): () => void {
  initializePreference()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function allowedDomains(): string[] {
  return (import.meta.env.VITE_UMAMI_DOMAINS ?? '').split(',').map(host => host.trim().toLowerCase())
    .filter(host => /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(host)
      && host !== 'localhost' && !host.endsWith('.localhost') && !host.startsWith('127.'))
}

export function isAnalyticsAllowed(): boolean {
  return import.meta.env.PROD && import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
    && location.protocol === 'https:' && allowedDomains().includes(location.hostname)
    && !getAnalyticsDisabled() && navigator.doNotTrack !== '1'
}

function pageForPath(pathname: string): AnalyticsPage | null {
  return pathname === '/' ? 'analysis' : pathname === '/practice' ? 'practice' : null
}

export function getAnalyticsPage(): AnalyticsPage | null {
  return pageForPath(location.pathname)
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value, location.origin)
    if (url.origin !== location.origin || !pageForPath(url.pathname)) return null
    const params = new URLSearchParams()
    for (const key of UTM_KEYS) {
      const value = url.searchParams.get(key)
      if (value && /^[a-z0-9_-]{1,64}$/i.test(value)) params.set(key, value)
    }
    const search = params.toString()
    return url.pathname + (search ? `?${search}` : '')
  } catch { return null }
}

function cleanReferrer(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value, location.origin)
    if (!['https:', 'http:'].includes(url.protocol)) return ''
    return url.origin === location.origin ? cleanUrl(value) ?? '' : url.origin
  } catch { return '' }
}

function isVercelReferrerSafe(): boolean {
  if (!document.referrer) return true
  const safe = cleanReferrer(document.referrer)
  if (!safe) return false
  try {
    // Vercel reads document.referrer separately; its beforeSend cannot replace that field.
    return new URL(document.referrer, location.origin).href === new URL(safe, location.origin).href
  } catch { return false }
}

function eventData(name: string, value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (data.page !== 'analysis' && data.page !== 'practice') return null
  const result: Record<string, string> = { page: data.page }
  switch (name) {
    case 'record_start': case 'practice_engaged': case 'playback_start': return result
    case 'record_error':
      if (typeof data.reason !== 'string' || !['permission', 'device', 'unsupported', 'unknown'].includes(data.reason)) return null
      return { ...result, reason: data.reason }
    case 'audio_import':
      if (data.result === 'success') return { ...result, result: 'success' }
      if (data.result !== 'failure' || typeof data.reason !== 'string' || !['too_long', 'unsupported_or_corrupt', 'unknown'].includes(data.reason)) return null
      return { ...result, result: 'failure', reason: data.reason }
    case 'help_open':
      if (!HELP_TOPIC_ORDER.includes(data.topic as HelpTopic)) return null
      return { ...result, topic: data.topic as string }
    default: return null
  }
}

function filterUmamiPayload(type: string, payload: UmamiPayload): UmamiPayload | false {
  if (type !== 'event' || !isAnalyticsAllowed()) return false
  const url = cleanUrl(payload.url)
  if (!url) return false
  // Rebuild rather than spreading SDK payloads: identity and unexpected fields never pass through.
  const safe: UmamiPayload = {
    website: import.meta.env.VITE_UMAMI_WEBSITE_ID,
    hostname: location.hostname, url, title: TITLE, referrer: cleanReferrer(payload.referrer),
  }
  for (const key of ['language', 'screen']) {
    if (typeof payload[key] === 'string') safe[key] = payload[key]
  }
  if (typeof payload.timestamp === 'number' && Number.isFinite(payload.timestamp)) safe.timestamp = payload.timestamp
  if (payload.name) {
    if (typeof payload.name !== 'string') return false
    const data = eventData(payload.name, payload.data)
    if (!data || data.page !== pageForPath(new URL(url, location.origin).pathname)) return false
    safe.name = payload.name
    safe.data = data
  }
  return safe
}

function send(entry: PendingEvent) {
  if (!isAnalyticsAllowed() || trackerState !== 'ready' || !window.umami || Date.now() - entry.queuedAt > 30_000) return
  try {
    const result = window.umami.track(defaults => ({ ...defaults, ...entry.payload }))
    void Promise.resolve(result).catch(() => {})
  } catch { /* Statistics must never change the result of an audio operation. */ }
}

export function track<K extends keyof AnalyticsEventMap>(name: K, data: AnalyticsEventMap[K]): void {
  try {
    if (!isAnalyticsAllowed() || trackerState === 'idle' || trackerState === 'failed') return
    const safeData = eventData(name, data)
    const url = cleanUrl(location.href)
    if (!safeData || !url || safeData.page !== getAnalyticsPage()) return
    const entry = {
      payload: { name, data: safeData, url, referrer: cleanReferrer(document.referrer), timestamp: Math.floor(Date.now() / 1000) },
      queuedAt: Date.now(),
    }
    if (trackerState === 'ready') send(entry)
    else {
      pending.push(entry)
      if (pending.length > 20) pending.shift()
    }
  } catch { /* Ignore malformed input and unavailable browser facilities. */ }
}

export function initAnalytics(): void {
  initializePreference()
  window.voiceBuilderAnalyticsBeforeSend = filterUmamiPayload
  if (!isAnalyticsAllowed()) return
  if (!vercelInitialized && import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED === 'true' && isVercelReferrerSafe()) {
    vercelInitialized = true
    try {
      inject({ beforeSend: event => {
        if (!isAnalyticsAllowed() || event.type !== 'pageview' || !isVercelReferrerSafe()) return null
        const url = cleanUrl(event.url)
        return url ? { ...event, url: location.origin + url } : null
      } })
    } catch { /* An unavailable statistics service must not block React mounting. */ }
  }
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID ?? ''
  if (trackerState !== 'idle' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(websiteId)) return
  trackerState = 'loading'
  window.addEventListener('popstate', () => {
    if (trackerState !== 'ready' || !window.umami) return
    try {
      // Cloud's tracker observes replaceState but currently misses popstate. Resync its
      // URL cache without adding an entry or changing React Router's existing state.
      history.replaceState(history.state, '', location.href)
    } catch { /* Browser history restrictions must not interrupt navigation. */ }
  })
  const script = document.createElement('script')
  script.src = 'https://cloud.umami.is/script.js'
  script.defer = true
  Object.assign(script.dataset, {
    websiteId, domains: allowedDomains().join(','), beforeSend: 'voiceBuilderAnalyticsBeforeSend',
    doNotTrack: 'true', excludeHash: 'true',
  })
  script.onload = () => {
    if (trackerState !== 'loading') return
    trackerState = window.umami ? 'ready' : 'failed'
    const batch = pending
    pending = []
    batch.forEach(send)
  }
  script.onerror = () => { trackerState = 'failed'; pending = [] }
  try { document.head.appendChild(script) }
  catch { trackerState = 'failed'; pending = [] }
}
