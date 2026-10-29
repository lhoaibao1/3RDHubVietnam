<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { observeReveal, type RevealGroup } from '@/composables/reveal'
import HeroStory from '@/components/HeroStory.vue'
import BizSection from '@/components/BizSection.vue'
import TechSection from '@/components/TechSection.vue'
import PartnersSection from '@/components/PartnersSection.vue'
import FaqSection from '@/components/FaqSection.vue'
import ContactSection from '@/components/ContactSection.vue'

// Hiệu ứng cuộn của trang chủ: mỗi khu vực hiện ra theo một hướng khác nhau.
const GROUPS: RevealGroup[] = [
  ['.bh > div:first-child > *'], ['.lyr > div', 'rv-r'], ['.demo', 'rv-z'],
  ['.th > *'], ['.arch', 'rv-z'], ['.dev-stage', 'rv-l'], ['.dev .term', 'rv-r'], ['.stack2 .sc2'],
  ['.partners > h2'], ['.partners > p'], ['.partners > .more'], ['.plist', 'rv-z'],
  ['.fqi > *', 'rv-l'], ['.fq details', 'rv-r'],
  ['.contact .ppath > *', 'rv-l'], ['.contact form', 'rv-r'],
]
const root = ref<HTMLElement | null>(null)
let stop = () => {}
onMounted(() => { if (root.value) stop = observeReveal(root.value, GROUPS) })
onBeforeUnmount(() => stop())
</script>

<template>
  <main id="top" ref="root">
    <HeroStory />
    <BizSection />
    <TechSection />
    <PartnersSection />
    <FaqSection />
    <ContactSection />
  </main>
</template>
