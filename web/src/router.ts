import { createRouter, createWebHistory } from 'vue-router'
import { LEGAL_DOCS, SLUGS } from './lib/content'
import { useSite } from './stores/site'

const SLUG_RE = SLUGS.join('|')
/** Địa chỉ có tiền tố ngôn ngữ: /vi/san-pham, /en/baogia. Không tiền tố thì tự chuyển sang tiền tố theo ngôn ngữ đang dùng. */
const L = '/:lang(vi|en)?'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: L, name: 'home', component: () => import('./pages/HomePage.vue') },
    { path: `${L}/:slug(${SLUG_RE})`, name: 'module', component: () => import('./pages/ModulePage.vue'), props: true },
    { path: L + '/baogia', name: 'quote', component: () => import('./pages/QuotePage.vue') },
    { path: L + '/dang-ky', name: 'register', component: () => import('./pages/RegisterPage.vue') },
    ...LEGAL_DOCS.map((d) => ({ path: L + '/' + d.slug, name: d.key, component: () => import('./pages/LegalPage.vue'), props: { doc: d.key } })),
    { path: L + '/chinh-sach', name: 'policies', component: () => import('./pages/PoliciesPage.vue') },
    { path: '/terms', redirect: '/dieu-khoan' },
    { path: '/privacy', redirect: '/bao-mat' },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash && to.name === 'home') return { el: to.hash, top: 0 }
    return { top: 0 }
  },
})

// Địa chỉ cũ kiểu "/#/mo-hinh" chuyển sang đường dẫn sạch "/mo-hinh".
router.beforeEach((to) => {
  const site = useSite()
  const lg = to.params.lang as string | undefined
  if (lg === 'vi' || lg === 'en') {
    if (site.lang !== lg) site.setLang(lg) // địa chỉ có ngôn ngữ thì ưu tiên hơn lựa chọn đã lưu
  } else if (to.name !== undefined && to.matched.length) {
    const rest = to.path === '/' ? '' : to.path
    return { path: '/' + site.lang + rest, query: to.query, hash: to.hash } // không replace: bấm liên kết vẫn là một bước lịch sử, nút Back dùng được
  }
  const m = /^#\/([a-z-]+)$/.exec(to.hash)
  if (to.path === '/' && m && (SLUGS as readonly string[]).concat(LEGAL_DOCS.map((d) => d.slug)).includes(m[1])) return { path: '/' + site.lang + '/' + m[1], replace: true }
})
