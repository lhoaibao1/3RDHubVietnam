<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { useAdmin } from '../store'

// Cấu hình gửi email (SMTP). Lưu riêng, không đi kèm nội dung website; mật khẩu được mã hoá trên máy chủ và không bao giờ hiện lại.
const a = useAdmin()
const f = reactive({ host: '', port: 465, security: 'ssl', user: '', from_email: '', from_name: '', notify_to: '', notify_leads: false, password: '' })
const hasPass = ref(false)
const busy = ref(false)
const testTo = ref('')
const msg = ref('')
const ok = ref(false)

interface Resp { smtp: Omit<typeof f, 'password'>; has_password: boolean }
function fill(r: Resp) { Object.assign(f, r.smtp, { password: '' }); hasPass.value = r.has_password }
const say = (t: string, good = false) => { msg.value = t; ok.value = good }

onMounted(async () => {
  try { fill(await api<Resp>('GET', 'smtp')) } catch (e) { say((e as Error).message) }
})

function preset(kind: 'ssl' | 'starttls') { f.security = kind; f.port = kind === 'ssl' ? 465 : 587 }

async function save() {
  busy.value = true; say('')
  try {
    const r = await api<Resp>('PUT', 'smtp', { ...f })
    fill(r)
    say('Đã lưu cấu hình email.', true)
  } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
async function clearPass() {
  if (!confirm('Xoá mật khẩu SMTP đã lưu?')) return
  busy.value = true
  try { fill(await api<Resp>('PUT', 'smtp', { ...f, clear_password: true })); say('Đã xoá mật khẩu.', true) } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
async function test() {
  busy.value = true; say('Đang gửi thử…', true)
  try {
    await api('POST', 'smtp-test', { to: testTo.value.trim() })
    say('Đã gửi thư thử. Kiểm tra hộp thư của ' + testTo.value.trim() + ' (cả mục Spam).', true)
  } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
void a
</script>

<template>
  <form class="panel" @submit.prevent="save">
    <h2>Máy chủ gửi thư (SMTP)</h2>
    <p class="sub">Dùng để website gửi email (ví dụ báo cho bạn khi có yêu cầu mới). Hiện đã tích hợp sẵn; bạn nhập mật khẩu hộp thư <b>hello@3rdhubvietnam.tech</b> rồi gửi thử để kiểm tra.</p>
    <div class="grid g2">
      <label class="f">Máy chủ SMTP<input v-model="f.host" type="text" autocomplete="off"><small>Theo thông tin iNET: mail.3rdhubvietnam.tech</small></label>
      <label class="f">Cổng<input v-model.number="f.port" type="number" min="1" max="65535"><small>465 (SSL) hoặc 587 (STARTTLS)</small></label>
      <label class="f">Kiểu bảo mật
        <select v-model="f.security"><option value="ssl">SSL/TLS (cổng 465)</option><option value="starttls">STARTTLS (cổng 587)</option><option value="none">Không mã hoá (chỉ để thử nội bộ)</option></select>
        <small><button type="button" class="btn gh sm" @click="preset('ssl')">Dùng 465 SSL</button> <button type="button" class="btn gh sm" @click="preset('starttls')">Dùng 587 STARTTLS</button></small>
      </label>
      <label class="f">Tài khoản đăng nhập<input v-model="f.user" type="text" autocomplete="off"><small>Thường là địa chỉ email đầy đủ</small></label>
      <label class="f">Mật khẩu<input v-model="f.password" type="password" autocomplete="new-password" :placeholder="hasPass ? 'Đã lưu (mã hoá). Để trống để giữ nguyên' : 'Nhập mật khẩu hộp thư'"><small>Chỉ nhập mật khẩu của hộp thư gửi thư. Không dùng mật khẩu quản trị tên miền.</small></label>
      <label class="f">Email người gửi<input v-model="f.from_email" type="email"></label>
      <label class="f">Tên người gửi<input v-model="f.from_name" type="text"></label>
      <label class="f">Email nhận thông báo<input v-model="f.notify_to" type="email"><small>Để trống thì gửi về email người gửi</small></label>
    </div>
    <label style="display:flex;gap:10px;align-items:center;margin-top:14px;font-weight:800"><input v-model="f.notify_leads" type="checkbox">Gửi email báo cho tôi khi có yêu cầu mới từ website</label>
    <div class="bar" style="margin-top:16px">
      <button class="btn" type="submit" :disabled="busy">Lưu cấu hình</button>
      <button v-if="hasPass" class="btn gh" type="button" :disabled="busy" @click="clearPass">Xoá mật khẩu đã lưu</button>
      <span class="sub" style="margin:0">{{ hasPass ? 'Mật khẩu: đã lưu' : 'Mật khẩu: chưa có' }}</span>
    </div>
    <div v-if="msg" class="msg" :class="ok ? 'ok' : 'err'" style="margin-top:12px">{{ msg }}</div>
  </form>
  <div class="panel">
    <h2>Gửi thử</h2>
    <p class="sub">Gửi một thư thử bằng cấu hình đã lưu để chắc chắn hoạt động.</p>
    <div class="bar">
      <input v-model="testTo" type="email" class="grow" placeholder="Email nhận thư thử, ví dụ ban@gmail.com" aria-label="Email nhận thư thử">
      <button class="btn" type="button" :disabled="busy || !testTo" @click="test">Gửi thử</button>
    </div>
  </div>
</template>
