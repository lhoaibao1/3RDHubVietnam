<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { fmt } from '../store'

// Zalo OA (tin tư vấn miễn phí) cho khách của website, dùng chung OA với 3RDHub.
// Access token mượn từ 3RDHub; cấu hình (đường dẫn, khoá) nằm trong biến môi trường trên máy chủ, không nhập ở đây.
// Trang này không bao giờ thấy token hay khoá: máy chủ chỉ báo đã có hay chưa.
interface St {
  configured: boolean; public: boolean; webhook: boolean; poll: boolean; app_id: string; oa_id: string; oa_url: string
  token: { ok: boolean; oa_id: string; error: string; checked_at: number; expires_at?: number }
  last_event_at: number; linked: number; pending: number; confirm: string; confirm_default: string
}
interface Out { id: number; lead_id: number; name: string; text: string; status: 'pending' | 'sent' | 'failed'; tries: number; error: string; created: number; sent_at: number }
const st = ref<St | null>(null)
const outbox = ref<Out[]>([])
const confirmText = ref('')
const test = ref<{ code: string; expires_at: number; oa_url: string } | null>(null)
const busy = ref(false)
const msg = ref('')
const good = ref(false)
const say = (t: string, g = false) => { msg.value = t; good.value = g }
const hook = computed(() => location.origin.replace('//cms.', '//') + '/api/zalo/webhook')
const LBL: Record<Out['status'], string> = { pending: 'Đang chờ', sent: 'Đã gửi', failed: 'Lỗi' }

async function load() {
  try {
    st.value = await api<St>('GET', 'zalo-oa')
    confirmText.value = st.value.confirm
    outbox.value = await api<Out[]>('GET', 'zalo-oa/outbox')
  } catch (e) { say((e as Error).message) }
}
onMounted(load)

