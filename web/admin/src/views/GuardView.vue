<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { useAdmin } from '../store'

// Chặn tấn công (DDoS, quét, bơm request): xem ai đang bị giới hạn, danh sách đang bị cấm (IP và trình duyệt), cấm/bỏ cấm tay,
// chỉnh ngưỡng tự cấm và danh sách IP luôn cho phép. Việc cấm thật do nginx thực hiện (server/guard.go).
interface Cfg { enabled: boolean; ip_strikes: number; ip_ban_min: number; fp_strikes: number; fp_ips: number; fp_ban_min: number; allow: string[]; level: string; tools_off: boolean; dv_strikes: number }
type Kind = 'ip' | 'dv' | 'model' | 'ua' | 'cc' | 'fp'
interface Ban { id: number; kind: Kind; value: string; label: string; reason: string; source: string; created: number; expires: number; times: number }
interface Seen { ip: string; count: number; last: number; ua: string; path: string; fp: string; dv: string; model: string; can_fp: boolean; banned: boolean }
interface State { config: Cfg; bans: Ban[]; recent: Seen[]; own_ip: string; behind_cf: boolean; enforce: boolean; synced: number; sync_error: string; now: number }

const a = useAdmin()
const st = ref<State | null>(null)
const cfg = reactive<Cfg>({ enabled: true, ip_strikes: 10, ip_ban_min: 60, fp_strikes: 150, fp_ips: 5, fp_ban_min: 30, allow: [], level: 'standard', tools_off: false, dv_strikes: 20 })
const allowText = ref('')
const manual = reactive({ kind: 'ip' as Kind, value: '', hours: 24, reason: '' })
const KINDS: [Kind, string, string][] = [['ip', 'IP hoặc dải IP', '203.0.113.5 hoặc 203.0.113.0/24'], ['dv', 'Thiết bị (mã thiết bị)', '20 ký tự, chép từ danh sách bị giới hạn'], ['model', 'Model máy (Android)', 'SM-S911B'], ['ua', 'Từ khoá trình duyệt', 'BadBot'], ['cc', 'Quốc gia', 'RU hoặc CN (mã 2 chữ cái)']]
const KLBL: Record<Kind, string> = { ip: 'IP', dv: 'Thiết bị', model: 'Model máy', ua: 'Từ khoá', cc: 'Quốc gia', fp: 'Trình duyệt' }
const PRESETS: Record<string, { name: string; desc: string; v: Partial<Cfg> }> = {
  standard: { name: 'Chuẩn', desc: 'Cân bằng, hợp website bình thường. 20 yêu cầu/giây mỗi IP.', v: { level: 'standard', ip_strikes: 10, ip_ban_min: 60, fp_strikes: 150, fp_ips: 5, fp_ban_min: 30, dv_strikes: 20 } },
  strong: { name: 'Mạnh', desc: 'Khi đang bị quét hoặc bơm request. 10 yêu cầu/giây, cấm sau 6 lần.', v: { level: 'strong', ip_strikes: 6, ip_ban_min: 180, fp_strikes: 60, fp_ips: 3, fp_ban_min: 120, dv_strikes: 10 } },
  max: { name: 'Tối đa', desc: 'Mạnh tay nhất. 5 yêu cầu/giây, cấm sau 3 lần, cấm cả thiết bị lẫn dải IP. Người dùng thật có thể thỉnh thoảng gặp trang 429.', v: { level: 'max', ip_strikes: 3, ip_ban_min: 720, fp_strikes: 30, fp_ips: 2, fp_ban_min: 360, dv_strikes: 5 } },
}
const applyPreset = (k: string) => Object.assign(cfg, PRESETS[k].v)
const busy = ref(false)
const err = ref('')
let timer = 0

function adopt(s: State, keepForm = false) {
  st.value = s
  if (!keepForm) { Object.assign(cfg, s.config); allowText.value = (s.config.allow || []).join('\n') }
}
async function load(keepForm = false) {
  try { adopt(await api<State>('GET', 'guard'), keepForm); err.value = '' } catch (e) { err.value = (e as Error).message }
}
onMounted(() => { load(); timer = window.setInterval(() => load(true), 8000) })
onBeforeUnmount(() => clearInterval(timer))

