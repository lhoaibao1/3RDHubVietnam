import { reactive } from 'vue'

const KEY = '3rd-consent'
export interface Saved { analytics: boolean; at: number }

function read(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && typeof v.analytics === 'boolean') return v
  } catch { /* bỏ qua */ }
  return null
}

/** Lựa chọn cookie của khách. `saved` null nghĩa là chưa trả lời, banner sẽ hiện. */
export const consent = reactive({ saved: read() as Saved | null, open: false, detail: false })
consent.open = consent.saved === null

function dropGaCookies() {
  const host = location.hostname.split('.')
  const domains = ['', location.hostname, host.length > 2 ? '.' + host.slice(-2).join('.') : '.' + location.hostname]
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (/^(_ga|_gid|_gat)/.test(name)) for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (d ? `; domain=${d}` : '')
  }
}

export function saveConsent(analytics: boolean) {
  consent.saved = { analytics, at: Date.now() }
  try { localStorage.setItem(KEY, JSON.stringify(consent.saved)) } catch { /* bỏ qua */ }
  if (!analytics) {
    const w = window as any
    for (const k of Object.keys(w)) if (k.startsWith('ga-disable-')) w[k] = true
    dropGaCookies()
  }
  consent.open = false; consent.detail = false
}
export const openConsent = () => { consent.open = true; consent.detail = true }
