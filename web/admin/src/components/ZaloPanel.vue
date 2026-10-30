<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { fmt } from '../store'

// Báo tin qua Zalo: Zalo Bot nhắn cho đội ngũ khi có người đăng ký; Zalo OA (ZNS) gửi tin tới số điện thoại của khách.
// Khoá bí mật chỉ nhập, được mã hoá trên máy chủ và không bao giờ hiện lại.
interface Z { bot_on: boolean; bot_chats: string; has_bot_token: boolean; zns_on: boolean; app_id: string; template_id: string; params: string; has_secret: boolean; has_refresh: boolean }
const z = reactive<Z>({ bot_on: false, bot_chats: '', has_bot_token: false, zns_on: false, app_id: '', template_id: '', params: '', has_secret: false, has_refresh: false })
const sec = reactive({ bot_token: '', secret: '', refresh_token: '' })
const chats = ref<{ id: string; name: string }[]>([])
const testPhone = ref('')
const busy = ref(false)
const msg = ref('')
const good = ref(false)
const logs = ref<{ ts: number; channel: string; to: string; ok: boolean; err?: string }[]>([])
const say = (t: string, g = false) => { msg.value = t; good.value = g }
const SAMPLE = '{\n  "customer_name": "{name}",\n  "phone_number": "{phone}",\n  "request": "{need}",\n  "date": "{date}"\n}'

async function load() {
  try { Object.assign(z, await api<Z>('GET', 'zalo')); logs.value = await api('GET', 'notify-log') } catch (e) { say((e as Error).message) }
}
onMounted(load)

