<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { TabKey } from '../types'
import TextView from './TextView.vue'
import FaqView from './FaqView.vue'
import PartnersView from './PartnersView.vue'
import ContactFields from './ContactFields.vue'
import QuoteView from './QuoteView.vue'

// Một tab của một trang website: phần dữ liệu riêng của trang (nếu có) và chữ của chính trang đó.
const props = defineProps<{ tab: TabKey }>()
const HOME = ['Trang chủ · Đầu trang (cảnh 3D)', 'Trang chủ · Sản phẩm', 'Trang chủ · Công nghệ', 'Trang chủ · Đối tác', 'Trang chủ · Hỏi đáp', 'Trang chủ · Liên hệ']
const CFG: Record<string, { groups: string[]; before?: Component; hint: string }> = {
  home: { groups: HOME, hint: 'Chữ ở từng khu vực của trang chủ, từ đầu trang đến cuối trang.' },
  model: { groups: ['Trang Mô hình'], hint: 'Chữ của trang Mô hình: vai trò các bên, hành trình hồ sơ, hình thức hoa hồng, trạng thái đơn.' },
  advertiser: { groups: ['Trang Advertiser'], hint: 'Chữ của trang Advertiser: đưa chiến dịch lên mạng lưới publisher, hình thức hoa hồng, quy trình.' },
  product: { groups: ['Trang Sản phẩm'], hint: 'Chữ của trang Sản phẩm: hệ thống affiliate riêng, bản quyền 3RDHub, ba tầng hệ thống, sáu bước triển khai.' },
  quote: { groups: ['Trang Báo giá'], before: QuoteView, hint: 'Chữ của trang Báo giá (các gói và giá sửa ở phần trên). Trang này mở từ nút "Xem báo giá" ở trang Sản phẩm, không nằm trên menu.' },
  tech: { groups: ['Trang Công nghệ'], hint: 'Chữ của trang Công nghệ: stack, luồng tracking, postback, an toàn.' },
  partners: { groups: ['Trang Đối tác'], before: PartnersView, hint: 'Chữ của trang Đối tác (logo và danh sách đối tác sửa ở phần trên).' },
  faq: { groups: ['Trang Hỏi đáp'], before: FaqView, hint: 'Chữ của trang Hỏi đáp (câu hỏi và trả lời sửa ở phần trên).' },
  contact: { groups: ['Trang Liên hệ'], before: ContactFields, hint: 'Chữ của trang Liên hệ và biểu mẫu gửi yêu cầu.' },
  chrome: { groups: ['Menu và chân trang', 'Thông báo, nút và nhãn khác'], hint: 'Menu, chân trang, thông báo cookie và các nút, nhãn dùng chung toàn website.' },
}
const cfg = computed(() => CFG[props.tab])
</script>

<template>
  <component :is="cfg.before" v-if="cfg.before" />
  <div class="panel" style="margin-top:16px">
    <h2>Chữ trên trang</h2>
    <p class="sub" style="margin:0">{{ cfg.hint }}</p>
    <p class="sub" style="margin:8px 0 0"><b>Chỉ cần viết tiếng Việt.</b> Khi bấm Lưu, hệ thống tự dịch sang English cho những đoạn chưa có bản English hoặc có bản đang do máy dịch. Bạn tự sửa ô English thì hệ thống giữ nguyên bản của bạn.</p>
  </div>
  <TextView :groups="cfg.groups" />
</template>
