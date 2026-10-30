<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSite } from '@/stores/site'

// Ảnh chụp giao diện thật của 3RDVN HUB (sửa trong CMS, tab Sản phẩm), tự chuyển ảnh, bấm ảnh nhỏ để xem.
const site = useSite()
const SHOTS = computed(() => site.shots)
const i = ref(0)
let t = 0
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
function go(n: number) { i.value = (n + SHOTS.value.length) % (SHOTS.value.length || 1); start() }
function start() { clearInterval(t); if (!RM) t = window.setInterval(() => { i.value = (i.value + 1) % (SHOTS.value.length || 1) }, 3600) }
watch(() => SHOTS.value.length, (n) => { if (i.value >= n) i.value = 0 })
onMounted(start)
onBeforeUnmount(() => clearInterval(t))
</script>

<template>
  <div v-if="SHOTS.length" class="hgal" data-cms="product">
    <div class="hwin">
      <div class="hbar"><i /><i /><i /><span>3RDVN HUB · {{ site.pick(SHOTS[Math.min(i, SHOTS.length - 1)].label) }}</span><em>{{ i + 1 }} / {{ SHOTS.length }}</em></div>
      <div class="htrack" :style="{ transform: 'translateX(' + -i * 100 + '%)' }">
        <img v-for="(s, k) in SHOTS" :key="s.id" :src="s.img" :alt="site.pick(s.label)" width="1280" height="784" :loading="k ? 'lazy' : 'eager'">
      </div>
      <button type="button" class="hnav prev" :aria-label="$t('Ảnh trước')" @click="go(i - 1)">‹</button>
      <button type="button" class="hnav next" :aria-label="$t('Ảnh sau')" @click="go(i + 1)">›</button>
    </div>
    <div class="hthumbs">
      <button v-for="(s, k) in SHOTS" :key="s.id" type="button" :class="{ on: k === i }" :aria-label="site.pick(s.label)" @click="go(k)"><img :src="s.img" alt="" loading="lazy"><span>{{ site.pick(s.label) }}</span></button>
    </div>
  </div>
</template>