async function save(extra: Record<string, unknown> = {}) {
  busy.value = true; say('')
  try {
    Object.assign(z, await api<Z>('PUT', 'zalo', { ...z, ...sec, ...extra }))
    sec.bot_token = sec.secret = sec.refresh_token = ''
    say('Đã lưu cấu hình Zalo.', true)
  } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
async function run(path: string, body: object, done: string) {
  busy.value = true; say('Đang gửi…', true)
  try { await api('POST', path, body); say(done, true) } catch (e) { say((e as Error).message) } finally { busy.value = false; load() }
}
async function findChats() {
  busy.value = true; say('')
  try {
    const r = await api<{ chats: { id: string; name: string }[] | null }>('POST', 'zalo-bot-chats', {})
    chats.value = r.chats || []
    say(chats.value.length ? 'Bấm vào một người để thêm vào danh sách nhận tin.' : 'Chưa thấy ai nhắn bot. Mở Zalo, nhắn một tin bất kỳ cho bot rồi bấm lại.', !!chats.value.length)
  } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
function addChat(id: string) {
  const list = z.bot_chats.split(/[,\s]+/).filter(Boolean)
  if (!list.includes(id)) list.push(id)
  z.bot_chats = list.join(', ')
}
</script>

<template>
  <div class="panel">
    <h2>Zalo Bot: báo cho đội ngũ</h2>
    <p class="sub">Khi có người đăng ký, bot nhắn vào Zalo của bạn (hoặc nhóm). Tạo bot tại <a href="https://bot.zaloplatforms.com" target="_blank" rel="noopener">bot.zaloplatforms.com</a>, dán token vào đây, nhắn cho bot một tin rồi bấm "Tìm người đã nhắn bot".</p>
    <div class="grid g2">
      <label class="f">Token của bot<input v-model="sec.bot_token" type="password" autocomplete="off" :placeholder="z.has_bot_token ? 'Đã lưu (mã hoá). Để trống để giữ nguyên' : 'Dạng 1234567890:AbCd...'"></label>
      <label class="f">Chat ID nhận tin<input v-model="z.bot_chats" type="text" placeholder="Nhiều ID cách nhau bởi dấu phẩy"></label>
    </div>
    <div class="bar" style="margin-top:12px">
      <label style="display:flex;gap:8px;align-items:center;font-weight:800"><input v-model="z.bot_on" type="checkbox">Bật báo tin qua Zalo Bot</label>
      <button class="btn gh sm" type="button" :disabled="busy || !z.has_bot_token" @click="findChats">Tìm người đã nhắn bot</button>
      <button class="btn gh sm" type="button" :disabled="busy || !z.has_bot_token" @click="run('zalo-bot-test', {}, 'Đã gửi tin thử qua Zalo Bot.')">Gửi tin thử</button>
    </div>
    <div v-if="chats.length" class="chips" style="margin-top:10px">
      <button v-for="c in chats" :key="c.id" type="button" @click="addChat(c.id)">+ {{ c.name || 'Không tên' }} ({{ c.id }})</button>
    </div>
  </div>

  <div class="panel">
    <h2>Zalo OA (ZNS): báo cho khách đăng ký</h2>
    <p class="sub">Gửi tin Zalo tới số điện thoại khách vừa đăng ký, theo mẫu ZNS đã được Zalo duyệt. Cần Zalo OA đã xác thực, ứng dụng trên <a href="https://developers.zalo.me" target="_blank" rel="noopener">developers.zalo.me</a> liên kết OA, mẫu ZNS đã duyệt và ví ZNS còn tiền (Zalo tính phí mỗi tin).</p>
    <div class="grid g2">
      <label class="f">App ID<input v-model="z.app_id" type="text" inputmode="numeric"></label>
      <label class="f">Secret key của ứng dụng<input v-model="sec.secret" type="password" autocomplete="off" :placeholder="z.has_secret ? 'Đã lưu (mã hoá)' : ''"></label>
      <label class="f">Refresh token của OA<input v-model="sec.refresh_token" type="password" autocomplete="off" :placeholder="z.has_refresh ? 'Đã lưu (mã hoá), hệ thống tự làm mới' : 'Lấy khi cấp quyền OA cho ứng dụng'"><small>Hệ thống tự đổi lấy access token và tự lưu refresh token mới. Nếu ngừng dùng quá 3 tháng thì phải lấy lại.</small></label>
      <label class="f">Template ID (mẫu ZNS đã duyệt)<input v-model="z.template_id" type="text"></label>
      <label class="f" style="grid-column:1/-1">Tham số của mẫu (JSON)
        <textarea v-model="z.params" rows="6" :placeholder="SAMPLE" style="font-family:ui-monospace,monospace" />
        <small>Tên tham số lấy đúng như trong mẫu ZNS. Giá trị có thể dùng: {name} tên, {phone} số điện thoại, {email}, {company} công ty, {need} nhu cầu, {message} nội dung, {date} ngày, {id} mã yêu cầu.</small>
      </label>
    </div>
    <div class="bar" style="margin-top:12px">
      <label style="display:flex;gap:8px;align-items:center;font-weight:800"><input v-model="z.zns_on" type="checkbox">Bật gửi ZNS cho khách đăng ký</label>
      <input v-model="testPhone" type="tel" placeholder="Số nhận thử, ví dụ 0901234567" style="max-width:240px">
      <button class="btn gh sm" type="button" :disabled="busy || !testPhone" @click="run('zns-test', { phone: testPhone }, 'Đã gửi tin ZNS thử.')">Gửi ZNS thử</button>
    </div>
  </div>

  <div class="panel">
    <div class="bar" style="margin:0">
      <button class="btn" type="button" :disabled="busy" @click="save()">Lưu cấu hình Zalo</button>
      <button v-if="z.has_bot_token" class="btn gh sm" type="button" :disabled="busy" @click="save({ clear_bot_token: true })">Xoá token bot</button>
      <button v-if="z.has_secret || z.has_refresh" class="btn gh sm" type="button" :disabled="busy" @click="save({ clear_oa: true })">Xoá khoá Zalo OA</button>
    </div>
    <div v-if="msg" class="msg" :class="good ? 'ok' : 'err'" style="margin-top:12px">{{ msg }}</div>
  </div>

  <div class="panel">
    <h2>Nhật ký gửi thông báo</h2>
    <p class="sub">40 lần gửi gần nhất (email, Zalo Bot, ZNS) khi có người đăng ký.</p>
    <div v-if="!logs.length" class="empty">Chưa có lần gửi nào.</div>
    <table v-else class="nlog"><tbody>
      <tr v-for="(l, i) in logs" :key="i"><td>{{ fmt(l.ts) }}</td><td><b>{{ l.channel }}</b></td><td>{{ l.to }}</td><td><span class="tag" :class="l.ok ? 'ok' : 'bad'">{{ l.ok ? 'Đã gửi' : 'Lỗi' }}</span> <small v-if="l.err">{{ l.err }}</small></td></tr>
    </tbody></table>
  </div>
</template>
