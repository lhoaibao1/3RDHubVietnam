<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NAV } from '@/lib/content'
import { useSite } from '@/stores/site'
import BrandMark from './BrandMark.vue'

const site = useSite()
const route = useRoute()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

watch(() => route.fullPath, () => { open.value = false })

function outside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', outside))
onBeforeUnmount(() => document.removeEventListener('click', outside))
</script>

<template>
  <header ref="root" class="nav" :class="{ open }">
    <RouterLink class="brand" to="/" aria-label="3RDHub Vietnam"><BrandMark /></RouterLink>
    <nav aria-label="Điều hướng">
      <RouterLink v-for="n in NAV" :key="n[0]" :to="'/' + n[0]">{{ $t(n[1]) }}</RouterLink>
      <a class="mcta" :href="site.S('signup_url')" target="_blank" rel="noopener">Đăng ký ngay</a>
    </nav>
    <a class="btn or" :href="site.S('signup_url')" target="_blank" rel="noopener">Đăng ký ngay</a>
    <div class="tools">
      <button type="button" class="tbtn langbtn" :aria-label="$t('Đổi ngôn ngữ')" :title="site.lang === 'vi' ? 'Tiếng Việt → English' : 'English → Tiếng Việt'" @click="site.toggleLang()">
        <Transition name="flip" mode="out-in">
          <svg v-if="site.lang === 'vi'" key="vi" class="flag" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#DA251D" /><path fill="#FFCD00" d="m10 4.6 1.3 4h4.2l-3.4 2.5 1.3 4L10 12.6l-3.4 2.5 1.3-4-3.4-2.5h4.2z" /></svg>
          <svg v-else key="en" class="flag" viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="fgb"><circle cx="10" cy="10" r="10" /></clipPath></defs><g clip-path="url(#fgb)"><rect width="20" height="20" fill="#012169" /><path d="M0 0 20 20M20 0 0 20" stroke="#fff" stroke-width="4" /><path d="M0 0 20 20M20 0 0 20" stroke="#C8102E" stroke-width="1.6" /><path d="M10 0v20M0 10h20" stroke="#fff" stroke-width="6" /><path d="M10 0v20M0 10h20" stroke="#C8102E" stroke-width="3.4" /></g></svg>
        </Transition>
      </button>
      <button type="button" class="tbtn themebtn" :aria-label="$t('Đổi giao diện sáng/tối')" :aria-pressed="site.theme === 'dark'" @click="site.toggleTheme({ x: $event.clientX, y: $event.clientY })">
        <Transition name="flip" mode="out-in">
          <svg v-if="site.theme === 'dark'" key="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          <svg v-else key="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        </Transition>
      </button>
    </div>
    <button type="button" class="mnu" aria-label="Mở menu" :aria-expanded="open" @click.stop="open = !open">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
  </header>
</template>
