<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import Page3D from '@/components/Page3D.vue'
import LeadForm from '@/components/LeadForm.vue'
import PlanCards from '@/components/PlanCards.vue'
import CompareTable from '@/components/CompareTable.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

// Trang Báo giá (/baogia): không nằm trên menu, vào từ trang Sản phẩm. Các gói và giá sửa trong CMS (tab Báo giá).
const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)
const chosen = ref('')
const need = ref('Nhận báo giá hệ thống')
function choose(name: string, trial = false) {
  need.value = trial ? 'Đăng ký dùng thử' : 'Nhận báo giá hệ thống'
  chosen.value = name
  setTimeout(() => document.getElementById('form2')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
}
// đến từ nút "Chọn gói này" (?goi=) hoặc "Đăng ký dùng thử" (?dungthu=1) ở trang Sản phẩm
const route = useRoute()
onMounted(() => {
  const g = site.quotePlans.find((p) => p.id === route.query.goi)
  if (g) choose(site.pick(g.name) + ' (' + site.pick(g.price) + ')')
  else if (route.query.dungthu) choose(site.t('Dùng thử hệ thống'), true)
})
</script>

<template>
<main>
<section ref="root" class="w pg" id="p-bao-gia">
  <div class="pgh">
    <div>
      <h1>Báo giá <span class="o">theo đúng phạm vi của bạn.</span></h1>
      <p class="lead">Mỗi hệ thống có quy mô và tính năng khác nhau nên chúng tôi báo giá theo phạm vi cụ thể. Chọn gói gần nhất với nhu cầu, để lại thông tin và đội ngũ 3RDVN Technology sẽ liên hệ.</p>
      <div class="acts"><a class="btn or" href="#form2" @click.prevent="choose('')">Nhận báo giá</a><a class="btn gh" href="#form2" @click.prevent="choose($t('Dùng thử hệ thống'), true)">Đăng ký dùng thử</a><a class="btn gh" :href="site.S('demo_url')" target="_blank" rel="noopener">Xem demo</a></div></div>
    <Page3D id="bao-gia" tint="#FFB238"><div class="ft" style="left:18px;top:18px"><b>Báo giá theo phạm vi</b><span>Rõ từng hạng mục</span></div><div class="ft" style="right:18px;bottom:18px"><b>Có bản demo</b><span>Xem trước khi quyết định</span></div></Page3D>
  </div>

  <div class="ps"><div class="k2">Các gói</div><h2>Chọn gói phù hợp</h2>
    <PlanCards @choose="choose" /></div>

  <div class="ps"><div class="k2">So sánh</div><h2>Khác nhau ở đâu</h2>
    <CompareTable /></div>

  <div class="ps"><div class="k2">Quy trình</div><h2>Từ yêu cầu đến báo giá</h2>
    <ol class="steps6">
      <li><b>01</b><h3>Gửi yêu cầu</h3><p>Cho chúng tôi biết sản phẩm, quy mô publisher và mục tiêu của bạn.</p></li>
      <li><b>02</b><h3>Tư vấn, khảo sát</h3><p>Trao đổi nghiệp vụ, xem hệ thống mẫu và chốt phạm vi.</p></li>
      <li><b>03</b><h3>Báo giá chi tiết</h3><p>Nhận bảng báo giá theo từng hạng mục và tiến độ.</p></li>
      <li><b>04</b><h3>Ký và triển khai</h3><p>Thống nhất hợp đồng, bắt đầu thiết kế và lập trình.</p></li>
    </ol></div>

  <div class="g2 ps0">
    <article class="cd path">
      <div class="k2">Muốn xem trước?</div>
      <h2>Dùng thử hệ thống mẫu</h2>
      <p>Trang demo cho bạn xem giao diện website cộng tác viên và hệ thống quản trị trước khi chọn gói.</p>
      <div class="acts"><a class="btn or" :href="site.S('demo_url')" target="_blank" rel="noopener">Mở trang demo</a><RouterLink class="btn gh" to="/san-pham">Về trang Sản phẩm</RouterLink></div>
    </article>
    <LeadForm variant="page" :need="need" :prefill="chosen" />
  </div>
</section>
</main>
</template>
