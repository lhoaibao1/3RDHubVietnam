<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { fmt } from '../store'

// Zalo OA (tin tư vấn miễn phí) cho khách của website. Tự kết nối với ứng dụng Zalo của bạn (OAuth), không qua 3RDHub.
// Khoá và token được máy chủ mã hoá và không bao giờ gửi lại về trình duyệt: trang này chỉ biết "đã có" hay "chưa có".
interface St {
  configured: boolean; legacy?: boolean; own: { app_id: string; has_secret: boolean; has_oa_secret: boolean; connected: boolean; oa_id: string; connected_at: number; public: boolean; callback_url: string; webhook_url: string }
  public: boolean; webhook: boolean; poll: boolean; app_id: string; oa_id: string; oa_url: string
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
const form = reactive({ app_id: '', app_secret: '', oa_secret: '', public: false })
const site = location.origin.replace('//cms.', '//')
const cb = computed(() => st.value?.own.callback_url || site + '/api/zalo/callback')
const hook = computed(() => st.value?.own.webhook_url || site + '/api/zalo/webhook')
const domain = location.host.replace(/^cms\./, '')
const copied = ref('')
async function copy(t: string) { try { await navigator.clipboard.writeText(t); copied.value = t; setTimeout(() => { copied.value = '' }, 1500) } catch { /* bỏ qua */ } }
const LBL: Record<Out['status'], string> = { pending: 'Đang chờ', sent: 'Đã gửi', failed: 'Lỗi' }

async function load() {
  try {
    st.value = await api<St>('GET', 'zalo-oa')
    confirmText.value = st.value.confirm
    form.app_id = st.value.own.app_id || st.value.app_id || ''; form.public = st.value.own.public; form.app_secret = ''; form.oa_secret = ''
    outbox.value = await api<Out[]>('GET', 'zalo-oa/outbox')
  } catch (e) { say((e as Error).message) }
}
onMounted(load)

async function run<T>(fn: () => Promise<T>, done: string) {
  busy.value = true; say('')
  try { await fn(); say(done, true) } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
const check = () => run(async () => { st.value = await api<St>('POST', 'zalo-oa/check', {}) }, 'Token Zalo OA hoạt động bình thường.')
const saveApp = () => run(async () => { st.value = await api<St>('PUT', 'zalo-oa/app', { ...form }); form.app_secret = ''; form.oa_secret = '' }, 'Đã lưu. Khoá được mã hoá trên máy chủ và không hiện lại.')
const connect = () => run(async () => { const r = await api<{ url: string }>('POST', 'zalo-oa/connect', {}); location.href = r.url }, 'Đang chuyển sang Zalo…')
const disconnect = () => { if (confirm('Ngắt kết nối Zalo OA? Tin tư vấn sẽ không gửi được cho tới khi kết nối lại.')) run(async () => { st.value = await api<St>('POST', 'zalo-oa/disconnect', {}) }, 'Đã ngắt kết nối.') }
const saveConfirm = () => run(async () => { st.value = await api<St>('PUT', 'zalo-oa', { confirm: confirmText.value }) }, 'Đã lưu tin xác nhận.')
const makeCode = () => run(async () => { test.value = await api('POST', 'zalo-oa/test-code', {}) }, 'Đã tạo yêu cầu thử. Làm theo các bước bên dưới.')
</script>

<template>
  <div class="panel">
    <h2>Zalo OA: tin cho khách</h2>
    <p class="sub">Sau khi gửi form, khách nhận một mã (dạng 3R-12345), bấm Quan tâm OA và nhắn mã đó. Website ghép tài khoản Zalo của khách với yêu cầu, trả lời xác nhận, và từ đó bạn gửi được tin cho khách ngay trong mục Yêu cầu khách. Tin tư vấn miễn phí nhưng Zalo chỉ cho gửi khi khách vừa tương tác với OA (hiện là trong 7 ngày); tin quá hạn được giữ lại và tự gửi khi khách nhắn OA lần nữa.</p>
    <div v-if="st" class="zgrid">
      <div><span>Kết nối Zalo OA</span><b :class="st.own.connected ? 'okc' : 'badc'">{{ st.own.connected ? 'Đã kết nối' + (st.own.connected_at ? ' ' + fmt(st.own.connected_at) : '') : st.legacy ? 'Đang dùng token mượn từ 3RDHub (cách cũ)' : 'Chưa kết nối' }}</b></div>
      <div><span>Access token</span><b :class="st.token.ok ? 'okc' : 'badc'">{{ st.token.ok ? 'Còn hạn tới ' + fmt(st.token.expires_at || 0) + ' (tự làm mới)' : st.token.error || 'Chưa lấy' }}</b></div>
      <div><span>Webhook</span><b :class="st.webhook ? 'okc' : 'badc'">{{ st.webhook ? (st.last_event_at ? 'Sự kiện gần nhất ' + fmt(st.last_event_at) : 'Đã có khoá, chưa nhận sự kiện') : 'Chưa nhập OA Secret Key' }}</b></div>
      <div><span>Hiện cho khách thật</span><b :class="st.public ? 'okc' : ''">{{ st.public ? 'Đang bật' : 'Chưa bật (chỉ thử trong CMS)' }}</b></div>
      <div><span>Khách đã ghép Zalo</span><b>{{ st.linked }}</b></div>
      <div><span>Tin đang chờ gửi</span><b>{{ st.pending }}</b></div>
      <div><span>OA</span><b><a v-if="st.oa_id" :href="st.oa_url" target="_blank" rel="noopener">{{ st.oa_id }}</a><template v-else>Chưa có</template></b></div>
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

  <div v-if="st" class="panel">
    <h2>Kết nối ứng dụng Zalo của bạn</h2>
    <p class="sub">Dán thông tin ứng dụng Zalo (xem hướng dẫn bên dưới), bấm Lưu, rồi bấm Kết nối và đăng nhập Zalo bằng tài khoản quản trị OA. Khoá được mã hoá trên máy chủ, không hiện lại sau khi lưu.</p>
    <div class="zform">
      <label class="f">App ID<input v-model="form.app_id" type="text" inputmode="numeric" placeholder="vd. 3689777608400566243" spellcheck="false"></label>
      <label class="f">App Secret (khoá bí mật của ứng dụng)<input v-model="form.app_secret" type="password" autocomplete="off" :placeholder="st.own.has_secret ? '•••••••• đã lưu, để trống nếu giữ nguyên' : 'Dán khoá bí mật'"></label>
      <label class="f">OA Secret Key (ký webhook)<input v-model="form.oa_secret" type="password" autocomplete="off" :placeholder="st.own.has_oa_secret ? '•••••••• đã lưu, để trống nếu giữ nguyên' : 'Dán OA Secret Key'"></label>
    </div>
    <label class="zsw"><input v-model="form.public" type="checkbox"> <span><b>Hiện mã Zalo cho khách thật</b> sau khi họ gửi form. Chỉ bật sau khi đã thử xong với tài khoản Zalo của bạn.</span></label>
    <div class="bar" style="margin-top:12px">
      <button class="btn" type="button" :disabled="busy || !form.app_id" @click="saveApp">Lưu</button>
      <button class="btn or" type="button" :disabled="busy || !st.own.app_id || !st.own.has_secret" @click="connect">{{ st.own.connected ? 'Kết nối lại' : 'Kết nối Zalo OA' }}</button>
      <button v-if="st.own.connected" class="btn gh sm" type="button" :disabled="busy" @click="disconnect">Ngắt kết nối</button>
    </div>
    <div class="zurls">
      <div><span>Callback URL (dán vào Zalo)</span><code>{{ cb }}</code><button type="button" class="btn gh sm" @click="copy(cb)">{{ copied === cb ? 'Đã chép' : 'Chép' }}</button></div>
      <div><span>Webhook URL (dán vào Zalo)</span><code>{{ hook }}</code><button type="button" class="btn gh sm" @click="copy(hook)">{{ copied === hook ? 'Đã chép' : 'Chép' }}</button></div>
      <div><span>Tên miền cần xác thực</span><code>{{ domain }}</code><button type="button" class="btn gh sm" @click="copy(domain)">{{ copied === domain ? 'Đã chép' : 'Chép' }}</button></div>
    </div>
  </div>

  <div class="panel">
    <h2>Hướng dẫn từng bước</h2>
    <p class="sub">Làm một lần, khoảng 15 phút. Tên menu trên developers.zalo.me có thể khác đôi chút tuỳ lúc Zalo đổi giao diện; nếu không thấy mục nào, tìm mục có tên gần giống.</p>
    <ol class="zsteps">
      <li><b>Có Official Account (OA).</b> OA phải đang hoạt động. Tài khoản Zalo bạn dùng ở các bước sau phải là <b>quản trị viên của OA</b>.</li>
      <li><b>Tạo ứng dụng.</b> Vào <a href="https://developers.zalo.me/apps" target="_blank" rel="noopener">developers.zalo.me/apps</a>, đăng nhập bằng Zalo, bấm <b>Tạo ứng dụng</b>, đặt tên (vd. "3RDHub Vietnam Website") và chọn danh mục. Đã có ứng dụng sẵn thì dùng luôn.</li>
      <li><b>Lấy App ID và App Secret.</b> Mở ứng dụng, ở trang <b>Cài đặt chung / Thông tin ứng dụng</b> chép <b>ID ứng dụng</b> và <b>Khoá bí mật</b> (bấm biểu tượng con mắt để hiện). Dán vào hai ô ở phần trên.</li>
      <li><b>Xác thực tên miền.</b> Trong ứng dụng, mục <b>Cài đặt → Xác thực miền</b> (hoặc <b>Quản lý domain</b>), thêm <code>{{ domain }}</code> rồi xác thực bằng một trong các cách Zalo đưa ra (cách dễ nhất là thêm bản ghi TXT vào DNS Cloudflare).</li>
      <li><b>Liên kết ứng dụng với OA.</b> Mục <b>Official Account</b> của ứng dụng → <b>Liên kết OA</b> (hoặc nhập OA ID) → chọn OA của bạn → quản trị OA xác nhận.</li>
      <li><b>Điền Callback URL.</b> Cũng ở mục Official Account, ô <b>Official Account Callback URL</b>: dán <code>{{ cb }}</code> rồi lưu. Phải khớp từng ký tự.</li>
      <li><b>Cấu hình Webhook.</b> Mục <b>Webhook</b> của ứng dụng: ô URL dán <code>{{ hook }}</code>; bật hai sự kiện <b>user_send_text</b> (khách nhắn chữ) và <b>follow</b> (khách quan tâm OA). Chép <b>OA Secret Key</b> ở ngay mục này và dán vào ô "OA Secret Key" phía trên.</li>
      <li><b>Quyền gửi tin.</b> Ở phần quyền của ứng dụng, đảm bảo đã được cấp quyền gửi <b>tin tư vấn</b> và <b>đọc tin nhắn / quản lý người quan tâm</b> của OA.</li>
      <li><b>Lưu và Kết nối.</b> Quay lại đây, bấm <b>Lưu</b>, rồi <b>Kết nối Zalo OA</b>. Zalo hiện trang xin quyền: đăng nhập bằng tài khoản quản trị OA, chọn đúng OA, bấm <b>Cho phép</b>. Trình duyệt tự quay về và báo "Đã kết nối Zalo OA". Từ đây token tự làm mới, không cần làm lại.</li>
      <li><b>Thử.</b> Bấm <b>Tạo mã thử</b> ở phần đầu trang, làm theo 3 bước hiện ra bằng một tài khoản Zalo cá nhân. Thấy "Khách đã ghép Zalo" tăng lên và nhận tin xác nhận là chạy tốt.</li>
      <li><b>Bật cho khách thật.</b> Tick "Hiện mã Zalo cho khách thật" ở phần kết nối rồi Lưu.</li>
    </ol>
    <p class="sub"><b>Gặp lỗi?</b> "redirect_uri không hợp lệ": Callback URL chưa lưu hoặc khác với dòng trên. "Zalo từ chối (-14002…)": App Secret sai. Webhook báo 401: OA Secret Key sai (khác với App Secret). Không nhận được sự kiện: kiểm tra tên miền đã xác thực và hai sự kiện đã bật. Tài khoản đăng nhập không phải quản trị OA thì Zalo sẽ không cho cấp quyền.</p>
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

</template>
