// Chế độ "sửa trực tiếp trên trang": website mở trong khung của CMS (cms.<tên miền>) với ?edit=1.
// Rê chuột thấy khung quanh đoạn chữ sửa được; bấm vào thì báo cho CMS mã đoạn chữ đó; CMS gửi lại chữ mới để xem ngay.
// Chỉ nhận tin nhắn từ đúng trang quản trị của chính tên miền này.
import type { Router } from 'vue-router'
import EN from './en.json'
import type { OvItem } from './content'

interface SiteLike { lang: string; cms: { ov: Record<string, OvItem> } | null }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

export function editRequested(): boolean {
  return new URLSearchParams(location.search).has('edit') && window.parent !== window
}

export function initEditMode(site: SiteLike, router: Router) {
  const cmsOrigin = location.protocol + '//cms.' + location.host
  const post = (m: object) => window.parent.postMessage(m, cmsOrigin)
  site.lang = 'vi'
  document.documentElement.classList.add('cms-edit')

  /* bảng tra: chữ đang hiện → mã đoạn chữ */
  function lookup(text: string): string | null {
    const t = norm(text)
    if (!t) return null
    const ov = site.cms?.ov || {}
    for (const [k, o] of Object.entries(ov)) if (o.vi && norm(o.vi) === t) return k
    if (t in EN) return t
    for (const k of Object.keys(EN)) if (norm(k) === t && !ov[k]?.vi) return k
    return null
  }
  function keyOf(el: Element | null): { key: string; el: Element } | null {
    for (let n = 0; el && n < 4; n++, el = el.parentElement) {
      if ((el as HTMLElement).closest('.gl-labels,canvas')) return null
      const k = lookup((el as HTMLElement).innerText || el.textContent || '')
      if (k) return { key: k, el }
      for (const c of Array.from(el.childNodes)) if (c.nodeType === 3) { const k2 = lookup(c.textContent || ''); if (k2) return { key: k2, el } }
    }
    return null
  }

  const st = document.createElement('style')
  st.textContent = `.cms-edit .cbar{display:none!important}.cms-edit [data-cms-hover]{outline:2px dashed #FF6A2B!important;outline-offset:3px;cursor:pointer!important;border-radius:6px}
.cms-edit [data-cms-on]{outline:3px solid #FF6A2B!important;outline-offset:3px;border-radius:6px;background:rgba(255,106,43,.08)!important}
.cms-edit [data-cms]:hover{box-shadow:0 0 0 3px rgba(123,77,255,.55)!important;cursor:pointer}`
  document.head.appendChild(st)

  let hov: Element | null = null
  document.addEventListener('mouseover', (e) => {
    const f = keyOf(e.target as Element)
    hov?.removeAttribute('data-cms-hover')
    hov = f ? f.el : null
    hov?.setAttribute('data-cms-hover', '')
  }, true)
  document.addEventListener('click', (e) => {
    // nút chuyển bước, chuyển tab, mở câu hỏi vẫn bấm được để tới chữ cần sửa
    if ((e.target as Element).closest('.rail button, .dtabs button, summary, .need button, .chips button')) return
    e.preventDefault(); e.stopPropagation()
    const f = keyOf(e.target as Element)
    document.querySelectorAll('[data-cms-on]').forEach((x) => x.removeAttribute('data-cms-on'))
    if (f) { f.el.setAttribute('data-cms-on', ''); post({ type: 'pick', key: f.key }); return }
    const area = (e.target as Element).closest('[data-cms]')
    if (area) post({ type: 'goto', tab: area.getAttribute('data-cms') })
  }, true)
  document.addEventListener('submit', (e) => e.preventDefault(), true)

  window.addEventListener('message', (e) => {
    if (e.origin !== cmsOrigin || !e.data || typeof e.data !== 'object') return
    if (e.data.type === 'ov' && site.cms) site.cms.ov = e.data.ov || {}
    if (e.data.type === 'nav' && typeof e.data.path === 'string' && e.data.path.startsWith('/')) router.push({ path: e.data.path, query: { edit: '1' } })
  })
  router.afterEach((to) => post({ type: 'ready', path: to.path }))
  post({ type: 'ready', path: location.pathname })
}
