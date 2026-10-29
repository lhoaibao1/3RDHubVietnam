<script setup lang="ts">
import { computed } from 'vue'
import BrandIcon from './BrandIcon.vue'
import { useSite } from '@/stores/site'
import AnimDetails from './AnimDetails.vue'

const site = useSite()
const items = computed(() => site.faqItems.filter((f) => f.home))
</script>

<template>
  <section class="w faq" id="faq">
    <div class="fqw">
      <div class="fqi">
        <div class="k2">Hỏi đáp</div>
        <h2>Câu hỏi thường gặp</h2>
        <p>Chưa thấy câu trả lời bạn cần? Gọi hotline hoặc gửi email, đội ngũ 3RDVN Technology phản hồi trong giờ làm việc.</p>
        <RouterLink class="more" to="/hoi-dap">Xem chi tiết →</RouterLink>
        <div class="fqc"><BrandIcon /><div><small>Hotline</small><b>{{ site.S('hotline') }}</b></div></div>
      </div>
      <div class="fq">
        <AnimDetails v-for="(f, i) in items" :key="f.id" :summary="site.pick(f.q)" :text="site.pick(f.a)" :open="i === 0" />
      </div>
    </div>
  </section>
</template>
