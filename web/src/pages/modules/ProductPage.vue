<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'
import Page3D from '@/components/Page3D.vue'
import PageCta from '@/components/PageCta.vue'
import ClientsSection from '@/components/ClientsSection.vue'
import PlanCards from '@/components/PlanCards.vue'
import CompareTable from '@/components/CompareTable.vue'
import HubGallery from '@/components/HubGallery.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)
</script>

<template>
<section ref="root" class="w pg" id="p-san-pham">
  <div class="pgh">
    <div>
      <div class="k2">Phần mềm vận hành phân phối</div>
      <h1>3RDVN HUB, <span class="o">kết nối nguồn lực, tăng tốc tăng trưởng.</span></h1>
      <p class="lead">Quản trị chiến dịch, nhân sự, đơn hàng và hoa hồng trên một hệ thống. Tài khoản xem hệ thống được cấp sau khi bạn gửi form đăng ký dùng thử.</p>
      <div class="acts"><RouterLink class="btn or" :to="{ path: '/baogia', query: { dungthu: '1' } }">Đăng ký dùng thử</RouterLink><RouterLink class="btn gh" to="/baogia">Xem báo giá</RouterLink><a class="btn gh" :href="site.S('demo_url')" target="_blank" rel="noopener">Xem demo</a></div></div>
    <Page3D id="san-pham" tint="#1BA6D9"><div class="ft" style="left:18px;top:18px"><b>9 nhóm chức năng</b><span>Từ chiến dịch đến thanh toán</span></div><div class="ft" style="right:18px;bottom:18px"><b>Thuê, self-host hoặc mua source</b><span>Chọn cách phù hợp</span></div></Page3D>
  </div>

  <div class="ps"><div class="k2">01 / Chức năng hiện có</div><h2>Toàn bộ module HUB</h2>
    <div class="mods" data-cms="product">
      <article v-for="m in site.modules" :key="m.id" class="cd mod">
        <span class="mcode">{{ site.pick(m.code) }}</span>
        <h3>{{ site.pick(m.title) }}</h3>
        <ul class="ck"><li v-for="(it, k) in m.items" :key="k">{{ site.pick(it) }}</li></ul>
      </article>
    </div></div>

  <div class="ps"><div class="k2">02 / Giao diện</div><h2>Giao diện hệ thống</h2>
    <HubGallery /></div>

  <ClientsSection />

  <div class="ps"><div class="k2">03 / So sánh</div><h2>Thuê, self-host hay mua source</h2>
    <CompareTable /></div>

  <div class="ps"><div class="k2">04 / Báo giá</div><h2>Ba gói</h2>
    <PlanCards link /></div>

  <div class="ps"><div class="k2">Quy trình</div><h2>Triển khai trong sáu bước</h2>
    <ol class="steps6"><li><b>01</b><h3>Tư vấn</h3><p>Nghe sản phẩm, quy mô publisher và cách bạn muốn trả hoa hồng.</p></li><li><b>02</b><h3>Thiết kế</h3><p>Chốt luồng nghiệp vụ, giao diện và phạm vi tính năng.</p></li><li><b>03</b><h3>Lập trình</h3><p>Frontend Vue.js, backend Go, kết nối đối tác.</p></li><li><b>04</b><h3>Kiểm thử</h3><p>Chạy thử tracking và postback trên môi trường test.</p></li><li><b>05</b><h3>Bàn giao</h3><p>Tài liệu bàn giao, hướng dẫn đội vận hành.</p></li><li><b>06</b><h3>Nâng cấp</h3><p>Bổ sung tính năng theo từng giai đoạn.</p></li></ol></div>

  <div class="ps"><div class="cta xs"><div><h2>Muốn xem hệ thống thật?</h2><p>Gửi form đăng ký dùng thử, 3RDVN cấp tài khoản xem hệ thống cho bạn.</p></div><RouterLink class="btn or" :to="{ path: '/baogia', query: { dungthu: '1' } }">Đăng ký dùng thử</RouterLink></div></div>

  <PageCta />
</section>
</template>
