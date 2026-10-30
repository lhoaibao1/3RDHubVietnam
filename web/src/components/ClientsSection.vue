<script setup lang="ts">
import { useSite } from '@/stores/site'

// Khách hàng của chúng tôi: chỉ hiện logo giống khu Đối tác, nằm ngay dưới Đối tác. Sửa trong CMS (mục Khách hàng); trống thì ẩn.
// home: dải logo chạy ngang như trang chủ; page: lưới logo như trang Đối tác.
defineProps<{ variant: 'home' | 'page' }>()
const site = useSite()
</script>

<template>
  <div v-if="site.clients.length" class="clients" :class="variant" data-cms="clients">
    <h3 class="clh">Khách hàng của chúng tôi</h3>
    <div v-if="variant === 'home'" class="plist">
      <div class="mq rev">
        <template v-for="copy in 2" :key="copy">
          <div v-for="c in site.clients" :key="copy + c.id" class="pt" :aria-hidden="copy === 2 ? 'true' : undefined">
            <span class="lg"><img v-if="c.logo" :src="c.logo" :alt="c.name"><b v-else>{{ c.name }}</b></span>
          </div>
        </template>
      </div>
    </div>
    <div v-else class="pg2">
      <div v-for="c in site.clients" :key="c.id" class="pt">
        <span class="lg"><img v-if="c.logo" :src="c.logo" :alt="c.name"><b v-else>{{ c.name }}</b></span>
      </div>
    </div>
  </div>
</template>
