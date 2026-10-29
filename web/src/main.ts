import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useSite } from './stores/site'
import { setMode } from './three/mode'
import './styles/site.css'
import './styles/backgrounds.css'

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

app.mount('#app')
