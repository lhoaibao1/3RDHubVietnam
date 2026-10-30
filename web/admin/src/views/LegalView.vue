<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useAdmin } from '../store'
import { fillTokens, renderLegal } from '@/lib/markdown'
import { DEF_SETTINGS, LEGAL_DOCS } from '@/lib/content'
import type { LegalDoc } from '@/lib/content'
import AutoTextarea from '../components/AutoTextarea.vue'

const a = useAdmin()
// Thứ tự theo hồ sơ thông báo website với Bộ Công Thương (dùng chung với website)
const LABEL: Record<string, string> = { privacy: 'Chính sách bảo mật', complaints: 'Tiếp nhận, giải quyết khiếu nại', pricing: 'Chính sách giá', payment: 'Chính sách thanh toán', service: 'Điều kiện, hạn chế cung cấp dịch vụ', refund: 'Cung cấp, chấm dứt dịch vụ và hoàn tiền', support: 'Hỗ trợ trực tuyến', terms: 'Điều khoản sử dụng' }
const LEGALS = LEGAL_DOCS.map((d) => [d.key, LABEL[d.key], d.slug] as const)
const siteUrl = location.origin.replace('//cms.', '//')
const view = reactive<Record<string, 'vi' | 'en'>>(Object.fromEntries(LEGAL_DOCS.map((d) => [d.key, 'vi'])))

const empty = (): LegalDoc => ({ title: { vi: '', en: '' }, updated: { vi: '', en: '' }, body: { vi: '', en: '' } })
/** Bản đang hiển thị: phần đã sửa, chỗ nào trống thì lấy bản mặc định. */
function merged(key: string): LegalDoc {
  const def = a.defaults!.legal?.[key] || empty()
  const cur: Partial<LegalDoc> = a.content!.legal[key] || {}
  const out = empty()
  for (const f of ['title', 'updated', 'body'] as const) for (const lg of ['vi', 'en'] as const) out[f][lg] = cur[f]?.[lg] || def[f]?.[lg] || ''
  return out
}
function ensure(key: string): LegalDoc {
  const l = a.content!.legal
  if (!l[key]) l[key] = a.cloneOf(merged(key))
  return l[key]
}
function setF(key: string, f: 'title' | 'updated' | 'body', lg: 'vi' | 'en', v: string) { ensure(key)[f][lg] = v }
function reset(key: string, label: string) {
  if (!confirm('Khôi phục "' + label + '" về bản mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) return
  delete a.content!.legal[key]
}
const docs = computed(() => LEGALS.map(([key, label, slug]) => ({ key, label, slug, d: merged(key) })))
</script>

<template>
  <div class="panel help">
    <h2>Điều khoản và các chính sách của website</h2>
    <p class="sub">8 trang chính sách theo hồ sơ thông báo website với Bộ Công Thương (bảo mật, khiếu nại, giá, thanh toán, điều kiện dịch vụ, cung cấp và hoàn tiền, hỗ trợ, điều khoản). Mỗi trang có nút Tải PDF trên website, tạo từ đúng nội dung ở đây; trang <a :href="siteUrl + '/chinh-sach'" target="_blank" rel="noopener">/chinh-sach</a> có nút tải tất cả trong một file. Sửa xong bấm "Lưu và đăng lên website".</p>
    <ul>
      <li><b>Định dạng</b>: dòng trống để tách đoạn; <b>## Tiêu đề</b> cho mục lớn, <b>### </b> cho mục nhỏ; <b>- </b> đầu dòng để tạo danh sách; <b>**chữ đậm**</b>; <b>[chữ hiển thị](https://...)</b> để chèn liên kết.</li>
      <li v-pre>Mã <b>{{price_list}}</b> (trong Chính sách giá) tự thay bằng danh sách gói và giá hiện hành ở tab Báo giá.</li>
      <li v-pre>Các mã như <b>{{company_name}}</b>, <b>{{tax_id}}</b>, <b>{{address}}</b>, <b>{{email}}</b>, <b>{{hotline}}</b>, <b>{{parent_url}}</b> tự thay bằng thông tin trong mục Cài đặt.</li>
      <li>Nội dung mặc định là bản mẫu để bạn chỉnh. Nên để luật sư hoặc bộ phận pháp chế xem lại trước khi dùng chính thức.</li>
    </ul>
  </div>
  <div v-for="g in docs" :key="g.key" class="panel">
    <div class="bar" style="margin:0 0 6px">
      <h2 style="margin:0;flex:1">{{ g.label }}</h2>
      <a class="btn gh sm" :href="siteUrl + '/' + g.slug" target="_blank" rel="noopener">Xem trên website ↗</a>
      <a class="btn gh sm" :href="siteUrl + '/api/legal/' + g.key + '.pdf'" target="_blank" rel="noopener">PDF (bản đã lưu)</a>
      <button class="btn gh sm" type="button" @click="reset(g.key, g.label)">Về bản mặc định</button>
    </div>
    <div class="row2" style="margin-top:10px">
      <label class="f">Tiêu đề (Tiếng Việt)<input :value="g.d.title.vi" type="text" @input="setF(g.key, 'title', 'vi', ($event.target as HTMLInputElement).value)"></label>
      <label class="f">Title (English)<input :value="g.d.title.en" type="text" @input="setF(g.key, 'title', 'en', ($event.target as HTMLInputElement).value)"></label>
    </div>
    <div class="row2" style="margin-top:12px">
      <label class="f">Ngày cập nhật (Tiếng Việt)<input :value="g.d.updated.vi" type="text" @input="setF(g.key, 'updated', 'vi', ($event.target as HTMLInputElement).value)"></label>
      <label class="f">Last updated (English)<input :value="g.d.updated.en" type="text" @input="setF(g.key, 'updated', 'en', ($event.target as HTMLInputElement).value)"></label>
    </div>
    <div class="row2" style="margin-top:12px">
      <label class="f">Nội dung (Tiếng Việt)<textarea class="tall" rows="22" :value="g.d.body.vi" @input="setF(g.key, 'body', 'vi', ($event.target as HTMLTextAreaElement).value)" /></label>
      <label class="f">Content (English)<textarea class="tall" rows="22" :value="g.d.body.en" @input="setF(g.key, 'body', 'en', ($event.target as HTMLTextAreaElement).value)" /></label>
    </div>
    <div style="margin-top:16px;display:grid;gap:12px">
      <div class="chips">
        <button type="button" :aria-pressed="view[g.key] === 'vi'" @click="view[g.key] = 'vi'">Xem trước: Tiếng Việt</button>
        <button type="button" :aria-pressed="view[g.key] === 'en'" @click="view[g.key] = 'en'">Xem trước: English</button>
      </div>
      <div class="legalprev">
        <h1>{{ g.d.title[view[g.key]] }}</h1>
        <p class="lupd">{{ view[g.key] === 'en' ? 'Last updated: ' : 'Cập nhật lần cuối: ' }}{{ g.d.updated[view[g.key]] }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="lbody" v-html="renderLegal(fillTokens(g.d.body[view[g.key]] || '', (k) => a.content!.settings[k] || DEF_SETTINGS[k] || ''))" />
      </div>
    </div>
  </div>
</template>
