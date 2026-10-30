<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useAdmin } from './store'
import { SECTIONS, TABS, type TabKey } from './types'
import BrandLogo from './components/BrandLogo.vue'
import LoginView from './views/LoginView.vue'
import DashView from './views/DashView.vue'
import LiveView from './views/LiveView.vue'
import TextView from './views/TextView.vue'
import FaqView from './views/FaqView.vue'
import PartnersView from './views/PartnersView.vue'
import ClientsView from './views/ClientsView.vue'
import QuoteView from './views/QuoteView.vue'
import ModulesView from './views/ModulesView.vue'
import strings from './strings.json'
import LookView from './views/LookView.vue'
import BgView from './views/BgView.vue'
import EmailView from './views/EmailView.vue'
import LegalView from './views/LegalView.vue'
import LeadsView from './views/LeadsView.vue'
import SettingsView from './views/SettingsView.vue'
import HistoryView from './views/HistoryView.vue'

const a = useAdmin()
a.boot()

const ALL_GROUPS = (strings as { groups: string[] }).groups
const VIEWS: Record<string, unknown> = { dash: DashView, live: LiveView, faq: FaqView, partners: PartnersView, clients: ClientsView, quote: QuoteView, product: ModulesView, legal: LegalView, leads: LeadsView, history: HistoryView, look: LookView, bg: BgView, email: EmailView }
const ICONS: Record<TabKey, string> = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  live: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  product: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12l8.7-4.5M12 22V12"/>',
  text: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  faq: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  partners: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>',
  clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  quote: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6"/>',
  legal: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
  company: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  seo: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
  look: '<path d="M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12v10M12 12L3 7"/>',
  bg: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  email: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  account: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  leads: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
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
        <template v-for="sec in SECTIONS" :key="sec.title">
          <p v-if="sec.title" class="sec">{{ sec.title }}</p>
          <button v-for="t in sec.tabs" :key="t[0]" type="button" :data-tab="t[0]" :aria-current="a.tab === t[0] ? 'page' : undefined" @click="a.go(t[0])">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[t[0]]" />
            <span class="lb">{{ t[1] }}</span>
            <span v-if="t[0] === 'leads' && a.newLeads" class="bd">{{ a.newLeads }}</span>
          </button>
        </template>
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
      <TextView v-if="a.tab === 'text'" :groups="ALL_GROUPS" />
      <SettingsView v-else-if="a.tab === 'company' || a.tab === 'seo' || a.tab === 'account'" :part="a.tab" />
      <component :is="VIEWS[a.tab]" v-else />
    </main>
  </div>
  <div v-if="a.toast" class="toast" :class="{ bad: a.toast.bad }" role="status">{{ a.toast.msg }}</div>
</template>
