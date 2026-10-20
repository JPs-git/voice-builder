import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { inject } = vi.hoisted(() => ({ inject: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ inject }))

const websiteId = '94db1cb1-74f4-4a40-ad6c-962362670409'
const preferenceKey = 'voicebuilder-analytics-disabled'
let storageListener: (event: StorageEvent) => void
let navigationListeners: EventListenerOrEventListenerObject[] = []

function navigate(path = '/', host = 'voice.starbow.top') {
  vi.stubGlobal('location', new URL(`https://${host}${path}`))
}
function script() {
  return document.querySelector<HTMLScriptElement>('script[data-website-id]')!
}
function loadTracker() {
  const sent = vi.fn()
  window.umami = {
    track: vi.fn(input => {
      const defaults = { website: websiteId, url: location.pathname, hostname: location.hostname, language: 'zh-CN', screen: '390x844', referrer: '' }
      const payload = typeof input === 'function' ? input(defaults) : input
      const filtered = window.voiceBuilderAnalyticsBeforeSend!('event', payload)
      if (filtered) sent(filtered)
    }),
  }
  script().dispatchEvent(new Event('load'))
  return sent
}

beforeEach(() => {
  vi.resetModules()
  inject.mockReset()
  localStorage.clear()
  document.head.querySelectorAll('script').forEach(node => node.remove())
  delete window.umami
  delete window.voiceBuilderAnalyticsBeforeSend
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true')
  vi.stubEnv('VITE_VERCEL_ANALYTICS_ENABLED', 'true')
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', websiteId)
  vi.stubEnv('VITE_UMAMI_DOMAINS', 'voice.starbow.top')
  vi.stubGlobal('navigator', { doNotTrack: null })
  navigate()
  navigationListeners = []
  const original = window.addEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'storage') storageListener = listener as (event: StorageEvent) => void
    else {
      original(type, listener, options)
      if (type === 'popstate') navigationListeners.push(listener)
    }
  })
})
afterEach(() => {
  navigationListeners.forEach(listener => window.removeEventListener('popstate', listener))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('analytics initialization and privacy', () => {
  it('loads the official tracker once with privacy hooks registered first', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    analytics.initAnalytics()
    expect(document.querySelectorAll('script[data-website-id]')).toHaveLength(1)
    expect(script().src).toBe('https://cloud.umami.is/script.js')
    expect(script().dataset).toMatchObject({ websiteId, domains: 'voice.starbow.top', doNotTrack: 'true', excludeHash: 'true', beforeSend: 'voiceBuilderAnalyticsBeforeSend' })
    expect(script().dataset.autoTrack).toBeUndefined()
    expect(window.voiceBuilderAnalyticsBeforeSend).toBeTypeOf('function')
    expect(inject).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['development', 'voice.starbow.top', false, 'true'],
    ['preview', 'preview.vercel.app', true, 'false'],
    ['copied configuration', 'fork.vercel.app', true, 'true'],
    ['suffix attack', 'voice.starbow.top.example.com', true, 'true'],
    ['localhost', 'localhost', true, 'true'],
    ['loopback', '127.0.0.1', true, 'true'],
  ])('does not load either service for %s', async (_name, host, prod, enabled) => {
    navigate('/', host as string)
    vi.stubEnv('PROD', prod as boolean)
    vi.stubEnv('VITE_ANALYTICS_ENABLED', enabled as string)
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    analytics.track('record_start', { page: 'analysis' })
    expect(script()).toBeNull()
    expect(inject).not.toHaveBeenCalled()
    expect(analytics.isAnalyticsAllowed()).toBe(false)
  })

  it('supports exact comma-delimited hosts while rejecting wildcard and local entries', async () => {
    vi.stubEnv('VITE_UMAMI_DOMAINS', ' ignored.example, voice.starbow.top , *.example.com, localhost,127.0.0.1')
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    expect(script().dataset.domains).toBe('ignored.example,voice.starbow.top')
  })

  it('keeps Vercel available when the Umami ID is missing', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', '')
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    expect(script()).toBeNull()
    expect(inject).toHaveBeenCalledTimes(1)
  })

  it.each([
    'https://external.example/private/path?token=private',
    'https://voice.starbow.top/?token=private',
    'https://external.example/?private=1',
  ])('does not initialize Vercel when its unfilterable referrer would expose %s', async referrer => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue(referrer)
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    expect(inject).not.toHaveBeenCalled()
    expect(script()).not.toBeNull()
    const sent = loadTracker()
    analytics.track('record_start', { page: 'analysis' })
    expect(sent.mock.calls[0][0].referrer).toBe(referrer.startsWith(location.origin) ? '/' : 'https://external.example')
  })

  it.each(['https://external.example/', 'https://voice.starbow.top/practice'])('keeps Vercel on an already-safe source %s', async referrer => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue(referrer)
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    expect(inject).toHaveBeenCalledTimes(1)
  })

  it('resynchronizes the SDK history cache on Back before navigating to the same route again', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    analytics.initAnalytics()
    loadTracker()
    const historyState = { idx: 2, key: 'router-key', usr: { keep: true } }
    vi.spyOn(history, 'state', 'get').mockReturnValue(historyState)
    let vendorCurrentPath = '/'
    const pageviews = ['/']
    const replace = vi.spyOn(history, 'replaceState').mockImplementation((_state, _title, url) => {
      const path = new URL(String(url), location.origin).pathname
      if (path !== vendorCurrentPath) { vendorCurrentPath = path; pageviews.push(path) }
    })
    navigate('/practice')
    history.replaceState(historyState, '', location.href)
    navigate('/')
    window.dispatchEvent(new PopStateEvent('popstate', { state: historyState }))
    expect(replace).toHaveBeenLastCalledWith(historyState, '', 'https://voice.starbow.top/')
    expect(location.href).toBe('https://voice.starbow.top/')
    navigate('/practice')
    history.replaceState(historyState, '', location.href)
    expect(pageviews).toEqual(['/', '/practice', '/', '/practice'])
    expect(replace).toHaveBeenCalledTimes(3)
  })

  it('honors an existing opt-out and DNT without loading scripts', async () => {
    localStorage.setItem(preferenceKey, 'true')
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    expect(script()).toBeNull()
    analytics.setAnalyticsDisabled(false)
    expect(script()).not.toBeNull()
    navigate()
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    expect(analytics.isAnalyticsAllowed()).toBe(false)
    expect(window.voiceBuilderAnalyticsBeforeSend!('event', { url: '/' })).toBe(false)
  })

  it('never initializes either service with DNT even when opted in', async () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    analytics.setAnalyticsDisabled(false)
    expect(script()).toBeNull()
    expect(inject).not.toHaveBeenCalled()
  })

  it('filters pageview URLs, referrers, titles and unexpected fields for both services', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    const url = '/practice?token=secret&utm_source=bilibili&utm_medium=comment&utm_campaign=x&utm_content=bad%40name#private'
    const filtered = window.voiceBuilderAnalyticsBeforeSend!('event', {
      url, referrer: 'https://example.com/private?secret=abc', title: 'private title', audio: [1, 2], data: { secret: 'abc' }, id: 'person',
    })
    expect(filtered).toMatchObject({ url: '/practice?utm_source=bilibili&utm_medium=comment&utm_campaign=x', referrer: 'https://example.com', title: '在线声音训练 · 看见自己的声音' })
    expect(filtered).not.toHaveProperty('data')
    expect(filtered).not.toHaveProperty('audio')
    expect(filtered).not.toHaveProperty('id')
    const beforeSend = inject.mock.calls[0][0].beforeSend
    expect(beforeSend({ type: 'pageview', url: `https://voice.starbow.top${url}` }).url).toBe('https://voice.starbow.top/practice?utm_source=bilibili&utm_medium=comment&utm_campaign=x')
    expect(window.voiceBuilderAnalyticsBeforeSend!('event', { url: '/', referrer: 'https://voice.starbow.top/practice?token=private#secret' })).toMatchObject({ referrer: '/practice' })
    expect(window.voiceBuilderAnalyticsBeforeSend!('event', { url: '/private' })).toBe(false)
    expect(beforeSend({ type: 'pageview', url: 'https://voice.starbow.top/private' })).toBeNull()
    expect(window.voiceBuilderAnalyticsBeforeSend!('identify', { url: '/', data: { email: 'private' } })).toBe(false)
  })

  it('rebuilds business data from the event whitelist and rejects unknown events', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    const sent = loadTracker()
    analytics.track('record_error', { page: 'analysis', reason: 'permission', message: 'private', samples: [1, 2] } as never)
    expect(sent.mock.calls[0][0].data).toEqual({ page: 'analysis', reason: 'permission' })
    analytics.track('record_error', { page: 'analysis', reason: 'private-message' } as never)
    analytics.track('record_error', { page: 'analysis', reason: { toString: () => 'permission', message: 'private' } } as never)
    analytics.track('private-event' as never, { page: 'analysis' } as never)
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('cancels both channels immediately and does not replay disabled events', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    analytics.track('record_start', { page: 'analysis' })
    analytics.setAnalyticsDisabled(true)
    const sent = loadTracker()
    analytics.track('record_start', { page: 'analysis' })
    expect(sent).not.toHaveBeenCalled()
    expect(inject.mock.calls[0][0].beforeSend({ type: 'pageview', url: location.href })).toBeNull()
    analytics.setAnalyticsDisabled(false)
    analytics.track('record_start', { page: 'analysis' })
    expect(sent).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(preferenceKey)).toBe('false')
  })

  it('fails closed when reading storage fails and applies in-memory toggles if writing fails', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const analytics = await import('../analytics/analytics')
    expect(() => analytics.initAnalytics()).not.toThrow()
    expect(analytics.isAnalyticsAllowed()).toBe(false)
    expect(analytics.isAnalyticsStorageAvailable()).toBe(false)
    analytics.setAnalyticsDisabled(false)
    expect(analytics.getAnalyticsDisabled()).toBe(false)
    expect(script()).not.toBeNull()
    analytics.setAnalyticsDisabled(true)
    expect(analytics.isAnalyticsAllowed()).toBe(false)
  })

  it('synchronizes a cross-tab opt-out and unsubscribes preference observers', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    const changed = vi.fn()
    const unsubscribe = analytics.subscribeAnalyticsPreference(changed)
    storageListener(new StorageEvent('storage', { key: preferenceKey, newValue: 'true', storageArea: localStorage }))
    expect(analytics.getAnalyticsDisabled()).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)
    unsubscribe()
    storageListener(new StorageEvent('storage', { key: preferenceKey, newValue: 'false', storageArea: localStorage }))
    expect(changed).toHaveBeenCalledTimes(1)
    expect(analytics.getAnalyticsDisabled()).toBe(false)
  })

  it('captures the original safe route and timestamp while the script is loading', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    navigate('/?utm_source=bilibili&token=secret')
    analytics.track('record_start', { page: 'analysis' })
    navigate('/practice')
    vi.advanceTimersByTime(5000)
    const sent = loadTracker()
    script().dispatchEvent(new Event('load'))
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent.mock.calls[0][0]).toMatchObject({ url: '/?utm_source=bilibili', timestamp: 1792296000, data: { page: 'analysis' } })
  })

  it('bounds the pending queue at twenty and expires entries after thirty seconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    for (let i = 0; i < 21; i++) {
      navigate(`/?utm_content=entry${i}`)
      analytics.track('record_start', { page: 'analysis' })
    }
    const sent = loadTracker()
    expect(sent).toHaveBeenCalledTimes(20)
    expect(sent.mock.calls[0][0].url).toBe('/?utm_content=entry1')
  })

  it('discards expired or failed pending events and never automatically retries a failed script', async () => {
    vi.useFakeTimers()
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    analytics.track('record_start', { page: 'analysis' })
    vi.advanceTimersByTime(30001)
    expect(loadTracker()).not.toHaveBeenCalled()
    script().dispatchEvent(new Event('error'))
    analytics.setAnalyticsDisabled(true)
    analytics.setAnalyticsDisabled(false)
    const sent = vi.fn()
    window.umami = { track: sent }
    analytics.track('record_start', { page: 'analysis' })
    expect(sent).not.toHaveBeenCalled()
    expect(document.querySelectorAll('script[data-website-id]')).toHaveLength(1)
  })

  it('contains synchronous tracker errors and promise rejections', async () => {
    const analytics = await import('../analytics/analytics')
    analytics.initAnalytics()
    loadTracker()
    window.umami!.track = () => { throw new Error('blocked') }
    expect(() => analytics.track('record_start', { page: 'analysis' })).not.toThrow()
    window.umami!.track = () => Promise.reject(new Error('offline'))
    analytics.track('record_start', { page: 'analysis' })
    await Promise.resolve()
  })
})


