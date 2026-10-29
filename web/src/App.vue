<script setup lang="ts">
import { useSeo } from '@/composables/useSeo'
import SiteNav from '@/components/SiteNav.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import ScrollProgress from '@/components/ScrollProgress.vue'
import CookieBanner from '@/components/CookieBanner.vue'

useSeo()
</script>

<template>
  <ScrollProgress />
  <SiteNav />
  <RouterView />
  <SiteFooter />
  <CookieBanner />
</template>
