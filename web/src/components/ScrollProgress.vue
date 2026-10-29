<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Thanh tiến độ cuộn trang ở mép trên màn hình.
const bar = ref<HTMLElement | null>(null)
let raf = 0
function update() {
  raf = 0
  const h = document.documentElement.scrollHeight - innerHeight
  if (bar.value) bar.value.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`
}
function onScroll() { if (!raf) raf = requestAnimationFrame(update) }
onMounted(() => { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); update() })
onBeforeUnmount(() => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll) })
</script>

<template>
  <div ref="bar" class="scrollbar" aria-hidden="true" />
</template>
