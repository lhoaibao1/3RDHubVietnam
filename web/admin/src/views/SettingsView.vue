<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../api'
import FieldsPanel from '../components/FieldsPanel.vue'
import type { Field } from '../types'
import ContactFields from './ContactFields.vue'
import SeoPanel from './SeoPanel.vue'

// part: company = công ty, liên hệ, mạng xã hội; seo = SEO và theo dõi; account = mật khẩu
defineProps<{ part: 'company' | 'seo' | 'account' }>()

const company: Field[] = [
  { key: 'company_name', label: 'Tên công ty', hint: 'Dùng trong dòng bản quyền ở chân trang' },
  { key: 'company_name_en', label: 'Company name (English)', hint: 'Hiện khi khách chọn tiếng Anh. Để trống thì dùng bản mặc định' },
  { key: 'tax_id', label: 'Mã số thuế', hint: '' },
  { key: 'address', label: 'Địa chỉ', hint: 'Chưa điền thì chân trang không hiện dòng này' },
  { key: 'address_en', label: 'Address (English)', hint: 'Hiện khi khách chọn tiếng Anh. Để trống thì dùng bản mặc định' },
]
const links: Field[] = [
  { key: 'parent_url', label: 'Website công ty mẹ', hint: 'Chân trang và trang pháp lý có liên kết tới đây', type: 'url' },
  { key: 'demo_url', label: 'Link trang demo', hint: 'Nút "Xem demo" ở trang Sản phẩm và Báo giá', type: 'url' },
  { key: 'signup_url', label: 'Link nút "Đăng ký ngay"', hint: 'Trang đăng ký trên app', type: 'url' },
  { key: 'facebook', label: 'Facebook', hint: 'https://facebook.com/...', type: 'url' },
  { key: 'zalo', label: 'Zalo', hint: 'https://zalo.me/...', type: 'url' },
  { key: 'tiktok', label: 'TikTok', hint: 'https://tiktok.com/@...', type: 'url' },
  { key: 'youtube', label: 'YouTube', hint: 'https://youtube.com/@...', type: 'url' },
  { key: 'instagram', label: 'Instagram', hint: 'https://instagram.com/...', type: 'url' },
  { key: 'linkedin', label: 'LinkedIn', hint: 'https://linkedin.com/company/...', type: 'url' },
  { key: 'bct_url', label: 'Đường dẫn tra cứu Bộ Công Thương', hint: 'Logo "Đã thông báo Bộ Công Thương" ở chân trang liên kết tới đây (https://online.gov.vn/...). Để trống thì ẩn logo', type: 'url' },
  { key: 'dmca_id', label: 'Mã huy hiệu DMCA', hint: 'Phần sau ID= trong mã nhúng của DMCA.com, ví dụ 05128573-eeec-4272-ad2b-a37ecfee4803. Để trống thì ẩn huy hiệu' },
  { key: 'dmca_verify', label: 'Mã xác minh website DMCA', hint: 'Nội dung file dmca-validation.html (DMCA.com, Claim Site, cách 1). Bấm nút copy trên trang DMCA rồi dán vào đây' },
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
  <template v-if="part === 'company'">
    <FieldsPanel title="Thông tin công ty" sub="Hiện ở chân trang và trang pháp lý. Để trống để dùng giá trị mặc định (hiện mờ trong ô); địa chỉ để trống thì ẩn. Bản tiếng Anh để trống thì dùng bản mặc định." :fields="company" />
    <ContactFields />
    <FieldsPanel title="Liên kết và mạng xã hội" sub="Mạng xã hội chỉ hiện biểu tượng ở chân trang khi bạn điền link." :fields="links" />
  </template>
  <template v-if="part === 'seo'">
    <SeoPanel />
    <FieldsPanel title="Tên website và Google Analytics" sub="Tên website dùng cho tab trình duyệt khi khách xem bằng tiếng Anh. Mô tả website là mô tả mặc định của trang chủ (ô mô tả trang chủ ở trên được ưu tiên hơn)." :fields="seo" />
  </template>
  <form v-if="part === 'account'" class="panel" @submit.prevent="changePassword">
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
