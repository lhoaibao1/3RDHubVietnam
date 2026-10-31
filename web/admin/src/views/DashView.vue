<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api'
import { fmt, useAdmin } from '../store'

// Tổng quan: số liệu truy cập tự đo (server/stats.go), yêu cầu khách, tình trạng hệ thống và bảo vệ.
interface C { k: string; n: number; v: number; ch?: string }
interface Pt { t: string; views: number; visitors: number; leads: number }
interface S {
  days: number; now: number; hourly: boolean; tracking_since_hits: number
  totals: { views: number; visitors: number; leads: number; prev_views: number; prev_visitors: number; prev_leads: number; online: number }
  series: Pt[]; pages: C[]; sources: C[]; countries: C[]; devices: C[]; browsers: C[]; os: C[]; langs: C[]
  leads_by_status: Record<string, number>; needs: C[]
  recent_leads: { id: number; ts: number; name: string; need: string; status: string }[]
  guard: { bans: number; limited_1h: number; enforce: boolean }
  system: { smtp: boolean; zalo: boolean; cf: boolean; content_updated: number }
}
const a = useAdmin()
const days = ref(7)
const s = ref<S | null>(null)
const err = ref('')
const table = ref(false)
const hover = ref(-1)
let timer = 0

async function load() {
  try { s.value = await api<S>('GET', 'stats?days=' + days.value); err.value = '' } catch (e) { err.value = (e as Error).message }
}
function pick(d: number) { days.value = d; load() }
onMounted(() => { load(); timer = window.setInterval(() => { if (!document.hidden) load() }, 30000) })
onBeforeUnmount(() => clearInterval(timer))

