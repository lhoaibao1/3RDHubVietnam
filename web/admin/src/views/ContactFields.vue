<script setup lang="ts">
import FieldsPanel from '../components/FieldsPanel.vue'
import type { Field } from '../types'

// Thông tin liên hệ hiện ở trang Liên hệ, chân trang và các nút gọi / gửi email.
const fields: Field[] = [
  { key: 'email', label: 'Email hỗ trợ', hint: 'Hiện ở chân trang, trang Liên hệ, nút Gửi email', type: 'email' },
  { key: 'hotline', label: 'Số hotline (hiển thị)', hint: 'Ví dụ: (+84) 398 192 414' },
  { key: 'hotline_tel', label: 'Số hotline (để bấm gọi)', hint: 'Chỉ gồm số, ví dụ: +84398192414' },
  { key: 'working_hours', label: 'Giờ làm việc (Tiếng Việt)', hint: 'Ví dụ: 8:30 - 17:30, Thứ 2 đến Thứ 6' },
  { key: 'working_hours_en', label: 'Working hours (English)', hint: 'Để trống thì dùng bản tiếng Việt' },
]
</script>

<template>
  <FieldsPanel title="Thông tin liên hệ" sub="Hiện ở trang Liên hệ và chân trang. Để trống để dùng giá trị mặc định (hiện mờ trong ô); giờ làm việc để trống thì ẩn." :fields="fields" />
</template>
