<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../api'
import FieldsPanel from '../components/FieldsPanel.vue'
import type { Field } from '../types'

const company: Field[] = [
  { key: 'company_name', label: 'Tên công ty', hint: 'Dùng trong dòng bản quyền ở chân trang' },
  { key: 'company_name_en', label: 'Company name (English)', hint: 'Hiện khi khách chọn tiếng Anh. Để trống thì dùng bản mặc định' },
  { key: 'tax_id', label: 'Mã số thuế', hint: '' },
  { key: 'address', label: 'Địa chỉ', hint: 'Chưa điền thì chân trang không hiện dòng này' },
  { key: 'address_en', label: 'Address (English)', hint: 'Hiện khi khách chọn tiếng Anh. Để trống thì dùng bản mặc định' },
]
const links: Field[] = [
  { key: 'parent_url', label: 'Website công ty mẹ', hint: 'Chân trang và trang pháp lý có liên kết tới đây', type: 'url' },
  { key: 'signup_url', label: 'Link nút "Đăng ký ngay"', hint: 'Trang đăng ký trên app', type: 'url' },
  { key: 'facebook', label: 'Facebook', hint: 'https://facebook.com/...', type: 'url' },
  { key: 'zalo', label: 'Zalo', hint: 'https://zalo.me/...', type: 'url' },
  { key: 'tiktok', label: 'TikTok', hint: 'https://tiktok.com/@...', type: 'url' },
  { key: 'youtube', label: 'YouTube', hint: 'https://youtube.com/@...', type: 'url' },
  { key: 'instagram', label: 'Instagram', hint: 'https://instagram.com/...', type: 'url' },
]
const seo: Field[] = [
  { key: 'site_title', label: 'Tiêu đề website', hint: 'Hiện trên tab trình duyệt. Mặc định: 3RDHub Vietnam' },
  { key: 'analytics_id', label: 'Mã Google Analytics', hint: 'Dạng G-XXXXXXXXXX. Chỉ chạy khi khách đồng ý cookie phân tích. Để trống thì không theo dõi' },
  { key: 'meta_description', label: 'Mô tả website (meta description)', hint: 'Khoảng 120 đến 160 ký tự', big: true, wide: true },
]

const cur = ref('')
const nw = ref('')
const nw2 = ref('')
const msg = ref('')
const msgOk = ref(false)
const busy = ref(false)

async function changePassword() {
  msg.value = ''
  const say = (t: string, ok = false) => { msg.value = t; msgOk.value = ok }
  if (nw.value !== nw2.value) return say('Hai mật khẩu mới không giống nhau.')
  busy.value = true
  try {
    await api('POST', 'password', { current: cur.value, new: nw.value })
    say('Đã đổi mật khẩu.', true)
    cur.value = nw.value = nw2.value = ''
  } catch (e) {
    say((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <FieldsPanel title="Thông tin công ty" sub="Hiện ở chân trang và trang pháp lý. Để trống để dùng giá trị mặc định (hiện mờ trong ô); địa chỉ để trống thì ẩn." :fields="company" />
  <FieldsPanel title="Liên kết và mạng xã hội" sub="Mạng xã hội chỉ hiện biểu tượng ở chân trang khi bạn điền link." :fields="links" />
  <FieldsPanel title="SEO và theo dõi" sub="Tiêu đề và mô tả được áp dụng khi trang tải xong (Google đọc được; Facebook, Zalo khi chia sẻ link vẫn dùng ảnh và mô tả mặc định của từng trang)." :fields="seo" />
  <form class="panel" @submit.prevent="changePassword">
    <h2>Đổi mật khẩu quản trị</h2>
    <p class="sub">Tối thiểu 10 ký tự. Nên dùng mật khẩu dài và không dùng lại ở nơi khác.</p>
    <div class="grid g2"><label class="f">Mật khẩu hiện tại<input v-model="cur" type="password" autocomplete="current-password"></label><span /></div>
    <div class="grid g2" style="margin-top:12px">
      <label class="f">Mật khẩu mới<input v-model="nw" type="password" autocomplete="new-password"></label>
      <label class="f">Nhập lại mật khẩu mới<input v-model="nw2" type="password" autocomplete="new-password"></label>
    </div>
    <div style="margin-top:14px;display:grid;gap:10px">
      <div v-if="msg" class="msg" :class="msgOk ? 'ok' : 'err'">{{ msg }}</div>
      <div><button class="btn" type="submit" :disabled="busy">Đổi mật khẩu</button></div>
    </div>
  </form>
</template>
