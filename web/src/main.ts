import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useSite } from './stores/site'
import { setMode } from './three/mode'
import './styles/site.css'
import './styles/backgrounds.css'
import { restoreScroll, trackScroll } from './lib/scrollRestore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const site = useSite(pinia)
app.config.globalProperties.$t = (key: string) => site.t(key)
setMode(site.theme)
document.documentElement.lang = site.lang
document.documentElement.dataset.theme = site.theme
document.documentElement.style.colorScheme = site.theme
site.load()

// Chỉ dựng giao diện khi trang đầu tiên đã sẵn sàng (đã tải xong mã của trang), tránh cảnh chân trang hiện trước nội dung rồi bị đẩy xuống.
trackScroll()
router.isReady().catch(() => {}).finally(() => {
  app.mount('#app')
  restoreScroll()
  const boot = document.getElementById('boot')
  if (boot) { requestAnimationFrame(() => { boot.classList.add('off'); setTimeout(() => boot.remove(), 600) }) }
})
