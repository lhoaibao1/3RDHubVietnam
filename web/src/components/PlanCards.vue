<script setup lang="ts">
import { useSite } from '@/stores/site'

// Các gói báo giá (sửa trong CMS, mục Báo giá). Bấm chọn gói thì phát sự kiện để trang mở form đăng ký.
const site = useSite()
defineEmits<{ choose: [string] }>()
defineProps<{ link?: boolean }>()
</script>

<template>
  <div>
  <div class="g3 plans" data-cms="quote">
    <article v-for="(p, i) in site.quotePlans" :key="p.id" class="cd plan" :class="{ hl: p.hot }">
      <span v-if="p.hot" class="badge">{{ $t('Được chọn nhiều') }}</span>
      <span class="pcode">{{ String(i + 1).padStart(2, '0') }} · {{ site.pick(p.name) }}</span>
      <div class="price"><b>{{ site.pick(p.price) }}</b><small>{{ site.pick(p.unit) }}</small></div>
      <p class="pdesc">{{ site.pick(p.desc) }}</p>
      <ul class="ck"><li v-for="(f, k) in p.features" :key="k">{{ site.pick(f) }}</li></ul>
      <RouterLink v-if="link" class="btn" :class="p.hot ? 'or' : 'gh'" :to="{ path: '/baogia', query: { goi: p.id } }">{{ $t('Chọn gói này') }}</RouterLink>
      <button v-else type="button" class="btn" :class="p.hot ? 'or' : 'gh'" @click="$emit('choose', site.pick(p.name) + ' (' + site.pick(p.price) + ')')">{{ $t('Chọn gói này') }}</button>
    </article>
  </div>
  <p class="pnote">Giá niêm yết bằng VNĐ, chưa bao gồm thuế GTGT (nếu có), không phát sinh phí ẩn. Xem <RouterLink to="/chinh-sach-gia">Chính sách giá</RouterLink> và <RouterLink to="/chinh-sach-thanh-toan">Chính sách thanh toán</RouterLink>.</p>
  </div>
</template>
