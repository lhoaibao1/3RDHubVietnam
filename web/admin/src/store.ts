import { defineStore } from 'pinia'
import { api, ApiError, setUnauthorizedHandler } from './api'
import type { Content } from '@/lib/content'
import { TABS, type Bootstrap, type Defaults, type TabKey } from './types'

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o))

export function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const useAdmin = defineStore('admin', {
  state: () => ({
    ready: false,
    loggedIn: false,
    loginError: '',
    tab: 'dash' as TabKey,
    content: null as Content | null,
    saved: '' as string,
    defaults: null as Defaults | null,
    leadCounts: {} as Record<string, number>,
    updated: 0,
    saving: false,
    toast: null as { msg: string; bad: boolean } | null,
  }),
  getters: {
    dirty(s): boolean { return !!s.content && JSON.stringify(s.content) !== s.saved },
    newLeads(s): number { return s.leadCounts.new || 0 },
    totalLeads(s): number { return Object.values(s.leadCounts).reduce((a, b) => a + b, 0) },
  },
  actions: {
    say(msg: string, bad = false) {
      this.toast = { msg, bad }
      const t = this.toast
      setTimeout(() => { if (this.toast === t) this.toast = null }, bad ? 6000 : 3200)
    },
    adopt(c: Content) {
      c.ov = c.ov || {}
      c.faq = c.faq || []
      c.partners = c.partners || []
      c.settings = c.settings || {}
      c.legal = c.legal || {}
      c.quote = c.quote || { plans: [] }
      c.clients = c.clients || []
      c.quote.plans = c.quote.plans || []
      this.content = c
      this.saved = JSON.stringify(c)
    },
    async boot() {
      setUnauthorizedHandler(() => { this.loggedIn = false; this.content = null })
      try {
        const b = await api<Bootstrap>('GET', 'bootstrap')
        this.defaults = b.defaults
        this.leadCounts = b.leads
        this.updated = b.updated
        this.adopt(b.content)
        const t = location.hash.replace('#', '') as TabKey
        if (TABS.some((x) => x[0] === t)) this.tab = t
        this.loggedIn = true
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) this.loginError = (e as Error).message
      }
      this.ready = true
    },
    async login(password: string) {
      this.loginError = ''
      try {
        await api('POST', 'login', { password })
        await this.boot()
      } catch (e) {
        this.loginError = (e as Error).message
        throw e
      }
    },
    async logout() {
      await api('POST', 'logout').catch(() => {})
      this.loggedIn = false
      this.content = null
    },
    go(tab: TabKey) {
      this.tab = tab
      history.replaceState(null, '', '#' + tab)
      window.scrollTo(0, 0)
    },
    async save() {
      if (!this.content) return
      this.saving = true
      try {
        const r = await api<{ content: Content; updated: number; translated?: number; translate_failed?: number }>('PUT', 'content', { content: this.content, note: 'Cập nhật nội dung' })
        this.adopt(r.content)
        this.updated = r.updated
        const tr = r.translated ? ` Đã tự dịch ${r.translated} đoạn sang tiếng Anh.` : ''
        const bad = r.translate_failed ? ` ${r.translate_failed} đoạn chưa dịch được, sẽ dịch lại ở lần lưu sau.` : ''
        this.say('Đã lưu. Website cập nhật ngay.' + tr + bad, !!r.translate_failed)
      } catch (e) {
        this.say((e as Error).message, true)
      } finally {
        this.saving = false
      }
    },
    discard() {
      if (!confirm('Bỏ toàn bộ thay đổi chưa lưu?')) return
      this.content = JSON.parse(this.saved)
    },
    async refreshCounts() {
      const b = await api<Bootstrap>('GET', 'bootstrap')
      this.leadCounts = b.leads
    },
    cloneOf: clone,
  },
})
