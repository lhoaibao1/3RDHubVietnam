<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RM } from '@/three/core'

// <b> đếm từ 0 tới `n` khi cuộn tới (hoặc đổi số ngay nếu `n` thay đổi sau đó).
const props = defineProps<{ n: number }>()
const el = ref<HTMLElement | null>(null)
const shown = ref(0)
let started = false
let io: IntersectionObserver | null = null
let raf = 0

function run(to: number) {
  cancelAnimationFrame(raf)
  if (RM) { shown.value = to; return }
  const t0 = performance.now()
  const up = (t: number) => {
    const k = Math.min(1, (t - t0) / 900)
    shown.value = Math.round(to * (1 - Math.pow(1 - k, 3)))
    if (k < 1) raf = requestAnimationFrame(up)
  }
  raf = requestAnimationFrame(up)
}

onMounted(() => {
  if (!('IntersectionObserver' in window)) { shown.value = props.n; started = true; return }
  io = new IntersectionObserver((es) => {
    if (es[0].isIntersecting && !started) { started = true; io?.disconnect(); run(props.n) }
  })
  io.observe(el.value!)
})
watch(() => props.n, (n) => { if (started) run(n) })
onBeforeUnmount(() => { io?.disconnect(); cancelAnimationFrame(raf) })
</script>

<template>
  <b ref="el">{{ shown }}</b>
</template>
