<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import CountUp from '@/components/CountUp.vue'
import Page3D from '@/components/Page3D.vue'
import PageCta from '@/components/PageCta.vue'
import { usePageFx } from '@/composables/usePageFx'
import { okUrl, type Partner } from '@/lib/content'
import { useSite } from '@/stores/site'

const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)

const partners = computed(() => site.partners)
const groups = computed(() => {
  const m = new Map<string, { label: Partner['group']; items: Partner[] }>()
  for (const p of partners.value) {
    if (!m.has(p.group.vi)) m.set(p.group.vi, { label: p.group, items: [] })
    m.get(p.group.vi)!.items.push(p)
  }
  return [...m.values()]
})
const nBank = computed(() => partners.value.filter((p) => /Ngân hàng/.test(p.group.vi)).length)
const nFin = computed(() => partners.value.filter((p) => p.group.vi === 'Công ty tài chính').length)
const nOther = computed(() => partners.value.length - nBank.value - nFin.value)
</script>

<template>
  <section ref="root" class="w pg" id="p-doi-tac">
    <div class="pgh">
      <div>
        <h1>Advertiser và <span class="o">đối tác đồng hành.</span></h1>
        <p class="lead">Các ngân hàng, công ty tài chính và mạng affiliate đang hợp tác cùng 3RDVN Technology.</p>
      </div>
      <Page3D id="doi-tac" tint="#12A06A">
        <div class="ft" style="left:18px;top:18px"><b>{{ site.t('{n} đối tác').replace('{n}', String(partners.length)) }}</b><span>Ngân hàng, tài chính, affiliate</span></div>
      </Page3D>
    </div>

    <div class="cnt ps0">
      <div><CountUp :n="partners.length" /><span>Đối tác đồng hành</span></div>
      <div><CountUp :n="nBank" /><span>Ngân hàng</span></div>
      <div><CountUp :n="nFin" /><span>Công ty tài chính</span></div>
      <div><CountUp :n="nOther" /><span>Đối tác chiến lược, affiliate</span></div>
    </div>

    <div class="ps">
      <div v-for="g in groups" :key="g.label.vi" class="pgrp">
        <h3>{{ site.pick(g.label) }}</h3>
        <div class="pg2">
          <a v-for="p in g.items" :key="p.name" :href="okUrl(p.url)" target="_blank" rel="noopener">
            <span class="lg"><img v-if="p.logo" :src="p.logo" alt=""></span><b>{{ p.name }}</b><small>{{ site.pick(p.group) }}</small>
          </a>
        </div>
      </div>
    </div>

    <div class="ps"><div class="k2">Sản phẩm</div><h2>Những sản phẩm đang có chiến dịch</h2>
      <div class="g4c">
        <article class="cd"><span class="ic"><Icon name="credit-card" /></span><h3>Thẻ tín dụng</h3><p>CPL, tính theo hồ sơ được duyệt.</p></article>
        <article class="cd"><span class="ic"><Icon name="hand-coins" /></span><h3>Vay tiêu dùng</h3><p>CPS, tính theo khoản vay.</p></article>
        <article class="cd"><span class="ic"><Icon name="shield-check" /></span><h3>Bảo hiểm sức khoẻ</h3><p>CPA, tính theo hợp đồng.</p></article>
        <article class="cd"><span class="ic"><Icon name="landmark" /></span><h3>Tài khoản số</h3><p>CPA, tính theo tài khoản mở mới.</p></article>
      </div>
    </div>

    <div class="ps"><div class="k2">Trở thành đối tác</div><h2>Bốn bước để kết nối</h2>
      <ol class="steps6 s4"><li><b>01</b><h3>Trao đổi</h3><p>Sản phẩm, đối tượng khách và hình thức hoa hồng.</p></li><li><b>02</b><h3>Cấu hình</h3><p>3RDHub tạo chiến dịch, link và mức hoa hồng.</p></li><li><b>03</b><h3>Kết nối thử</h3><p>Nối postback trên môi trường test, kiểm tra từng trạng thái.</p></li><li><b>04</b><h3>Chạy thật</h3><p>Mở chiến dịch cho publisher, đối soát định kỳ.</p></li></ol>
    </div>

    <PageCta />
  </section>
</template>