describe('statistics analytics contracts', () => {
  it('normalizes report URLs in pageviews, referrers and Vercel without exposing IDs', async () => {
    navigate('/reports/private-id?secret=audio#name')
    const a = await import('../analytics/analytics'); a.initAnalytics()
    const filter = window.voiceBuilderAnalyticsBeforeSend!
    expect(a.getAnalyticsPage()).toBe('report')
    expect(filter('event', {url:location.href, referrer:'https://voice.starbow.top/reports/another-secret'})).toMatchObject({url:'/reports/detail', referrer:'/reports/detail'})
    expect(inject.mock.calls[0][0].beforeSend({type:'pageview',url:location.href})).toMatchObject({url:'https://voice.starbow.top/reports/detail'})
    expect(filter('event', {url:'/reports/id/extra'})).toBe(false)
  })
  it('keeps delayed task completion attributed to recording and strips unapproved fields', async () => {
    navigate('/recording'); const a = await import('../analytics/analytics'); a.initAnalytics()
    a.trackRecordingTask('recording_analysis', {stage:'start',source:'mic',attempt:'initial',duration_bucket:'under_10s'})
    navigate('/practice')
    a.trackRecordingTask('recording_analysis', {stage:'success',source:'mic',attempt:'initial',fileName:'private',median:211} as any)
    const sent=loadTracker()
    expect(sent.mock.calls.map(([p])=>[p.url,p.data])).toEqual([
      ['/recording',{page:'recording',stage:'start',source:'mic',attempt:'initial',duration_bucket:'under_10s'}],
      ['/recording',{page:'recording',stage:'success',source:'mic',attempt:'initial'}],
    ])
    a.trackRecordingTask('help_open' as any,{topic:'charts'} as any)
    a.trackRecordingTask('recording_analysis',{stage:'failure',source:'mic',attempt:'initial',reason:'raw error'} as any)
    expect(sent).toHaveBeenCalledTimes(2)
    a.setAnalyticsDisabled(true)
    a.trackRecordingTask('recording_analysis',{stage:'success',source:'mic',attempt:'initial'})
    expect(sent).toHaveBeenCalledTimes(2)
  })
  it('accepts report/help entries and requires recording-specific action and enums',async()=>{
    const a=await import('../analytics/analytics');a.initAnalytics();const sent=loadTracker()
    navigate('/recording')
    a.track('record_start',{page:'recording',action:'new'})
    a.track('record_start',{page:'recording'} as any)
    a.track('help_open',{page:'recording',topic:'recording-statistics'})
    navigate('/reports/private')
    a.track('report_open',{page:'report',entry:'auto',availability:'available'})
    a.track('report_open',{page:'report',entry:'list',availability:'available'} as any)
    expect(sent.mock.calls.map(([p])=>p.name)).toEqual(['record_start','help_open','report_open'])
    expect(JSON.stringify(sent.mock.calls)).not.toContain('private')
  })
})