async function run(fn: () => Promise<State>, ok = '') {
  busy.value = true; err.value = ''
  try { adopt(await fn(), true); if (ok) a.say(ok) } catch (e) { err.value = (e as Error).message; a.say(err.value, true) } finally { busy.value = false }
}
const saveCfg = () => run(() => api<State>('PUT', 'guard/config', { ...cfg, allow: allowText.value.split(/[\s,;]+/).filter(Boolean) }), 'Đã lưu cài đặt chặn tấn công.')
const ban = (kind: Kind, value: string, hours: number, reason: string, label = '') => run(() => api<State>('POST', 'guard/ban', { kind, value, hours, reason, label }), 'Đã cấm.')
const unban = (b: Ban) => { if (confirm('Bỏ cấm ' + (b.kind === 'fp' ? 'trình duyệt này' : b.value) + '?')) run(() => api<State>('POST', 'guard/unban', { id: b.id }), 'Đã bỏ cấm.') }
const addManual = async () => { await ban(manual.kind, manual.value, manual.hours, manual.reason); if (!err.value) { manual.value = ''; manual.reason = '' } }
function allowMine() {
  if (!st.value) return
  const cur = allowText.value.split(/[\s,;]+/).filter(Boolean)
  if (!cur.includes(st.value.own_ip)) { cur.push(st.value.own_ip); allowText.value = cur.join('\n'); saveCfg() }
}

const fmt = (t: number) => new Date(t * 1000).toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const ago = (t: number) => { const s = Math.max(0, (st.value?.now || Date.now() / 1000) - t); return s < 90 ? Math.round(s) + ' giây trước' : s < 5400 ? Math.round(s / 60) + ' phút trước' : Math.round(s / 3600) + ' giờ trước' }
const left = (b: Ban) => { if (!b.expires) return 'Vĩnh viễn'; const s = b.expires - (st.value?.now || Date.now() / 1000); return s < 90 ? 'còn ' + Math.max(1, Math.round(s)) + ' giây' : s < 5400 ? 'còn ' + Math.round(s / 60) + ' phút' : s < 172800 ? 'còn ' + Math.round(s / 3600) + ' giờ' : 'còn ' + Math.round(s / 86400) + ' ngày' }
const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n) + '…' : s)
const browser = (fp: string) => fp.split('|')[0] || '(không có tên trình duyệt)'
const sortedBans = computed(() => [...(st.value?.bans || [])])
const ph = computed(() => KINDS.find((k) => k[0] === manual.kind)![2])
</script>

