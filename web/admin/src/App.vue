<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useAdmin } from './store'
import { TABS, type TabKey } from './types'
import BrandLogo from './components/BrandLogo.vue'
import LoginView from './views/LoginView.vue'
import DashView from './views/DashView.vue'
import TextView from './views/TextView.vue'
import FaqView from './views/FaqView.vue'
import PartnersView from './views/PartnersView.vue'
import LegalView from './views/LegalView.vue'
import LeadsView from './views/LeadsView.vue'
import SettingsView from './views/SettingsView.vue'
import HistoryView from './views/HistoryView.vue'

const a = useAdmin()
a.boot()

const VIEWS = { dash: DashView, text: TextView, faq: FaqView, partners: PartnersView, legal: LegalView, leads: LeadsView, settings: SettingsView, history: HistoryView }
const ICONS: Record<TabKey, string> = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  faq: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  partners: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>',
  leads: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  legal: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
}
const siteUrl = location.origin.replace('//cms.', '//')
const title = () => TABS.find((t) => t[0] === a.tab)![1]

function beforeUnload(e: BeforeUnloadEvent) {
  if (a.dirty) { e.preventDefault(); e.returnValue = '' }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <p v-if="!a.ready" class="boot">Đang tải…</p>
  <LoginView v-else-if="!a.loggedIn" />
  <div v-else class="shell">
    <aside class="side">
      <BrandLogo />
      <nav aria-label="Mục quản trị">
        <button v-for="t in TABS" :key="t[0]" type="button" :data-tab="t[0]" :aria-current="a.tab === t[0] ? 'page' : undefined" @click="a.go(t[0])">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[t[0]]" />
          <span class="lb">{{ t[1] }}</span>
          <span v-if="t[0] === 'leads' && a.newLeads" class="bd">{{ a.newLeads }}</span>
        </button>
      </nav>
      <div class="sp" />
      <div class="foot">
        <a class="btn gh sm" :href="siteUrl" target="_blank" rel="noopener">Xem website ↗</a>
        <button class="btn gh sm" type="button" @click="a.logout()">Đăng xuất</button>
      </div>
    </aside>
    <main class="main">
      <div class="top">
        <h1>{{ title() }}</h1>
        <div class="savebar" :class="{ on: a.dirty }" role="status">
          <span>Có thay đổi chưa lưu</span>
          <button class="btn gh sm" type="button" @click="a.discard()">Bỏ</button>
          <button class="btn sm save" type="button" :disabled="a.saving" @click="a.save()">{{ a.saving ? 'Đang lưu…' : 'Lưu và đăng lên website' }}</button>
        </div>
      </div>
      <component :is="VIEWS[a.tab]" />
    </main>
  </div>
  <div v-if="a.toast" class="toast" :class="{ bad: a.toast.bad }" role="status">{{ a.toast.msg }}</div>
</template>
