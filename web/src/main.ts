import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useSite } from './stores/site'
import { setMode } from './three/mode'
import './styles/fonts.css'
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
// Có lối thoát: tải mã trang lỗi (vừa cập nhật website, mạng chập chờn) thì tự tải lại một lần; quá 8 giây vẫn dựng giao diện.
function reloadOnce() {
  try { if (sessionStorage.getItem('3rd-reload')) return; sessionStorage.setItem('3rd-reload', '1') } catch { return }
  location.reload()
}
addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadOnce() })
router.onError((err) => { if (/dynamically imported module|importing a module script|failed to fetch|loading chunk/i.test(String((err as Error)?.message))) reloadOnce() })
trackScroll()
const wait = new Promise<void>((r) => setTimeout(r, 8000))
Promise.race([router.isReady().catch(() => {}), wait]).finally(() => {
  app.mount('#app')
  restoreScroll()
  setTimeout(() => { try { sessionStorage.removeItem('3rd-reload') } catch { /* bỏ qua */ } }, 6000)
  const boot = document.getElementById('boot')
  if (boot) { requestAnimationFrame(() => { boot.classList.add('off'); setTimeout(() => boot.remove(), 600) }) }
})
