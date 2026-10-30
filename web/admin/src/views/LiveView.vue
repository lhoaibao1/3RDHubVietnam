<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdmin } from '../store'
import type { StringItem, Strings, TabKey } from '../types'
import strings from '../strings.json'
import AutoTextarea from '../components/AutoTextarea.vue'

// Sửa trực tiếp trên trang: website mở trong khung bên trái, bấm vào chữ nào thì sửa chữ đó ở cột bên phải, thấy kết quả ngay.
const a = useAdmin()
const S = strings as Strings
const byKey = new Map<string, StringItem>(S.items.map((i) => [i.k, i]))
const siteOrigin = location.protocol + '//' + location.host.replace(/^cms\./, '')
const PAGES: [string, string][] = [['/', 'Trang chủ'], ['/mo-hinh', 'Mô hình'], ['/advertiser', 'Advertiser'], ['/san-pham', 'Sản phẩm'], ['/baogia', 'Báo giá'], ['/cong-nghe', 'Công nghệ'], ['/doi-tac', 'Đối tác'], ['/hoi-dap', 'Hỏi đáp'], ['/lien-he', 'Liên hệ'], ['/dieu-khoan', 'Điều khoản'], ['/bao-mat', 'Bảo mật']]
const path = ref('/')
const src = ref(siteOrigin + '/?edit=1')
const frame = ref<HTMLIFrameElement | null>(null)
const ready = ref(false)
const key = ref('')
const ov = computed(() => a.content!.ov)
const item = computed(() => byKey.get(key.value))

function send(m: object) { frame.value?.contentWindow?.postMessage(m, siteOrigin) }
const sendOv = () => send({ type: 'ov', ov: JSON.parse(JSON.stringify(ov.value)) })

function open(p: string) {
  path.value = p
  if (ready.value) send({ type: 'nav', path: p })
  else src.value = siteOrigin + p + '?edit=1'
}
function onMsg(e: MessageEvent) {
  if (e.origin !== siteOrigin || !e.data || typeof e.data !== 'object') return
  if (e.data.type === 'ready') { ready.value = true; path.value = e.data.path; sendOv() }
  if (e.data.type === 'pick' && typeof e.data.key === 'string') key.value = e.data.key
  if (e.data.type === 'goto' && typeof e.data.tab === 'string') a.go(e.data.tab as TabKey)
}
onMounted(() => addEventListener('message', onMsg))
onBeforeUnmount(() => removeEventListener('message', onMsg))
watch(ov, sendOv, { deep: true })

function cur(lg: 'vi' | 'en') {
  const k = key.value
  return ov.value[k]?.[lg] ?? (lg === 'vi' ? k : item.value?.en || '')
}
function setField(lg: 'vi' | 'en', val: string) {
  const k = key.value
  const def = lg === 'vi' ? k : item.value?.en || ''
  const v = val.replace(/\r\n/g, '\n').trim()
  if (v === def.trim() || !v) { if (ov.value[k]) delete ov.value[k][lg] } else (ov.value[k] = ov.value[k] || {})[lg] = v
  const o = ov.value[k]
  if (o && !o.vi && !o.en) delete ov.value[k]
}
function reset() { delete ov.value[key.value] }
</script>

<template>
  <div class="live">
    <div class="lv-pages">
      <button v-for="p in PAGES" :key="p[0]" type="button" :aria-pressed="path === p[0]" @click="open(p[0])">{{ p[1] }}</button>
      <a class="btn gh sm" :href="siteOrigin + path" target="_blank" rel="noopener" style="margin-left:auto">Mở trang ↗</a>
    </div>
    <div class="lv-grid">
      <div class="lv-frame"><iframe ref="frame" :src="src" title="Xem trước website để sửa" /></div>
      <aside class="lv-side panel">
        <template v-if="!key">
          <h2>Bấm vào chữ để sửa</h2>
          <ul class="lv-help">
            <li>Đưa chuột lên trang bên trái: đoạn chữ sửa được sẽ có <b style="color:var(--or-d)">viền cam</b>. Bấm vào để sửa ở đây.</li>
            <li>Vùng có <b style="color:#7B4DFF">viền tím</b> là danh sách (hỏi đáp, đối tác, khách hàng, báo giá, thông tin công ty): bấm vào để mở mục quản lý của nó.</li>
            <li>Chỉ cần viết <b>tiếng Việt</b>. Khi lưu, hệ thống tự dịch sang tiếng Anh.</li>
            <li>Sửa xong bấm <b>"Lưu và đăng lên website"</b> ở trên cùng.</li>
          </ul>
        </template>
        <template v-else>
          <div class="bar" style="margin:0 0 6px">
            <span v-if="item" class="tag">{{ item.g }}</span>
            <span v-if="ov[key]" class="tag or">Đã sửa</span>
            <button class="btn gh sm" type="button" style="margin-left:auto" @click="key = ''">Đóng</button>
          </div>
          <label class="f">Tiếng Việt<AutoTextarea :model-value="cur('vi')" @update:model-value="setField('vi', $event)" /></label>
          <p v-if="ov[key]?.vi" class="orig">Chữ gốc: {{ key }}</p>
          <details class="lv-en">
            <summary>English <span v-if="ov[key]?.x" class="tag">Tự dịch</span><span v-else-if="ov[key]?.vi && !ov[key]?.en" class="tag or">Sẽ tự dịch khi lưu</span></summary>
            <AutoTextarea :model-value="cur('en')" @update:model-value="setField('en', $event)" />
            <small>Thường không cần sửa. Bạn tự sửa thì hệ thống giữ nguyên bản của bạn.</small>
          </details>
          <div class="bar" style="margin-top:12px">
            <button v-if="ov[key]" class="btn gh sm" type="button" @click="reset">Về chữ gốc</button>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>
