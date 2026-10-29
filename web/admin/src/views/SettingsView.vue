<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../api'
import { useAdmin } from '../store'

const a = useAdmin()
type Field = { key: string; label: string; hint: string; type?: string; big?: boolean; wide?: boolean }
const company: Field[] = [
  { key: 'company_name', label: 'Tên công ty', hint: 'Dùng trong dòng bản quyền ở chân trang' },
  { key: 'company_name_en', label: 'Company name (English)', hint: 'Hiện khi khách chọn tiếng Anh. Để trống thì dùng bản mặc định' },
  { key: 'tax_id', label: 'Mã số thuế', hint: '' },
  { key: 'address', label: 'Địa chỉ', hint: 'Chưa điền thì chân trang không hiện dòng này' },
  { key: 'address_en', label: 'Address (English)', hint: 'Hiện khi khách chọn tiếng Anh. Để trống thì dùng bản mặc định' },
  { key: 'working_hours', label: 'Giờ làm việc (Tiếng Việt)', hint: 'Ví dụ: 8:30 - 17:30, Thứ 2 đến Thứ 6' },
  { key: 'working_hours_en', label: 'Working hours (English)', hint: 'Để trống thì dùng bản tiếng Việt' },
  { key: 'email', label: 'Email hỗ trợ', hint: 'Hiện ở chân trang, trang Liên hệ, nút Gửi email', type: 'email' },
  { key: 'hotline', label: 'Số hotline (hiển thị)', hint: 'Ví dụ: (+84) 398 192 414' },
  { key: 'hotline_tel', label: 'Số hotline (để bấm gọi)', hint: 'Chỉ gồm số, ví dụ: +84398192414' },
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
  { key: 'analytics_id', label: 'Mã Google Analytics', hint: 'Dạng G-XXXXXXXXXX. Để trống thì không theo dõi' },
  { key: 'meta_description', label: 'Mô tả website (meta description)', hint: 'Khoảng 120 đến 160 ký tự', big: true, wide: true },
]
const sections = [
  { title: 'Thông tin công ty', sub: 'Hiện ở chân trang và trang Liên hệ. Để trống để dùng giá trị mặc định (hiện mờ trong ô); mục Địa chỉ và Giờ làm việc để trống thì ẩn đi.', fields: company },
  { title: 'Liên kết và mạng xã hội', sub: 'Mạng xã hội chỉ hiện biểu tượng ở chân trang khi bạn điền link.', fields: links },
  { title: 'SEO và theo dõi', sub: 'Tiêu đề và mô tả được áp dụng khi trang tải xong (Google đọc được; Facebook, Zalo khi chia sẻ link vẫn dùng ảnh và mô tả mặc định). Favicon và ảnh chia sẻ thay trong thư mục web/public của mã nguồn.', fields: seo },
]

const scenes = [
  { id: 'classic', name: 'Cổ điển', desc: 'Các đảo trắng sáng với robot linh vật. Nhẹ máy, hợp cả sáng lẫn tối.' },
  { id: 'isometric', name: '3D đẳng cự (Isometric)', desc: 'Hòn đảo nổi nhìn góc isometric: mỗi module là một công trình, nối bằng đường dữ liệu có hạt chạy.' },
  { id: 'factory', name: 'Nhà máy tự động', desc: 'Băng chuyền đưa dữ liệu qua các trạm: cánh tay robot, máy dập, cổng quét, đèn trạng thái.' },
  { id: 'ecosystem', name: 'Hệ sinh thái số', desc: '3RDHub phát sáng ở giữa, Advertiser, Publisher, Tracking, Finance, API, AI bay quanh và trao đổi dữ liệu.' },
  { id: 'orbit', name: 'Trạm không gian (Orbit)', desc: 'Các trạm nổi giữa vũ trụ, hành tinh, sao và vệ tinh bay quanh. Nền tối, cảm giác công nghệ cao.' },
  { id: 'voxel', name: 'Thành phố khối (Voxel)', desc: 'Phong cách đồ chơi khối, nền trời ban ngày, màu tươi và dễ thương. Cảnh luôn sáng.' },
  { id: 'blueprint', name: 'Bản vẽ kỹ thuật (Blueprint)', desc: 'Nền xanh bản vẽ, các công trình dạng khung dây trong suốt, đường dữ liệu phát sáng.' },
  { id: 'neon', name: 'Thành phố Neon', desc: 'Đêm cyberpunk: toà nhà sáng đèn, hoàng hôn tím hồng, viền neon rực.' },
]
const sceneNow = () => a.content!.settings.scene_style || 'classic'
function pickScene(id: string) { if (id === 'classic') delete a.content!.settings.scene_style; else a.content!.settings.scene_style = id }
/** Trang công khai nằm ở tên miền gốc (bỏ tiền tố cms.). */
const siteBase = location.protocol + '//' + location.host.replace(/^cms\./, '')

function set(key: string, v: string) {
  const val = v.trim()
  if (val) a.content!.settings[key] = val
  else delete a.content!.settings[key]
}

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
  <div class="panel">
    <h2>Kiểu cảnh 3D</h2>
    <p class="sub">Chọn kiểu 3D cho trang chủ và các trang con. Mỗi trang con có cảnh riêng theo nội dung của trang. Bấm "Xem thử" để mở website với kiểu đó (chỉ trên trình duyệt của bạn, chưa ai khác thấy), ưng ý thì chọn rồi bấm Lưu.</p>
    <div class="scenes">
      <div v-for="sc in scenes" :key="sc.id" class="scene" :class="{ on: sceneNow() === sc.id }">
        <button type="button" class="pick" :aria-pressed="sceneNow() === sc.id" @click="pickScene(sc.id)">
          <img :src="'scenes/' + sc.id + '.jpg'" :alt="sc.name" loading="lazy" width="520" height="339">
          <b>{{ sc.name }}</b>
          <small>{{ sc.desc }}</small>
        </button>
        <a class="btn gh sm" :href="siteBase + '/?scene=' + sc.id" target="_blank" rel="noopener">Xem thử</a>
      </div>
    </div>
  </div>
  <div v-for="s in sections" :key="s.title" class="panel">
    <h2>{{ s.title }}</h2>
    <p class="sub">{{ s.sub }}</p>
    <div class="grid g2">
      <div v-for="f in s.fields" :key="f.key" :style="f.wide ? 'grid-column:1/-1' : undefined">
        <label class="f">{{ f.label }}
          <textarea v-if="f.big" rows="3" :placeholder="a.defaults!.settings[f.key] || ''" :value="a.content!.settings[f.key] || ''" @input="set(f.key, ($event.target as HTMLTextAreaElement).value)" />
          <input v-else :type="f.type || 'text'" :placeholder="a.defaults!.settings[f.key] || ''" :value="a.content!.settings[f.key] || ''" @input="set(f.key, ($event.target as HTMLInputElement).value)">
          <small>{{ f.hint }}</small>
        </label>
      </div>
    </div>
  </div>
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
