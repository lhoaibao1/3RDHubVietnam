<script setup lang="ts">
import { useSite } from '@/stores/site'

// Khách hàng tiêu biểu (sửa trong CMS, mục Khách hàng). Danh sách trống thì không hiện khu này.
const site = useSite()
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
</script>

<template>
  <section v-if="site.clients.length" class="ps clients" data-cms="clients">
    <div class="k2">Khách hàng</div>
    <h2>Khách hàng của chúng tôi</h2>
    <p class="sub">Những doanh nghiệp đang dùng hệ thống do 3RDVN Technology xây dựng và vận hành.</p>
    <div class="clist">
      <article v-for="c in site.clients" :key="c.id" class="cl">
        <span class="lg"><img v-if="c.logo" :src="c.logo" :alt="c.name"><b v-else>{{ initials(c.name) }}</b></span>
        <h3>{{ c.name }}</h3>
        <p v-if="site.pick(c.desc)">{{ site.pick(c.desc) }}</p>
        <a v-if="c.url" :href="c.url" target="_blank" rel="noopener">{{ $t('Xem website') }} ↗</a>
      </article>
    </div>
  </section>
</template>
