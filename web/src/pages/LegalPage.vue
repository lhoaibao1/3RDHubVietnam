<script setup lang="ts">
import { computed } from 'vue'
import { useSite } from '@/stores/site'
import { renderLegal } from '@/lib/markdown'

// Trang pháp lý riêng (/dieu-khoan, /bao-mat): nội dung lấy từ CMS, chưa có thì dùng bản mặc định.
const props = defineProps<{ doc: 'terms' | 'privacy' }>()
const site = useSite()
const d = computed(() => site.legal(props.doc))
const html = computed(() => renderLegal(d.value.body))
</script>

<template>
  <section class="w pg legalpg" :id="doc === 'terms' ? 'p-dieu-khoan' : 'p-bao-mat'">
    <article class="legal">
      <h1>{{ d.title }}</h1>
      <p class="lupd">{{ site.t('Cập nhật lần cuối') }}: {{ d.updated }}</p>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="lbody" v-html="html" />
    </article>
  </section>
</template>
