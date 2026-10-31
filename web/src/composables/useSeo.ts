import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useSite } from '@/stores/site'
import { LEGAL_SLUGS, NAV } from '@/lib/content'
import { consent } from '@/composables/useConsent'
import seo from '../../scripts/seo.json'

const PAGES = seo.pages as Record<string, { title: string; desc: string; title_en: string; desc_en: string }>

const GA_RE = /^[A-Za-z]{1,3}-[A-Za-z0-9-]{4,20}$/
let gaOn = false

function setMeta(sel: string, value: string) {
  const m = document.querySelector(sel)
  if (m) m.setAttribute('content', value)
}

/** Tiêu đề tab, mô tả, og:* theo cài đặt CMS và trang đang mở; nạp Google Analytics nếu có mã. */
export function useSeo() {
  const site = useSite()
  const route = useRoute()
  watchEffect(() => {
    const base = site.S('site_title') || '3RDHub Vietnam'
    const slug = String(route.params.slug || route.path.replace(/^\/(vi|en)(?=\/|$)/, '').replace(/^\//, ''))
    let page = ''
    const legal = LEGAL_SLUGS[slug]
    if (slug === 'baogia') page = site.t('Báo giá')
    else if (slug === 'chinh-sach') page = site.t('Chính sách và điều khoản')
    else if (legal) page = site.legal(legal).title
    else {
      const n = NAV.find((x) => x[0] === slug)
      if (n) page = site.t(n[1])
    }
    // tiếng Việt: tiêu đề/mô tả riêng từng trang (sửa trong CMS, tab SEO; mặc định theo scripts/seo.json, giống bản dựng sẵn)
    const key = slug || 'home'
    const def = PAGES[slug] || PAGES['']
    const known = slug in PAGES
    const vi = site.lang === 'vi'
    const homeTitle = key === 'home' ? site.cms?.settings?.site_title || '' : ''
    // tiêu đề/mô tả riêng theo ngôn ngữ (CMS, tab SEO); chưa sửa thì dùng mặc định của ngôn ngữ đó
    const title = !known
      ? page ? `${page} · ${base}` : base
      : vi ? site.S('seot_' + key) || homeTitle || def.title : site.S('seot_en_' + key) || def.title_en
    const desc = (vi
      ? site.S('seod_' + key) || (key === 'home' ? site.S('meta_description') : '') || def.desc
      : site.S('seod_en_' + key) || def.desc_en || def.desc).replace(/\s+/g, ' ').trim()
    document.title = title
    setMeta('meta[name=description]', desc)
    setMeta('meta[property="og:description"]', desc)
    setMeta('meta[property="og:title"]', title)
    // địa chỉ chuẩn và các bản ngôn ngữ (Google đọc được vì chạy JavaScript)
    const rest = slug ? '/' + slug : ''
    const origin = location.origin
    const link = (sel: string, rel: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLLinkElement>(sel)
      if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el) }
      for (const k in attrs) el.setAttribute(k, attrs[k])
    }
    link('link[rel=canonical]', 'canonical', { href: `${origin}/${site.lang}${rest}` })
    link('link[rel=alternate][hreflang=vi]', 'alternate', { hreflang: 'vi', href: `${origin}/vi${rest}` })
    link('link[rel=alternate][hreflang=en]', 'alternate', { hreflang: 'en', href: `${origin}/en${rest}` })
    link('link[rel=alternate][hreflang=x-default]', 'alternate', { hreflang: 'x-default', href: `${origin}/vi${rest}` })
    setMeta('meta[property="og:url"]', `${origin}/${site.lang}${rest}`)
    setMeta('meta[property="og:locale"]', site.lang === 'en' ? 'en_US' : 'vi_VN')
    const ga = site.S('analytics_id')
    // Google Analytics chỉ nạp khi khách đã đồng ý cookie phân tích
    if (ga && !gaOn && GA_RE.test(ga) && consent.saved?.analytics) {
      gaOn = true
      const sc = document.createElement('script')
      sc.async = true
      sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga)
      document.head.appendChild(sc)
      const w = window as any
      w.dataLayer = w.dataLayer || []
      w.gtag = function () { w.dataLayer.push(arguments) }
      w.gtag('js', new Date())
      w.gtag('config', ga)
    }
  })
}