<template>
  <div v-if="st" class="gd">
    <div class="panel">
      <h2>Chặn tấn công</h2>
      <p class="sub">Website tự giới hạn tốc độ truy cập. Ai gửi quá nhiều yêu cầu sẽ nhận trang "429", tiếp tục thì bị cấm tạm thời, tái phạm thì cấm lâu hơn. Cấm theo cả <b>IP</b>, <b>dải IP</b>, <b>thiết bị</b>, <b>model máy</b>, <b>trình duyệt</b> và <b>quốc gia</b>, nên kẻ thuê nhiều proxy để đổi IP mà vẫn dùng một máy hay một công cụ cũng bị chặn. Bạn xem và bỏ cấm ở ngay trang này.</p>
      <div class="gst">
        <span class="gok" :class="{ no: !st.enforce }"><i></i>{{ st.enforce ? 'Đã nối với nginx' + (st.synced ? ', cập nhật ' + ago(st.synced) : '') : 'Chưa nối nginx: chỉ ghi nhận, chưa chặn thật' }}</span>
        <span class="gok" :class="{ no: !st.behind_cf }"><i></i>{{ st.behind_cf ? 'Đang đứng sau Cloudflare' : 'Chưa thấy Cloudflare phía trước' }}</span>
        <span class="gme">IP của bạn: <b>{{ st.own_ip }}</b> <button type="button" class="btn gh sm" :disabled="busy" @click="allowMine">Luôn cho phép IP này</button></span>
      </div>
      <p v-if="st.sync_error" class="msg err">Lỗi ghi danh sách cho nginx: {{ st.sync_error }}</p>
      <p v-if="err" class="msg err">{{ err }}</p>
    </div>

    <div class="panel">
      <h2>Đang bị cấm <small>({{ st.bans.length }})</small></h2>
      <p v-if="!st.bans.length" class="sub">Chưa có IP hay trình duyệt nào bị cấm.</p>
      <div v-else class="gtw">
        <table class="gt">
          <thead><tr><th>Đối tượng</th><th>Lý do</th><th>Từ</th><th>Thời gian</th><th></th></tr></thead>
          <tbody>
            <tr v-for="b in sortedBans" :key="b.id">
              <td><span class="gk" :class="b.kind">{{ KLBL[b.kind] }}</span>
                <b v-if="b.kind === 'fp'" :title="b.value">{{ short(browser(b.value), 60) }}</b><b v-else :title="b.label">{{ b.value }}</b><small v-if="b.kind === 'dv' && b.label"> {{ short(b.label, 50) }}</small></td>
              <td>{{ b.reason }}<small v-if="b.times > 1"> · lần thứ {{ b.times }}</small><small> · {{ b.source === 'auto' ? 'tự động' : 'thủ công' }}</small></td>
              <td>{{ fmt(b.created) }}</td>
              <td>{{ left(b) }}</td>
              <td><button type="button" class="btn gh sm" :disabled="busy" @click="unban(b)">Bỏ cấm</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 class="gh3">Cấm thủ công</h3>
      <div class="gform">
        <label class="f">Cấm theo<select v-model="manual.kind"><option v-for="k in KINDS" :key="k[0]" :value="k[0]">{{ k[1] }}</option></select></label>
        <label class="f">Giá trị<input v-model="manual.value" type="text" :placeholder="ph" spellcheck="false"></label>
        <label class="f">Cấm trong<select v-model.number="manual.hours"><option :value="1">1 giờ</option><option :value="24">1 ngày</option><option :value="168">7 ngày</option><option :value="720">30 ngày</option><option :value="0">Vĩnh viễn</option></select></label>
        <label class="f">Lý do (không bắt buộc)<input v-model="manual.reason" type="text" maxlength="200"></label>
        <button type="button" class="btn" :disabled="busy || !manual.value.trim()" @click="addManual">Cấm</button>
      </div>
      <p class="sub gnote"><b>Về IMEI, số seri, địa chỉ MAC:</b> trình duyệt web không bao giờ cho website đọc các mã phần cứng này (Chrome, Safari, Firefox đều chặn vì lý do riêng tư), nên không có cách nào chặn theo IMEI hay số seri qua website. Thay vào đó website chặn theo <b>thiết bị</b> (mã băm từ GPU, màn hình, múi giờ, cấu hình máy, cộng model Android: kẻ tấn công đổi IP hay xoá cookie vẫn bị nhận ra), <b>model máy</b> Android, <b>trình duyệt</b>, <b>IP và cả dải IP</b>, <b>quốc gia</b>, và <b>công cụ tự động</b>. Muốn chặn theo IMEI/seri thật thì phải có ứng dụng điện thoại riêng của bạn đăng nhập và gửi mã đó lên.</p>
    </div>

    <div class="panel">
      <h2>Đang bị giới hạn gần đây</h2>
      <p class="sub">Những IP vừa nhận lỗi 429 (gửi quá nhanh). Người dùng bình thường gần như không bao giờ có tên ở đây. Danh sách này tự làm mới và mất khi máy chủ khởi động lại.</p>
      <p v-if="!st.recent.length" class="sub"><b>Không có ai.</b> Website đang bình thường.</p>
      <div v-else class="gtw">
        <table class="gt">
          <thead><tr><th>IP</th><th>Số lần</th><th>Gần nhất</th><th>Thiết bị, trình duyệt</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in st.recent" :key="r.ip">
              <td><b>{{ r.ip }}</b><small v-if="r.banned" class="gbn"> đã cấm</small></td>
              <td>{{ r.count }}</td>
              <td>{{ ago(r.last) }}</td>
              <td><span :title="r.ua">{{ short(r.ua || '(không có)', 64) }}</span><small v-if="r.model"> · model {{ r.model }}</small><small v-if="r.dv"> · thiết bị <code>{{ r.dv.slice(0, 8) }}…</code></small><small> {{ short(r.path, 40) }}</small></td>
              <td class="gact">
                <button type="button" class="btn gh sm" :disabled="busy" @click="ban('ip', r.ip, 24, 'Cấm thủ công từ danh sách bị giới hạn')">Cấm IP</button>
                <button v-if="r.dv" type="button" class="btn gh sm" :disabled="busy" title="Cấm thiết bị này dù đổi IP hay xoá cookie" @click="ban('dv', r.dv, 24, 'Cấm thiết bị thủ công', r.model + ' ' + r.ua)">Cấm thiết bị</button>
                <button v-if="r.model" type="button" class="btn gh sm" :disabled="busy" title="Cấm mọi máy cùng model này" @click="ban('model', r.model, 24, 'Cấm model thủ công')">Cấm model</button>
                <button v-if="r.can_fp" type="button" class="btn gh sm" :disabled="busy" title="Cấm mọi IP dùng đúng trình duyệt này" @click="ban('fp', r.fp, 24, 'Cấm trình duyệt thủ công', r.ua)">Cấm trình duyệt</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2>Cài đặt</h2>
      <div class="gpre" role="group" aria-label="Mức bảo vệ"><button v-for="(p, k) in PRESETS" :key="k" type="button" :aria-pressed="cfg.level === k" @click="applyPreset(String(k))"><b>{{ p.name }}</b><small>{{ p.desc }}</small></button></div>
      <label class="gsw"><input v-model="cfg.tools_off" type="checkbox" :true-value="false" :false-value="true"> <span><b>Chặn công cụ tự động</b> (curl, python, Go, máy quét lỗ hổng như sqlmap, nmap; trình duyệt không giao diện; yêu cầu không có User-Agent). Không ảnh hưởng Googlebot, Facebook, Zalo. Webhook Zalo được miễn trừ.</span></label>
      <label class="gsw"><input v-model="cfg.enabled" type="checkbox"> <span><b>Tự động cấm</b> khi có dấu hiệu tấn công. Tắt thì vẫn giới hạn tốc độ nhưng không cấm tạm thời.</span></label>
      <div class="gcfg">
        <label class="f">Cấm IP khi bị giới hạn bao nhiêu lần trong 1 phút<input v-model.number="cfg.ip_strikes" type="number" min="3" max="1000"></label>
        <label class="f">Thời gian cấm IP lần đầu (phút)<input v-model.number="cfg.ip_ban_min" type="number" min="1"><small>Tái phạm: gấp 4 mỗi lần, tối đa 7 ngày.</small></label>
        <label class="f">Cấm trình duyệt khi cùng một trình duyệt bị giới hạn bao nhiêu lần trong 1 phút<input v-model.number="cfg.fp_strikes" type="number" min="20"></label>
        <label class="f">…từ ít nhất bao nhiêu IP khác nhau<input v-model.number="cfg.fp_ips" type="number" min="2"></label>
        <label class="f">Thời gian cấm trình duyệt (phút)<input v-model.number="cfg.fp_ban_min" type="number" min="1"></label>
        <label class="f">Cấm thiết bị khi bị giới hạn bao nhiêu lần trong 5 phút (từ ít nhất 2 IP)<input v-model.number="cfg.dv_strikes" type="number" min="5"><small>Bắt kẻ đổi proxy nhưng vẫn dùng một máy.</small></label>
      </div>
      <label class="f">IP luôn cho phép (mỗi dòng một IP hoặc dải, không bao giờ bị giới hạn hay cấm: văn phòng, máy của bạn, dịch vụ giám sát)
        <textarea v-model="allowText" rows="3" placeholder="203.0.113.5&#10;198.51.100.0/24" spellcheck="false"></textarea></label>
      <div><button type="button" class="btn" :disabled="busy" @click="saveCfg">Lưu cài đặt</button></div>
      <p class="sub gnote">Từ 3 IP cùng dải /24 bị cấm trong 24 giờ thì cấm cả dải (proxy thuê thường cấp IP liền nhau). Mức bảo vệ quyết định số yêu cầu/giây nginx cho phép (Chuẩn 20, Mạnh 10, Tối đa 5 mỗi IP; API và PDF chặt hơn). Các IP của Cloudflare và IP nội bộ không bao giờ bị cấm để tránh chặn nhầm cả website.</p>
    </div>

    <div class="panel">
      <h2>Cloudflare: lớp chặn ngoài cùng</h2>
      <p class="sub">Phần trên bảo vệ máy chủ của bạn. Muốn chặn từ xa trước khi request chạm tới máy chủ, hãy bật thêm các mục sau trong trang quản lý Cloudflare của tên miền (cần đăng nhập Cloudflare, làm một lần):</p>
      <ol class="gcf">
        <li><b>SSL/TLS → Overview:</b> chọn <b>Full</b> (hoặc Full strict nếu máy chủ đã có chứng chỉ).</li>
        <li><b>Security → Bots:</b> bật <b>Bot Fight Mode</b> (chặn các công cụ quét tự động).</li>
        <li><b>Security → Settings:</b> đặt <b>Security Level</b> là <b>Medium</b> hoặc <b>High</b>; bật <b>Browser Integrity Check</b>.</li>
        <li><b>Security → WAF → Rate limiting rules:</b> thêm 1 quy tắc (gói miễn phí được 1): khi một IP gửi quá <b>100 yêu cầu trong 10 giây</b> thì <b>Block</b> trong 10 phút.</li>
        <li><b>Khi đang bị tấn công dồn dập:</b> Security → Settings → bật <b>Under Attack Mode</b> (mọi khách phải qua bước kiểm tra vài giây), xong việc thì tắt.</li>
        <li><b>DNS:</b> các bản ghi của website phải bật <b>Proxied</b> (đám mây màu cam). Không proxied thì Cloudflare không bảo vệ được.</li>
        <li>Nên chặn truy cập thẳng vào IP máy chủ, chỉ nhận từ Cloudflare (tường lửa ufw cho phép cổng 80/443 chỉ từ các dải <a href="https://www.cloudflare.com/ips/" target="_blank" rel="noopener">IP Cloudflare</a>) để kẻ tấn công không né Cloudflare được.</li>
      </ol>
    </div>
  </div>
  <div v-else class="panel"><p class="sub">{{ err || 'Đang tải…' }}</p></div>
</template>