async function run<T>(fn: () => Promise<T>, done: string) {
  busy.value = true; say('')
  try { await fn(); say(done, true) } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
const check = () => run(async () => { st.value = await api<St>('POST', 'zalo-oa/check', {}) }, 'Lấy token từ 3RDHub thành công.')
const saveConfirm = () => run(async () => { st.value = await api<St>('PUT', 'zalo-oa', { confirm: confirmText.value }) }, 'Đã lưu tin xác nhận.')
const makeCode = () => run(async () => { test.value = await api('POST', 'zalo-oa/test-code', {}) }, 'Đã tạo yêu cầu thử. Làm theo các bước bên dưới.')
</script>

<template>
  <div class="panel">
    <h2>Zalo OA: tin cho khách (dùng chung OA với 3RDHub)</h2>
    <p class="sub">Sau khi gửi form, khách nhận một mã (dạng 3R-12345), bấm Quan tâm OA và nhắn mã đó. Website ghép tài khoản Zalo của khách với yêu cầu, trả lời xác nhận, và từ đó bạn gửi được tin cho khách ngay trong mục Yêu cầu khách. Tin tư vấn là miễn phí nhưng Zalo chỉ cho gửi khi khách vừa tương tác với OA (hiện là trong 7 ngày); tin quá hạn được giữ lại và tự gửi khi khách nhắn OA lần nữa.</p>
    <div v-if="st" class="zgrid">
      <div><span>Kết nối 3RDHub</span><b :class="st.configured ? 'okc' : 'badc'">{{ st.configured ? 'Đã cấu hình' : 'Chưa đặt biến môi trường' }}</b></div>
      <div><span>Access token</span><b :class="st.token.ok ? 'okc' : 'badc'">{{ st.token.ok ? 'Còn hạn tới ' + fmt(st.token.expires_at || 0) : st.token.error || 'Chưa lấy' }}</b></div>
      <div><span>Webhook</span><b :class="st.webhook ? 'okc' : 'badc'">{{ st.webhook ? (st.last_event_at ? 'Sự kiện gần nhất ' + fmt(st.last_event_at) : 'Đã có khoá, chưa nhận sự kiện') : 'Chưa đặt ZALO_WEBHOOK_SECRET' }}</b></div>
      <div><span>Đọc tin dự phòng</span><b>{{ st.poll ? 'Bật (45 giây/lần)' : 'Tắt' }}</b></div>
      <div><span>Hiện cho khách thật</span><b :class="st.public ? 'okc' : ''">{{ st.public ? 'Đang bật' : 'Chưa bật (chỉ thử trong CMS)' }}</b></div>
      <div><span>Khách đã ghép Zalo</span><b>{{ st.linked }}</b></div>
      <div><span>Tin đang chờ gửi</span><b>{{ st.pending }}</b></div>
      <div><span>OA</span><b><a :href="st.oa_url" target="_blank" rel="noopener">{{ st.oa_id }}</a></b></div>
    </div>
    <div class="bar" style="margin-top:12px">
      <button class="btn gh sm" type="button" :disabled="busy || !st?.configured" @click="check">Kiểm tra token</button>
      <button class="btn gh sm" type="button" :disabled="busy || !st?.configured" @click="makeCode">Tạo mã thử</button>
      <button class="btn gh sm" type="button" :disabled="busy" @click="load">Làm mới</button>
    </div>
    <div v-if="test" class="ztest">
      <div class="zcode">{{ test.code }}</div>
      <ol>
        <li>Mở <a :href="test.oa_url" target="_blank" rel="noopener">{{ test.oa_url }}</a> bằng tài khoản Zalo thử, bấm <b>Quan tâm</b>.</li>
        <li>Nhắn <b>{{ test.code }}</b> vào khung chat.</li>
        <li>Zalo thử sẽ nhận tin xác nhận. Bấm <b>Làm mới</b>: "Khách đã ghép Zalo" tăng lên; yêu cầu "Thử Zalo OA" trong mục Yêu cầu khách có nút gửi tin.</li>
      </ol>
      <small>Mã dùng được tới {{ fmt(test.expires_at) }}.</small>
    </div>
    <div v-if="msg" class="msg" :class="good ? 'ok' : 'err'" style="margin-top:12px">{{ msg }}</div>
  </div>

  <div class="panel">
    <h2>Tin xác nhận khi khách gửi mã</h2>
    <p class="sub">Dùng được: {code} mã, {name} tên khách, {need} nhu cầu. Tối đa 2.000 ký tự.</p>
    <textarea v-model="confirmText" rows="3" :placeholder="st?.confirm_default" style="width:100%" />
    <div class="bar" style="margin-top:10px">
      <button class="btn" type="button" :disabled="busy" @click="saveConfirm">Lưu tin xác nhận</button>
      <button class="btn gh sm" type="button" :disabled="busy" @click="confirmText = st?.confirm_default || ''">Dùng mẫu mặc định</button>
    </div>
  </div>

  <div class="panel">
    <h2>Tin Zalo OA đã gửi / đang chờ</h2>
    <div v-if="!outbox.length" class="empty">Chưa có tin nào.</div>
    <table v-else class="nlog"><tbody>
      <tr v-for="o in outbox" :key="o.id"><td>{{ fmt(o.created) }}</td><td><b>{{ o.name || '#' + o.lead_id }}</b></td><td>{{ o.text }}</td><td><span class="tag" :class="o.status === 'sent' ? 'ok' : o.status === 'failed' ? 'bad' : 'or'">{{ LBL[o.status] }}</span> <small v-if="o.error && o.status !== 'sent'">{{ o.error }}</small></td></tr>
    </tbody></table>
  </div>

  <div class="panel">
    <h2>Cài đặt trên máy chủ và ứng dụng Zalo</h2>
    <ol class="zsteps">
      <li>Trong <code>/etc/3rdhub-cms.env</code>: <code>ZALO_OA_TOKEN_URL</code>, <code>ZALO_OA_SHARE_KEY</code> (khoá tạo trong 3RDHub), <code>ZALO_WEBHOOK_SECRET</code> (OA Secret Key của ứng dụng Zalo), rồi khởi động lại dịch vụ.</li>
      <li>developers.zalo.me → ứng dụng {{ st?.app_id }} → Webhook: đặt URL <code>{{ hook }}</code>, bật sự kiện <b>user_send_text</b> và <b>follow</b>. Tên miền phải được xác thực trong ứng dụng (cách đơn giản nhất: bản ghi DNS TXT).</li>
      <li>Không đặt được webhook thì thêm <code>ZALO_POLL=1</code> để website tự đọc tin mới mỗi 45 giây.</li>
      <li>Thử xong với tài khoản Zalo thử mới thêm <code>ZALO_OA_PUBLIC=1</code> để khách thật thấy mã sau khi gửi form.</li>
    </ol>
  </div>
</template>