const RANGES: [number, string][] = [[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày']]
const n0 = (v: number) => v.toLocaleString('vi-VN')
const empty = computed(() => !!s.value && s.value.tracking_since_hits === 0)

// ---- chỉ số và so sánh với kỳ trước
function delta(cur: number, prev: number) {
  if (!prev) return cur ? { t: 'Mới', cls: 'up' } : { t: '–', cls: '' }
  const p = Math.round(((cur - prev) / prev) * 100)
  return { t: (p > 0 ? '+' : '') + p + '%', cls: p > 0 ? 'up' : p < 0 ? 'down' : '' }
}
const conv = computed(() => (s.value && s.value.totals.visitors ? (s.value.totals.leads / s.value.totals.visitors) * 100 : 0))
const prevConv = computed(() => (s.value && s.value.totals.prev_visitors ? (s.value.totals.prev_leads / s.value.totals.prev_visitors) * 100 : 0))
const kpis = computed(() => {
  const t = s.value!.totals, sr = s.value!.series
  return [
    { k: 'Lượt xem trang', v: n0(t.views), d: delta(t.views, t.prev_views), spark: sr.map((p) => p.views), c: 'c1' },
    { k: 'Khách truy cập', v: n0(t.visitors), d: delta(t.visitors, t.prev_visitors), spark: sr.map((p) => p.visitors), c: 'c2' },
    { k: 'Yêu cầu từ khách', v: n0(t.leads), d: delta(t.leads, t.prev_leads), spark: sr.map((p) => p.leads), c: 'c1' },
    { k: 'Tỉ lệ chuyển đổi', v: conv.value.toFixed(conv.value < 10 ? 1 : 0) + '%', d: delta(conv.value, prevConv.value), spark: sr.map((p) => (p.visitors ? p.leads / p.visitors : 0)), c: 'c2' },
  ]
})

// ---- biểu đồ đường: một trục, hai chuỗi cùng đơn vị (lượt xem, khách)
const W = 860, H = 280, PL = 44, PR = 16, PT = 14, PB = 30
const niceMax = (m: number) => { if (m <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p }
const yMax = computed(() => niceMax(Math.max(1, ...(s.value?.series.map((p) => Math.max(p.views, p.visitors)) || [1]))))
const xs = (i: number) => PL + (s.value!.series.length <= 1 ? 0 : (i / (s.value!.series.length - 1)) * (W - PL - PR))
const ys = (v: number) => PT + (1 - v / yMax.value) * (H - PT - PB)
const line = (f: (p: Pt) => number) => s.value!.series.map((p, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(f(p)).toFixed(1)).join(' ')
const area = (f: (p: Pt) => number) => line(f) + ` L${xs(s.value!.series.length - 1).toFixed(1)} ${ys(0)} L${xs(0).toFixed(1)} ${ys(0)} Z`
const yTicks = computed(() => [0, 1, 2, 3, 4].map((i) => (yMax.value / 4) * i))
const label = (t: string) => (s.value!.hourly ? t.slice(11) + 'h' : t.slice(8) + '/' + t.slice(5, 7))
const xTicks = computed(() => { const n = s.value!.series.length, step = Math.max(1, Math.ceil(n / 7)); return s.value!.series.map((p, i) => ({ i, t: label(p.t) })).filter((x) => x.i % step === 0) })
const tip = computed(() => (hover.value >= 0 && s.value ? s.value.series[hover.value] : null))
function onMove(e: MouseEvent) {
  const r = (e.currentTarget as SVGElement).getBoundingClientRect(), n = s.value!.series.length
  const x = ((e.clientX - r.left) / r.width) * W
  hover.value = Math.max(0, Math.min(n - 1, Math.round(((x - PL) / (W - PL - PR)) * (n - 1))))
}
// yêu cầu theo ngày: biểu đồ cột riêng (thang đo riêng, không chồng lên trục của lượt xem)
const lMax = computed(() => Math.max(2, ...(s.value?.series.map((p) => p.leads) || [2])))
const bw = computed(() => Math.max(3, Math.min(26, (W - PL - PR) / (s.value?.series.length || 1) - 4)))

function spark(v: number[]) {
  const w = 120, h = 34, m = Math.max(1, ...v)
  return v.map((x, i) => (i ? 'L' : 'M') + ((i / Math.max(1, v.length - 1)) * w).toFixed(1) + ' ' + (h - 3 - (x / m) * (h - 6)).toFixed(1)).join(' ')
}

// ---- danh sách có thanh
const bars = (rows: C[]) => { const m = Math.max(1, ...rows.map((r) => r.n)); return rows.map((r) => ({ ...r, w: Math.max(2, (r.n / m) * 100) })) }
const CH: Record<string, string> = { direct: 'Trực tiếp', search: 'Tìm kiếm', social: 'Mạng xã hội', referral: 'Website khác', campaign: 'Chiến dịch' }
const sources = computed(() => bars(s.value!.sources.map((r) => ({ ...r, k: r.k || CH[r.ch || 'direct'], ch: r.k ? CH[r.ch || 'direct'] : '' }))))
let dn: Intl.DisplayNames | null = null
try { dn = new Intl.DisplayNames(['vi'], { type: 'region' }) } catch { /* bỏ qua */ }
const flag = (cc: string) => cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
const countries = computed(() => bars(s.value!.countries.map((r) => ({ ...r, k: r.k ? flag(r.k) + ' ' + (dn?.of(r.k) || r.k) : 'Không rõ' }))))
const DEV: Record<string, string> = { desktop: 'Máy tính', mobile: 'Điện thoại', tablet: 'Máy tính bảng' }
const devices = computed(() => { const t = s.value!.devices.reduce((x, r) => x + r.n, 0) || 1; return s.value!.devices.map((r, i) => ({ ...r, k: DEV[r.k] || r.k, p: Math.round((r.n / t) * 100), c: 'd' + i })) })
const STATUS: [string, string][] = [['new', 'Mới'], ['contacted', 'Đã liên hệ'], ['done', 'Hoàn tất'], ['spam', 'Spam']]
const stTotal = computed(() => Object.values(s.value!.leads_by_status).reduce((x, y) => x + y, 0) || 1)
const ago = (t: number) => { const d = (s.value!.now - t); return d < 90 ? 'vừa xong' : d < 5400 ? Math.round(d / 60) + ' phút trước' : d < 172800 ? Math.round(d / 3600) + ' giờ trước' : Math.round(d / 86400) + ' ngày trước' }
const stLabel = (v: string) => STATUS.find((x) => x[0] === v)?.[1] || v
</script>

<template>
  <div v-if="s" class="dsh">
    <div class="dhead">
      <p class="sub">Số liệu truy cập tự đo trên website, không cookie và không lưu IP. Tự làm mới mỗi 30 giây.</p>
      <div class="dctl">
        <span class="live" :title="'Khách có hoạt động trong 5 phút qua'"><i></i>{{ s.totals.online }} đang online</span>
        <div class="chips" role="group" aria-label="Khoảng thời gian"><button v-for="r in RANGES" :key="r[0]" type="button" :aria-pressed="days === r[0]" @click="pick(r[0])">{{ r[1] }}</button></div>
      </div>
    </div>

    <p v-if="empty" class="msg ok">Bộ đo lượt truy cập vừa được bật. Số liệu sẽ xuất hiện khi có khách vào website (không tính khách bật Do Not Track, bot và trang đang sửa).</p>
    <p v-if="err" class="msg err">{{ err }}</p>

    <div class="kpis">
      <div v-for="k in kpis" :key="k.k" class="kpi">
        <span class="kl">{{ k.k }}</span>
        <b class="kv">{{ k.v }}</b>
        <span class="kd" :class="k.d.cls" :title="'So với ' + (days === 1 ? '24 giờ' : days + ' ngày') + ' trước đó'">{{ k.d.t }}<small> so với kỳ trước</small></span>
        <svg class="ksp" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true"><path :d="spark(k.spark)" :class="k.c" /></svg>
      </div>
    </div>

    <div class="panel">
      <div class="phead">
        <h3>Lượt xem và khách theo {{ s.hourly ? 'giờ' : 'ngày' }}</h3>
        <div class="legend"><span class="c1"><i></i>Lượt xem trang</span><span class="c2"><i></i>Khách truy cập</span></div>
        <button type="button" class="btn gh sm" @click="table = !table">{{ table ? 'Xem biểu đồ' : 'Xem dạng bảng' }}</button>
      </div>
      <div v-if="!table" class="chart" @mouseleave="hover = -1">
        <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="'Biểu đồ lượt xem và khách trong ' + s.series.length + ' mốc thời gian'" @mousemove="onMove">
          <g class="grid"><template v-for="v in yTicks" :key="v"><line :x1="PL" :x2="W - PR" :y1="ys(v)" :y2="ys(v)" /><text :x="PL - 8" :y="ys(v) + 4" text-anchor="end">{{ n0(Math.round(v)) }}</text></template></g>
          <g class="axis"><text v-for="x in xTicks" :key="x.i" :x="xs(x.i)" :y="H - 8" text-anchor="middle">{{ x.t }}</text></g>
          <path :d="area(p => p.views)" class="area c1" />
          <path :d="line(p => p.views)" class="ln c1" />
          <path :d="line(p => p.visitors)" class="ln c2" />
          <template v-if="tip"><line class="cross" :x1="xs(hover)" :x2="xs(hover)" :y1="PT" :y2="H - PB" /><circle :cx="xs(hover)" :cy="ys(tip.views)" r="4.5" class="dot c1" /><circle :cx="xs(hover)" :cy="ys(tip.visitors)" r="4.5" class="dot c2" /></template>
        </svg>
        <div v-if="tip" class="tip" :style="{ left: Math.min(92, Math.max(8, (xs(hover) / W) * 100)) + '%' }"><b>{{ s.hourly ? tip.t.slice(11) + ':00, ' + tip.t.slice(8, 10) + '/' + tip.t.slice(5, 7) : tip.t.slice(8) + '/' + tip.t.slice(5, 7) + '/' + tip.t.slice(0, 4) }}</b><span class="c1"><i></i>Lượt xem <b>{{ n0(tip.views) }}</b></span><span class="c2"><i></i>Khách <b>{{ n0(tip.visitors) }}</b></span><span v-if="tip.leads"><i class="lead"></i>Yêu cầu <b>{{ tip.leads }}</b></span></div>
      </div>
      <div v-else class="tw"><table class="gt"><thead><tr><th>{{ s.hourly ? 'Giờ' : 'Ngày' }}</th><th>Lượt xem</th><th>Khách</th><th>Yêu cầu</th></tr></thead><tbody><tr v-for="p in [...s.series].reverse()" :key="p.t"><td>{{ label(p.t) }}</td><td>{{ n0(p.views) }}</td><td>{{ n0(p.visitors) }}</td><td>{{ p.leads }}</td></tr></tbody></table></div>
      <h3 class="sh">Yêu cầu từ khách theo {{ s.hourly ? 'giờ' : 'ngày' }}</h3>
      <svg v-if="!table" class="mini" :viewBox="`0 0 ${W} 74`" role="img" aria-label="Số yêu cầu từ khách theo thời gian">
        <line :x1="PL" :x2="W - PR" y1="64" y2="64" class="base" />
        <template v-for="(p, i) in s.series" :key="p.t"><rect v-if="p.leads" :x="xs(i) - bw / 2" :y="64 - (p.leads / lMax) * 52" :width="bw" :height="(p.leads / lMax) * 52" rx="3" class="bar c1"><title>{{ label(p.t) }}: {{ p.leads }} yêu cầu</title></rect></template>
        <text :x="PL - 8" y="16" text-anchor="end" class="axis">{{ lMax }}</text><text :x="PL - 8" y="68" text-anchor="end" class="axis">0</text>
      </svg>
    </div>

    <div class="g2c">
      <div class="panel"><h3>Trang được xem nhiều</h3><p v-if="!s.pages.length" class="sub">Chưa có dữ liệu.</p>
        <div v-for="r in bars(s.pages)" :key="r.k" class="brow"><span class="bl" :title="r.k">{{ r.k === '/' ? 'Trang chủ' : r.k }}</span><span class="bt"><i class="c1" :style="{ width: r.w + '%' }"></i></span><b>{{ n0(r.n) }}</b></div></div>
      <div class="panel"><h3>Nguồn truy cập</h3><p v-if="!s.sources.length" class="sub">Chưa có dữ liệu.</p>
        <div v-for="r in sources" :key="r.ch + r.k" class="brow"><span class="bl" :title="r.k"><em v-if="r.ch">{{ r.ch }}</em> {{ r.k }}</span><span class="bt"><i class="c1" :style="{ width: r.w + '%' }"></i></span><b>{{ n0(r.n) }}</b></div></div>
    </div>

    <div class="g3c">
      <div class="panel"><h3>Thiết bị</h3><p v-if="!devices.length" class="sub">Chưa có dữ liệu.</p>
        <div v-if="devices.length" class="seg"><i v-for="d in devices" :key="d.k" :class="d.c" :style="{ flex: d.n }" :title="d.k + ': ' + d.p + '%'"></i></div>
        <div v-for="d in devices" :key="d.k" class="lrow"><span><i :class="d.c"></i>{{ d.k }}</span><b>{{ d.p }}%</b></div>
        <h3 class="sh">Hệ điều hành</h3><div v-for="r in bars(s.os)" :key="r.k" class="brow"><span class="bl">{{ r.k }}</span><span class="bt"><i class="c1" :style="{ width: r.w + '%' }"></i></span><b>{{ n0(r.n) }}</b></div></div>
      <div class="panel"><h3>Trình duyệt</h3><p v-if="!s.browsers.length" class="sub">Chưa có dữ liệu.</p>
        <div v-for="r in bars(s.browsers)" :key="r.k" class="brow"><span class="bl">{{ r.k }}</span><span class="bt"><i class="c1" :style="{ width: r.w + '%' }"></i></span><b>{{ n0(r.n) }}</b></div>
        <h3 class="sh">Ngôn ngữ</h3><div v-for="r in bars(s.langs)" :key="r.k" class="brow"><span class="bl">{{ r.k === 'vi' ? 'Tiếng Việt' : r.k === 'en' ? 'English' : r.k || 'Không rõ' }}</span><span class="bt"><i class="c1" :style="{ width: r.w + '%' }"></i></span><b>{{ n0(r.n) }}</b></div></div>
      <div class="panel"><h3>Quốc gia</h3><p v-if="!s.countries.length" class="sub">Chưa có dữ liệu. Cần bật Cloudflare phía trước để biết quốc gia.</p>
        <div v-for="r in countries" :key="r.k" class="brow"><span class="bl">{{ r.k }}</span><span class="bt"><i class="c1" :style="{ width: r.w + '%' }"></i></span><b>{{ n0(r.n) }}</b></div></div>
    </div>

    <div class="g2c">
      <div class="panel">
        <div class="phead"><h3>Yêu cầu khách</h3><button type="button" class="btn gh sm" @click="a.go('leads')">Xem tất cả</button></div>
        <div class="seg st"><i v-for="(x, i) in STATUS" :key="x[0]" :class="'s' + i" :style="{ flex: s.leads_by_status[x[0]] || 0 }" :title="x[1] + ': ' + (s.leads_by_status[x[0]] || 0)"></i></div>
        <div class="stl"><span v-for="(x, i) in STATUS" :key="x[0]"><i :class="'s' + i"></i>{{ x[1] }} <b>{{ s.leads_by_status[x[0]] || 0 }}</b></span></div>
        <div v-if="!s.recent_leads.length" class="empty">Chưa có yêu cầu nào.</div>
        <ul v-else class="rl"><li v-for="l in s.recent_leads" :key="l.id"><button type="button" @click="a.go('leads')"><b>{{ l.name }}</b><span>{{ l.need || 'Tư vấn' }}</span><em :class="l.status">{{ stLabel(l.status) }}</em><small>{{ ago(l.ts) }}</small></button></li></ul>
        <template v-if="s.needs.length"><h3 class="sh">Khách quan tâm</h3><div v-for="r in bars(s.needs)" :key="r.k" class="brow"><span class="bl" :title="r.k">{{ r.k }}</span><span class="bt"><i class="c2" :style="{ width: r.w + '%' }"></i></span><b>{{ r.n }}</b></div></template>
      </div>
      <div class="panel">
        <h3>Tình trạng hệ thống</h3>
        <ul class="sys">
          <li><button type="button" @click="a.go('email')"><i :class="s.system.smtp ? 'ok' : 'no'"></i><span><b>Email báo tin</b><small>{{ s.system.smtp ? 'Đã cấu hình, thư gửi tới đội ngũ khi có yêu cầu' : 'Chưa cấu hình SMTP hoặc người nhận' }}</small></span></button></li>
          <li><button type="button" @click="a.go('email')"><i :class="s.system.zalo ? 'ok' : 'no'"></i><span><b>Zalo OA</b><small>{{ s.system.zalo ? 'Đã kết nối, gửi được tin tư vấn' : 'Chưa kết nối Zalo OA' }}</small></span></button></li>
          <li><button type="button" @click="a.go('guard')"><i :class="s.guard.enforce ? 'ok' : 'no'"></i><span><b>Chặn tấn công</b><small>{{ s.guard.enforce ? 'Đang bảo vệ' : 'Chưa nối nginx' }} · {{ s.guard.bans }} đang bị cấm · {{ s.guard.limited_1h }} IP bị giới hạn trong 1 giờ qua</small></span></button></li>
          <li><button type="button" @click="a.go('guard')"><i :class="s.system.cf ? 'ok' : 'no'"></i><span><b>Cloudflare</b><small>{{ s.system.cf ? 'Đang đứng trước website' : 'Chưa thấy Cloudflare phía trước' }}</small></span></button></li>
          <li><button type="button" @click="a.go('history')"><i class="ok"></i><span><b>Nội dung website</b><small>Chỉnh sửa gần nhất: {{ s.system.content_updated ? fmt(s.system.content_updated) : 'chưa có' }}</small></span></button></li>
        </ul>
        <h3 class="sh">Lối tắt</h3>
        <div class="bar">
          <button class="btn" type="button" @click="a.go('live')">Sửa chữ trên trang</button>
          <button class="btn gh" type="button" @click="a.go('quote')">Báo giá</button>
          <button class="btn gh" type="button" @click="a.go('seo')">SEO</button>
          <button class="btn gh" type="button" @click="a.go('look')">Cảnh 3D</button>
          <button class="btn gh" type="button" @click="a.go('guard')">Chặn tấn công</button>
        </div>
      </div>
    </div>

    <details class="panel help"><summary>Cách hoạt động của CMS</summary>
      <ul>
        <li><b>Sửa tiếng Việt xong bấm "Dịch sang English và lưu" (English trống sẽ tự điền)</b>: website cập nhật ngay, không cần chạy lại gì.</li>
        <li><b>Mỗi đoạn chữ có 2 ô</b>: Tiếng Việt và English. Chỉ cần viết tiếng Việt, khi lưu hệ thống tự dịch sang tiếng Anh.</li>
        <li><b>Chữ giống nhau ở nhiều chỗ</b> đổi một lần là đổi hết. <b>Làm sai?</b> Vào mục "Lịch sử" để khôi phục phiên bản trước.</li>
        <li><b>Sửa chữ:</b> vào "Sửa trên trang" và bấm thẳng vào chữ; không nhớ chữ ở đâu thì dùng "Tìm chữ để sửa".</li>
        <li><b>Về số liệu truy cập:</b> "Khách" đếm theo mã ẩn danh đổi mỗi ngày nên một người quay lại ở ngày khác được tính lại; đây là số ước tính, không phải số người thật.</li>
      </ul>
    </details>
  </div>
  <div v-else class="panel"><p class="sub">{{ err || 'Đang tải…' }}</p></div>
</template>
