<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { useSite } from '@/stores/site'
import { LEGAL_DOCS, legalPdf } from '@/lib/content'

// Trang tổng hợp các chính sách (/chinh-sach): xem từng trang, tải PDF từng chính sách hoặc tất cả trong một file.
const site = useSite()
const docs = computed(() => LEGAL_DOCS.map((x) => ({ ...x, ...site.legal(x.key), pdf: legalPdf(x.key, site.lang) })))
const all = computed(() => legalPdf('all', site.lang))
</script>

<template>
  <section class="w pg legalpg" id="p-chinh-sach">
    <div class="legal">
      <h1>Chính sách và điều khoản</h1>
      <p class="lupd">Các chính sách áp dụng khi sử dụng website và dịch vụ của <b>{{ site.SL('company_name') }}</b>. Mỗi chính sách có thể xem trực tiếp hoặc tải về dạng PDF.</p>
      <div class="lacts"><a class="btn or" :href="all" download><Icon name="download" />Tải tất cả (1 file PDF)</a></div>
      <ol class="polist" data-cms="legal">
        <li v-for="(p, i) in docs" :key="p.key" class="cd">
          <span class="pi"><Icon :name="p.icon" /></span>
          <div><b>{{ i + 1 }}. {{ p.title }}</b><small>{{ site.t('Cập nhật lần cuối') }}: {{ p.updated }}</small></div>
          <div class="pa"><RouterLink class="btn gh sm" :to="'/' + p.slug">Xem</RouterLink><a class="btn gh sm" :href="p.pdf" download><Icon name="download" />PDF</a></div>
        </li>
      </ol>
    </div>
  </section>
</template>
