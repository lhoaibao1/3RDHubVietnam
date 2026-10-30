<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { consent, saveConsent } from '@/composables/useConsent'

// Thông báo cookie: hiện lần đầu (chậm một chút cho khỏi che nội dung), nhớ lựa chọn; Google Analytics chỉ được tải khi khách đồng ý.
const ready = ref(false)
const analytics = ref(consent.saved?.analytics ?? false)
onMounted(() => { setTimeout(() => { ready.value = true }, 1200) })
</script>

<template>
  <Transition name="cbar">
    <section v-if="consent.open && ready" class="cbar" role="dialog" aria-label="Thông báo cookie">
      <div class="cbm">
        <h2>Website này dùng cookie</h2>
        <p>Chúng tôi dùng bộ nhớ trình duyệt để ghi nhớ ngôn ngữ và giao diện sáng/tối. Cookie phân tích (nếu có) chỉ bật khi bạn đồng ý, giúp chúng tôi hiểu cách website được dùng để cải thiện.
          <RouterLink to="/bao-mat">Xem chính sách bảo mật</RouterLink></p>
        <div v-if="consent.detail" class="cbd">
          <label class="cbr"><input type="checkbox" checked disabled><span><b>Cần thiết</b><small>Ghi nhớ ngôn ngữ, giao diện, lưu đệm nội dung. Luôn bật.</small></span></label>
          <label class="cbr"><input v-model="analytics" type="checkbox"><span><b>Phân tích</b><small>Thống kê lượt truy cập dạng tổng hợp (Google Analytics).</small></span></label>
        </div>
      </div>
      <div class="cba">
        <button v-if="!consent.detail" type="button" class="btn gh" @click="consent.detail = true">Tuỳ chọn</button>
        <button v-else type="button" class="btn gh" @click="saveConsent(analytics)">Lưu lựa chọn</button>
        <button type="button" class="btn gh" @click="saveConsent(false)">Chỉ cần thiết</button>
        <button type="button" class="btn or" @click="saveConsent(true)">Chấp nhận tất cả</button>
      </div>
    </section>
  </Transition>
</template>
