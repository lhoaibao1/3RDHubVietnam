import { createRouter, createWebHistory } from 'vue-router'
import { LEGAL_DOCS, SLUGS } from './lib/content'

const SLUG_RE = SLUGS.join('|')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./pages/HomePage.vue') },
    { path: `/:slug(${SLUG_RE})`, name: 'module', component: () => import('./pages/ModulePage.vue'), props: true },
    { path: '/baogia', name: 'quote', component: () => import('./pages/QuotePage.vue') },
    { path: '/dang-ky', name: 'register', component: () => import('./pages/RegisterPage.vue') },
    ...LEGAL_DOCS.map((d) => ({ path: '/' + d.slug, name: d.key, component: () => import('./pages/LegalPage.vue'), props: { doc: d.key } })),
    { path: '/chinh-sach', name: 'policies', component: () => import('./pages/PoliciesPage.vue') },
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
  const m = /^#\/([a-z-]+)$/.exec(to.hash)
  if (to.path === '/' && m && (SLUGS as readonly string[]).concat(LEGAL_DOCS.map((d) => d.slug)).includes(m[1])) return { path: '/' + m[1], replace: true }
})
