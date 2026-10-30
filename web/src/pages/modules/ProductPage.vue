<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'
import Page3D from '@/components/Page3D.vue'
import PageCta from '@/components/PageCta.vue'
import PlanCards from '@/components/PlanCards.vue'
import CompareTable from '@/components/CompareTable.vue'
import HubGallery from '@/components/HubGallery.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

// Trang Sản phẩm: giới thiệu các dự án 3RDVN đang làm (sửa trong CMS, tab Sản phẩm), rồi đi vào từng dự án.
// Dự án có id "saas" kèm thêm module, ảnh giao diện thật, so sánh và báo giá các gói.
const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)
const num = (i: number) => String(i + 1).padStart(2, '0')
function jump(id: string) { document.getElementById('pj-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>

<template>
<section ref="root" class="w pg" id="p-san-pham">
  <div class="pgh">
    <div>
      <div class="k2">Sản phẩm và dịch vụ</div>
      <h1>Phần mềm cho doanh nghiệp, <span class="o">từ SaaS đến hệ thống riêng.</span></h1>
      <p class="lead">3RDVN Technology có sẵn nền tảng SaaS cho vận hành phân phối, đồng thời nhận thiết kế website, xây CRM/ERP và dựng máy chủ email theo đúng nhu cầu của bạn.</p>
      <div class="acts"><a class="btn or" href="#pj-list" @click.prevent="jump('list')">Xem các dự án</a><RouterLink class="btn gh" to="/baogia">Nhận báo giá</RouterLink></div></div>
    <Page3D id="san-pham" tint="#1BA6D9"><div class="ft" style="left:18px;top:18px"><b>{{ site.projects.length }} dòng sản phẩm</b><span>Một đội ngũ công nghệ</span></div><div class="ft" style="right:18px;bottom:18px"><b>Báo giá theo phạm vi</b><span>Rõ từng hạng mục</span></div></Page3D>
  </div>

  <div id="pj-list" class="ps"><div class="k2">Dự án hiện có</div><h2>Chúng tôi đang làm gì</h2>
    <div class="prjs" data-cms="product">
      <a v-for="(p, i) in site.projects" :key="p.id" class="cd prj" :href="'#pj-' + p.id" @click.prevent="jump(p.id)">
        <span class="pi"><Icon :name="p.icon" /></span>
        <span class="pn">{{ num(i) }}</span>
        <h3>{{ site.pick(p.name) }}</h3>
        <p>{{ site.pick(p.tag) }}</p>
        <span class="more">Xem chi tiết →</span>
      </a>
    </div></div>

  <template v-for="(p, i) in site.projects" :key="p.id">
    <div :id="'pj-' + p.id" class="ps pjd" data-cms="product">
      <div class="pjh">
        <span class="pi"><Icon :name="p.icon" /></span>
        <div><div class="k2">{{ num(i) }} / {{ site.pick(p.tag) }}</div><h2>{{ site.pick(p.name) }}</h2></div>
      </div>
      <div class="pjb">
        <div class="pjx"><h3>Là gì</h3><p>{{ site.pick(p.desc) }}</p>
          <div class="acts">
            <template v-if="p.id === 'saas'"><RouterLink class="btn or" :to="{ path: '/baogia', query: { dungthu: '1' } }">Đăng ký dùng thử</RouterLink><RouterLink class="btn gh" to="/baogia">Xem báo giá</RouterLink></template>
            <RouterLink v-else class="btn or" :to="{ path: '/baogia', query: { duan: p.id } }">Nhận báo giá</RouterLink>
          </div></div>
        <div class="cd pjc"><h3>Có gì</h3><ul class="ck"><li v-for="(it, k) in p.points" :key="k">{{ site.pick(it) }}</li></ul></div>
      </div>

      <template v-if="p.id === 'saas'">
        <div class="pjs"><h3>Toàn bộ module</h3>
          <div class="mods">
            <article v-for="m in site.modules" :key="m.id" class="cd mod">
              <span class="mcode">{{ site.pick(m.code) }}</span>
              <h3>{{ site.pick(m.title) }}</h3>
              <ul class="ck"><li v-for="(it, k) in m.items" :key="k">{{ site.pick(it) }}</li></ul>
            </article>
          </div></div>
        <div v-if="site.shots.length" class="pjs"><h3>Giao diện hệ thống</h3><HubGallery /></div>
        <div class="pjs"><h3>Thuê, self-host hay mua source</h3><CompareTable /></div>
        <div class="pjs"><h3>Các gói</h3><PlanCards link /></div>
      </template>
    </div>
  </template>

  <div class="ps"><div class="k2">Quy trình</div><h2>Triển khai trong sáu bước</h2>
    <ol class="steps6"><li><b>01</b><h3>Tư vấn</h3><p>Nghe nhu cầu, quy mô và cách đội của bạn đang vận hành.</p></li><li><b>02</b><h3>Thiết kế</h3><p>Chốt luồng nghiệp vụ, giao diện và phạm vi tính năng.</p></li><li><b>03</b><h3>Lập trình</h3><p>Frontend Vue.js, backend Go, kết nối đối tác.</p></li><li><b>04</b><h3>Kiểm thử</h3><p>Chạy thử trên môi trường test trước khi lên thật.</p></li><li><b>05</b><h3>Bàn giao</h3><p>Tài liệu bàn giao, hướng dẫn đội vận hành.</p></li><li><b>06</b><h3>Nâng cấp</h3><p>Bổ sung tính năng theo từng giai đoạn.</p></li></ol></div>

  <PageCta />
</section>
</template>
