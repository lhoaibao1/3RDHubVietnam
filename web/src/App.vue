<script setup lang="ts">
import { useSeo } from '@/composables/useSeo'
import SiteNav from '@/components/SiteNav.vue'
import SiteFooter from '@/components/SiteFooter.vue'

useSeo()
</script>

<template>
  <SiteNav />
  <RouterView />
  <SiteFooter />
</template>
