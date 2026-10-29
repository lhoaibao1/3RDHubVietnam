import { defineStore } from 'pinia'
import en from '../lib/en.json'
import { DEFAULTS, DEF_SETTINGS, type Content, type Faq, type Lang, type LegalDoc, type OvItem, type Pair, type Partner } from '../lib/content'

const EN = en as Record<string, string>
const CACHE_KEY = '3rd-cms-v1'
const LANG_KEY = '3rd-lang'

function readLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'vi' } catch { return 'vi' }
}
function readCache(): Content | null {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && typeof c === 'object' ? c : null } catch { return null }
}

export const useSite = defineStore('site', {
  state: () => ({ lang: readLang() as Lang, cms: readCache() as Content | null }),
  getters: {
    faqItems(s): Faq[] { return s.cms?.faq ?? DEFAULTS.faq },
    partners(s): Partner[] { return s.cms?.partners?.length ? s.cms.partners : DEFAULTS.partners },
  },
  actions: {
    setLang(l: Lang) {
      this.lang = l
      try { localStorage.setItem(LANG_KEY, l) } catch { /* bỏ qua */ }
      document.documentElement.lang = l
    },
    /** Lấy nội dung mới nhất từ CMS và lưu đệm để lần sau hiện ngay. */
    async load() {
      if (!window.fetch) return
      try {
        const r = await fetch('/api/content', { cache: 'no-store' })
        if (!r.ok) return
        const c = (await r.json()) as Content
        if (!c || (!c.ov && !c.faq && !c.partners && !c.settings)) return
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* bỏ qua */ }
        this.cms = c
      } catch { /* không có CMS: dùng nội dung mặc định */ }
    },
    S(k: string): string { return this.cms?.settings?.[k] || DEF_SETTINGS[k] || '' },
    /** Bản tuỳ chỉnh từ CMS cho một chuỗi gốc tiếng Việt (nếu có). */
    ov(k: string): OvItem | null {
      const o = this.cms?.ov?.[k]
      if (o) return o
      const s = this.cms?.settings || {}
      if (k === DEF_SETTINGS.email && s.email) return { vi: s.email, en: s.email }
      if (k === DEF_SETTINGS.hotline && s.hotline) return { vi: s.hotline, en: s.hotline }
      return null
    },
    /** Dịch một chuỗi gốc tiếng Việt: CMS > từ điển tiếng Anh > chính nó. */
    t(key: string): string {
      const k = key.trim()
      const o = this.ov(k)
      if (this.lang === 'en') {
        if (o?.en) return o.en
        const v = EN[k] ?? EN[k.replace(/\s+/g, ' ')]
        if (v != null) return v
        return o?.vi || key
      }
      return o?.vi || key
    },
    /** Chọn ngôn ngữ cho một cặp {vi,en} lấy từ CMS (FAQ, đối tác, pháp lý). */
    pick(p?: Pair): string {
      if (!p) return ''
      if (this.lang === 'en') return p.en || EN[p.vi] || p.vi || ''
      return p.vi || ''
    },
    legal(key: 'terms' | 'privacy'): { title: string; updated: string; body: string } {
      const d: LegalDoc | undefined = this.cms?.legal?.[key]
      const def = DEFAULTS.legal?.[key]
      const f = (name: 'title' | 'updated' | 'body') => {
        const lg = this.lang
        return (d?.[name]?.[lg] || def?.[name]?.[lg] || (lg === 'en' ? d?.[name]?.vi || def?.[name]?.vi : '') || '') as string
      }
      return { title: f('title'), updated: f('updated'), body: f('body') }
    },
  },
})
