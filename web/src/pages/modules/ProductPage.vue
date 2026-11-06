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

// Biểu tượng từng module (đường nét 24x24) và tách mã "01 · ĐIỀU HÀNH" thành số lớn + nhãn.
const MOD_ICONS: Record<string, string> = {
  'dieu-hanh': 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  'san-pham': 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  'don': 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12h8M8 16h5',
  'nguon': 'M3 17l6-6 4 4 8-8M15 7h6v6',
  'mkt': 'M3 11v3l12 5V6zM15 8c3 .5 5 2 5 4s-2 3.5-5 4M7 15v4h3',
  'upl': 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5',
  'tai-chinh': 'M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M17 14h2',
  'nhan-su': 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1.5a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6',
  'he-thong': 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  def: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
}
const modCode = (m: { code: Parameters<typeof site.pick>[0] }) => site.pick(m.code).split('·').map((x) => x.trim())
const modNum = (m: { code: Parameters<typeof site.pick>[0] }) => modCode(m)[0]
const modTag = (m: { code: Parameters<typeof site.pick>[0] }) => modCode(m).slice(1).join(' · ')
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
        <span class="pi" :class="{ pl: p.logo }"><img v-if="p.logo" :src="p.logo" :alt="site.pick(p.name)" height="56" loading="lazy"><Icon v-else :name="p.icon" /></span>
        <span class="pn">{{ num(i) }}</span>
        <h3>{{ site.pick(p.name) }}</h3>
        <p>{{ site.pick(p.tag) }}</p>
        <span class="more">Xem chi tiết →</span>
      </a>
    </div></div>

  <template v-for="(p, i) in site.projects" :key="p.id">
    <div :id="'pj-' + p.id" class="ps pjd" data-cms="product">
      <div class="pjh">
        <span class="pi" :class="{ pl: p.logo }"><img v-if="p.logo" :src="p.logo" :alt="site.pick(p.name)" height="56" loading="lazy"><Icon v-else :name="p.icon" /></span>
        <div><div class="k2">{{ num(i) }} / {{ site.pick(p.tag) }}</div><h2>{{ site.pick(p.name) }}</h2></div>
      </div>
      <div class="pjb">
        <div class="pjx"><h3>Là gì</h3><p>{{ site.pick(p.desc) }}</p>
          <div class="acts">
            <template v-if="p.id === 'saas'"><RouterLink class="btn or" :to="{ path: '/baogia', query: { dungthu: '1' } }">Đăng ký dùng thử</RouterLink><RouterLink class="btn gh" to="/baogia">Xem báo giá</RouterLink></template>
            <a v-else-if="p.link" class="btn or" :href="p.link" target="_blank" rel="noopener">Truy cập website ↗</a>
            <RouterLink v-else class="btn or" :to="{ path: '/baogia', query: { duan: p.id } }">Nhận báo giá</RouterLink>
          </div></div>
        <div class="cd pjc"><h3>Có gì</h3><ul class="ck"><li v-for="(it, k) in p.points" :key="k">{{ site.pick(it) }}</li></ul></div>
      </div>

      <template v-if="p.id === 'saas'">
        <div class="pjs"><h3>Toàn bộ module</h3>
          <div class="mods">
            <article v-for="m in site.modules" :key="m.id" class="cd mod" :class="'t' + (site.modules.indexOf(m) % 3)">
              <span class="mnum" aria-hidden="true">{{ modNum(m) }}</span>
              <div class="mhead">
                <span class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="MOD_ICONS[m.id] || MOD_ICONS.def" /></svg></span>
                <span class="mcode">{{ modTag(m) }}</span>
              </div>
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
