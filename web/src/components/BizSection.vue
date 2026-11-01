<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RM } from '@/three/core'
import { useSite } from '@/stores/site'

// Ảnh chụp giao diện thật của 3RDVN HUB (cùng bộ ảnh ở trang Sản phẩm, sửa trong CMS). Mỗi tab là một màn hình.
const site = useSite()
const TABS: { id: string; vi: string }[] = [
  { id: 'dashboard', vi: 'Tổng quan' },
  { id: 'campaign-list', vi: 'Chiến dịch' },
  { id: 'campaign-detail', vi: 'Chi tiết chiến dịch' },
  { id: 'order-list', vi: 'Đơn hàng' },
  { id: 'clicks', vi: 'Lượt click' },
]
const shots = computed(() => TABS.map((t) => ({ ...t, shot: site.shots.find((x) => x.id === t.id) })).filter((t) => t.shot))
const cur = ref(0)
let timer = 0

function auto() {
  clearInterval(timer)
  if (!RM) timer = window.setInterval(() => { cur.value = (cur.value + 1) % (shots.value.length || 1) }, 4200)
}
function show(i: number) {
  cur.value = i
  auto()
}
onMounted(auto)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
<section class="w biz" id="doanh-nghiep">
  <div class="bh">
    <div>
      <div class="k2">Sản phẩm</div>
      <h2><span>Hệ thống affiliate riêng,</span><span class="o">mang thương hiệu của bạn.</span></h2>
      <p class="lead">3RDVN Technology thiết kế và lập trình trọn gói: website cho cộng tác viên, nền tảng quản trị và kết nối với đối tác. 3RDHub Vietnam chính là hệ thống chúng tôi tự xây và đang vận hành.</p>
      <RouterLink class="more" to="/san-pham">Xem chi tiết →</RouterLink> <RouterLink class="more" to="/baogia">Xem báo giá →</RouterLink>
    </div>
    <div class="lyr">
      <div><span class="n">1</span><span><b>Website cho cộng tác viên</b><span>Trang chiến dịch, đăng ký publisher, tạo link, ví hoa hồng, định danh</span></span></div>
      <div><span class="n">2</span><span><b>Hệ thống quản trị</b><span>Chiến dịch, báo cáo click, lead, đơn, đối soát, chia hoa hồng, đội nhóm</span></span></div>
      <div><span class="n">3</span><span><b>Kết nối đối tác</b><span>Postback, API key, môi trường test, tài liệu API</span></span></div>
    </div>
  </div>
  <div v-if="shots.length" class="demo">
    <div class="dtabs" role="tablist" :aria-label="$t('Màn hình demo')">
      <button v-for="(t, i) in shots" :key="t.id" role="tab" :aria-selected="cur === i" @click="show(i)">{{ $t(t.vi) }}</button>
    </div>
    <div class="dwin">
      <div class="hbar"><i /><i /><i /><span>3RDVN HUB · {{ $t(shots[Math.min(cur, shots.length - 1)].vi) }}</span></div>
      <div class="dstage">
        <img v-for="(t, i) in shots" :key="t.id" :src="t.shot!.img" :alt="site.pick(t.shot!.label)" width="1280" height="784" :class="{ on: cur === i }" :loading="i ? 'lazy' : 'eager'">
      </div>
    </div>
    <p class="dnote">Giao diện thật của hệ thống 3RDVN HUB.</p>
  </div>
</section>
</template>
