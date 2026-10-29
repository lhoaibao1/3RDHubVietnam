<script setup lang="ts">
import { computed } from 'vue'
import { BRANDS, LUCIDE } from '@/lib/icons.generated'

// <Icon name="rocket"/> là icon nét (lucide); <Icon brand="go"/> là logo thương hiệu (simple-icons, đúng màu).
const props = defineProps<{ name?: string; brand?: string }>()
const lucide = computed(() => (props.name ? LUCIDE[props.name] ?? '' : ''))
const brand = computed(() => (props.brand ? BRANDS[props.brand] : undefined))
</script>

<template>
  <svg v-if="brand" viewBox="0 0 24 24" aria-hidden="true"><path :fill="brand.c" :d="brand.p" /></svg>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="lucide" />
</template>