it('filters every recording event variant and never sends extra payload properties',async()=>{
 navigate('/recording');const a=await import('../analytics/analytics');a.initAnalytics();const sent=loadTracker()
 const valid=[
  ['recording_pause',{reason:'limit'}],
  ['recording_complete',{duration_bucket:'at_limit',at_limit:'yes'}],
  ['recording_cancel',{target:'analysis',phase:'analyzing'}],
  ['recording_analysis',{stage:'failure',source:'import',attempt:'retry',reason:'processing'}],
  ['recording_analysis',{stage:'cancel',source:'mic',attempt:'initial'}],
  ['audio_import',{result:'failure',reason:'too_long'}],
 ] as const
 for(const [name,data] of valid)a.trackRecordingTask(name,{...data,reportId:'private-id',pcm:[1],duration:60} as any)
 expect(sent).toHaveBeenCalledTimes(valid.length)
 expect(JSON.stringify(sent.mock.calls)).not.toMatch(/private-id|pcm|duration":/)
 const invalid=[
  ['recording_pause',{reason:'shutdown'}],['recording_complete',{duration_bucket:'60',at_limit:'yes'}],
  ['recording_cancel',{target:'file',phase:'prepared'}],['audio_import',{result:'failure',reason:'message'}],
 ] as const
 for(const [name,data] of invalid)a.trackRecordingTask(name,data as any)
 expect(sent).toHaveBeenCalledTimes(valid.length)
})
it('drops pending task events on opt-out or expiry, preserving the original trigger time',async()=>{
 vi.useFakeTimers();navigate('/recording');const a=await import('../analytics/analytics');a.initAnalytics()
 a.trackRecordingTask('recording_pause',{reason:'user'})
 await vi.advanceTimersByTimeAsync(30001)
 const sent=loadTracker();expect(sent).not.toHaveBeenCalled()
 a.setAnalyticsDisabled(true);a.trackRecordingTask('recording_pause',{reason:'user'})
 a.setAnalyticsDisabled(false);expect(sent).not.toHaveBeenCalled()
})
