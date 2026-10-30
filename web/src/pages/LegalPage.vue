<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { useSite } from '@/stores/site'
import { fillTokens, priceListMd, renderLegal } from '@/lib/markdown'
import { LEGAL_DOCS, legalPdf, type LegalKey } from '@/lib/content'

// Trang chính sách riêng (/dieu-khoan, /bao-mat, /chinh-sach-gia...): nội dung lấy từ CMS, chưa có thì dùng bản mặc định.
// Có nút tải PDF (tạo trên máy chủ từ đúng nội dung này) để nộp hồ sơ thông báo website với Bộ Công Thương.
const props = defineProps<{ doc: LegalKey }>()
const site = useSite()
const d = computed(() => site.legal(props.doc))
const prices = computed(() => priceListMd(site.quotePlans.map((p) => ({ name: site.pick(p.name), price: site.pick(p.price), unit: site.pick(p.unit), desc: site.pick(p.desc) })), site.lang === 'en'))
const html = computed(() => renderLegal(fillTokens(d.value.body.replace('{{price_list}}', prices.value), (k) => site.SL(k))))
const pdf = computed(() => legalPdf(props.doc, site.lang))
const others = computed(() => LEGAL_DOCS.filter((x) => x.key !== props.doc).map((x) => ({ ...x, title: site.legal(x.key).title })))
</script>

<template>
  <section class="w pg legalpg" :id="'p-' + doc">
    <article class="legal">
      <h1>{{ d.title }}</h1>
      <p class="lupd">{{ site.t('Cập nhật lần cuối') }}: {{ d.updated }}</p>
      <div class="lacts">
        <a class="btn or sm" :href="pdf" download><Icon name="download" />Tải PDF</a>
        <RouterLink class="btn gh sm" to="/chinh-sach">Tất cả chính sách</RouterLink>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="lbody" data-cms="legal" v-html="html" />
      <nav class="lother" aria-label="Chính sách khác">
        <h2>Chính sách khác</h2>
        <RouterLink v-for="o in others" :key="o.key" :to="'/' + o.slug"><Icon :name="o.icon" />{{ o.title }}</RouterLink>
      </nav>
    </article>
  </section>
</template>
