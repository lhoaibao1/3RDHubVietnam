<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Ảnh chụp giao diện thật của 3RDVN HUB, tự chuyển ảnh, bấm ảnh nhỏ để xem.
const SHOTS: [string, string][] = [['dashboard', 'Tổng quan'], ['campaigns', 'Chiến dịch'], ['tracking', 'Tạo link'], ['orders', 'Đơn hàng'], ['clicks', 'Lượt click'], ['members', 'Thành viên'], ['access', 'Phân quyền'], ['settings', 'Cài đặt'], ['advertisers', 'Advertiser'], ['apidocs', 'Tài liệu API']]
const i = ref(0)
let t = 0
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
function go(n: number) { i.value = (n + SHOTS.length) % SHOTS.length; start() }
function start() { clearInterval(t); if (!RM) t = window.setInterval(() => { i.value = (i.value + 1) % SHOTS.length }, 3600) }
onMounted(start)
onBeforeUnmount(() => clearInterval(t))
</script>

<template>
  <div class="hgal">
    <div class="hwin">
      <div class="hbar"><i /><i /><i /><span>3RDVN HUB · {{ $t(SHOTS[i][1]) }}</span><em>{{ i + 1 }} / {{ SHOTS.length }}</em></div>
      <div class="htrack" :style="{ transform: 'translateX(' + -i * 100 + '%)' }">
        <img v-for="(s, k) in SHOTS" :key="s[0]" :src="'/hub/' + s[0] + '.webp'" :alt="$t(s[1])" width="1280" height="784" :loading="k ? 'lazy' : 'eager'">
      </div>
      <button type="button" class="hnav prev" :aria-label="$t('Ảnh trước')" @click="go(i - 1)">‹</button>
      <button type="button" class="hnav next" :aria-label="$t('Ảnh sau')" @click="go(i + 1)">›</button>
    </div>
    <div class="hthumbs">
      <button v-for="(s, k) in SHOTS" :key="s[0]" type="button" :class="{ on: k === i }" :aria-label="$t(s[1])" @click="go(k)"><img :src="'/hub/' + s[0] + '.webp'" alt="" loading="lazy"><span>{{ $t(s[1]) }}</span></button>
    </div>
  </div>
</template>
