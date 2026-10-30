import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useSite } from '@/stores/site'
import { LEGAL_SLUGS, NAV } from '@/lib/content'
import { consent } from '@/composables/useConsent'

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
    const slug = String(route.params.slug || route.path.replace(/^\//, ''))
    let page = ''
    const legal = LEGAL_SLUGS[slug]
    if (slug === 'baogia') page = site.t('Báo giá')
    else if (slug === 'chinh-sach') page = site.t('Chính sách và điều khoản')
    else if (legal) page = site.legal(legal).title
    else {
      const n = NAV.find((x) => x[0] === slug)
      if (n) page = site.t(n[1])
    }
    document.title = page ? `${page} · ${base}` : base
    const d = site.S('meta_description')
    if (d) {
      setMeta('meta[name=description]', d)
      setMeta('meta[property="og:description"]', d)
    }
    const t = site.S('site_title')
    if (t) setMeta('meta[property="og:title"]', t)
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
