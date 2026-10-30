<script setup lang="ts">
import { computed } from 'vue'
import ModelPage from './modules/ModelPage.vue'
import AdvertiserPage from './modules/AdvertiserPage.vue'
import ProductPage from './modules/ProductPage.vue'
import TechPage from './modules/TechPage.vue'
import PartnersPage from './modules/PartnersPage.vue'
import FaqPage from './modules/FaqPage.vue'
import ContactPage from './modules/ContactPage.vue'

const props = defineProps<{ slug: string }>()
const PAGES: Record<string, unknown> = {
  'mo-hinh': ModelPage, advertiser: AdvertiserPage, 'san-pham': ProductPage, 'cong-nghe': TechPage, 'doi-tac': PartnersPage, 'hoi-dap': FaqPage, 'lien-he': ContactPage,
}
const page = computed(() => PAGES[props.slug] as object)
</script>

<template>
  <main><component :is="page" :key="slug" /></main>
</template>
