import { createRouter, createWebHistory } from 'vue-router'
import { SLUGS } from './lib/content'

const SLUG_RE = SLUGS.join('|')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./pages/HomePage.vue') },
    { path: `/:slug(${SLUG_RE})`, name: 'module', component: () => import('./pages/ModulePage.vue'), props: true },
    { path: '/dieu-khoan', name: 'terms', component: () => import('./pages/LegalPage.vue'), props: { doc: 'terms' } },
    { path: '/bao-mat', name: 'privacy', component: () => import('./pages/LegalPage.vue'), props: { doc: 'privacy' } },
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
  if (to.path === '/' && m && (SLUGS as readonly string[]).concat(['dieu-khoan', 'bao-mat']).includes(m[1])) return { path: '/' + m[1], replace: true }
})
