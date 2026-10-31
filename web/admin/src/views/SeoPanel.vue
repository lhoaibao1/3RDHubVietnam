<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAdmin } from '../store'
import seo from '../../../scripts/seo.json'

// SEO: mã xác minh của Google/Bing/Cốc Cốc/Facebook/Zalo và tiêu đề, mô tả riêng từng trang.
// Máy chủ chèn vào HTML ngay khi trả trang (Google, Facebook, Zalo đều đọc được), xem server/seo.go.
const a = useAdmin()
const S = () => a.content!.settings
const PAGES = seo.pages as Record<string, { title: string; desc: string; title_en: string; desc_en: string }>
const lg = ref<'vi' | 'en'>('vi') // ngôn ngữ đang sửa
const K = (b: 'seot_' | 'seod_', p: { key: string }) => (lg.value === 'en' ? b + 'en_' : b) + p.key
const pages = Object.entries(PAGES).map(([slug, p]) => ({ slug, key: slug || 'home', path: '/' + slug, ...p }))
const siteBase = location.protocol + '//' + location.host.replace(/^cms\./, '')
const host = siteBase.replace(/^https?:\/\//, '')

const verifies = [
  { key: 'verify_google', name: 'Google Search Console', how: 'Search Console → Thêm tài sản → Tiền tố URL → Thẻ HTML. Dán nguyên thẻ <meta> hoặc chỉ mã trong content="...".', url: 'https://search.google.com/search-console' },
  { key: 'verify_bing', name: 'Bing Webmaster Tools', how: 'Bing Webmaster → Add site → Thẻ HTML meta (msvalidate.01). Hoặc nhập từ Google Search Console, không cần mã.', url: 'https://www.bing.com/webmasters' },
  { key: 'verify_coccoc', name: 'Cốc Cốc Webmaster', how: 'Cốc Cốc Webmaster → Thêm website → xác minh bằng thẻ meta coccoc-verification.', url: 'https://webmaster.coccoc.com' },
  { key: 'verify_facebook', name: 'Facebook (Meta Business)', how: 'Business Settings → Brand safety → Domains → Thêm tên miền → thẻ meta facebook-domain-verification.', url: 'https://business.facebook.com/settings/owned-domains' },
  { key: 'verify_zalo', name: 'Zalo (Zalo for Developers)', how: 'Ứng dụng → Xác thực tên miền → chọn cách thẻ meta zalo-platform-site-verification.', url: 'https://developers.zalo.me' },
]
function setS(k: string, v: string) { const t = v.trim(); if (t) S()[k] = t; else delete S()[k] }
/** Chỉ lấy mã trong content="..." khi người dùng dán nguyên thẻ meta. */
function setVerify(k: string, v: string) { const m = v.match(/content\s*=\s*["']([^"']*)["']/); setS(k, m ? m[1] : v) }

const open = ref<string | null>(null)
const q = ref('')
const shown = computed(() => pages.filter((p) => !q.value || (p.title + p.slug).toLowerCase().includes(q.value.toLowerCase())))
const title = (p: (typeof pages)[number]) => lg.value === 'en' ? S()[K('seot_', p)] || p.title_en : S()[K('seot_', p)] || (p.key === 'home' && S().site_title) || p.title
const desc = (p: (typeof pages)[number]) => lg.value === 'en' ? S()[K('seod_', p)] || p.desc_en : S()[K('seod_', p)] || (p.key === 'home' && (S().meta_description || '').replace(/\s+/g, ' ')) || p.desc
const edited = (p: (typeof pages)[number]) => !!(S()['seot_' + p.key] || S()['seod_' + p.key] || S()['seot_en_' + p.key] || S()['seod_en_' + p.key])
const lenCls = (n: number, lo: number, hi: number) => (n === 0 ? '' : n < lo ? 'warn' : n > hi ? 'bad' : 'ok')
</script>

<template>
  <div class="panel">
    <h2>Xác minh website với Google, Bing, Cốc Cốc...</h2>
    <p class="sub">Để website lên Google nhanh và theo dõi được thứ hạng, hãy thêm website vào các công cụ dưới đây. Mỗi nơi cho bạn một thẻ <code>&lt;meta&gt;</code> để xác minh: dán vào ô tương ứng, bấm Lưu, rồi quay lại bấm "Xác minh" bên đó. Không cần sửa code.</p>
    <div class="seov">
      <label v-for="v in verifies" :key="v.key" class="f">
        <span><b>{{ v.name }}</b> <a :href="v.url" target="_blank" rel="noopener">mở ↗</a></span>
        <input type="text" :value="S()[v.key] || ''" placeholder="Dán thẻ meta hoặc mã xác minh" spellcheck="false" @change="setVerify(v.key, ($event.target as HTMLInputElement).value)">
        <small>{{ v.how }}</small>
      </label>
    </div>
    <div class="seotools">
      <b>Sau khi xác minh xong:</b> trong Google Search Console (và Bing, Cốc Cốc) vào mục <i>Sơ đồ trang web / Sitemaps</i>, gửi địa chỉ
      <a :href="siteBase + '/sitemap.xml'" target="_blank" rel="noopener"><code>{{ host }}/sitemap.xml</code></a>.
      Kiểm tra thêm: <a :href="siteBase + '/robots.txt'" target="_blank" rel="noopener">robots.txt</a> ·
      <a :href="'https://search.google.com/test/rich-results?url=' + encodeURIComponent(siteBase + '/hoi-dap')" target="_blank" rel="noopener">Kiểm tra dữ liệu có cấu trúc</a> ·
      <a :href="'https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(siteBase + '/')" target="_blank" rel="noopener">PageSpeed</a> ·
      <a :href="'https://developers.facebook.com/tools/debug/?q=' + encodeURIComponent(siteBase + '/')" target="_blank" rel="noopener">Xem trước khi chia sẻ Facebook</a>
    </div>
  </div>

  <div class="panel">
    <h2>Tiêu đề và mô tả từng trang</h2>
    <p class="sub">Đây là dòng chữ xanh và đoạn mô tả hiện trên Google, và khi chia sẻ link lên Facebook, Zalo. Để trống thì dùng bản mặc định (hiện mờ trong ô). Nên viết tiêu đề 30 đến 60 ký tự, mô tả 120 đến 160 ký tự, có từ khoá khách hay tìm.</p>
    <div class="seolg" role="tablist" aria-label="Ngôn ngữ đang sửa">
      <button type="button" role="tab" :aria-selected="lg === 'vi'" :class="{ on: lg === 'vi' }" @click="lg = 'vi'">Tiếng Việt <small>/vi</small></button>
      <button type="button" role="tab" :aria-selected="lg === 'en'" :class="{ on: lg === 'en' }" @click="lg = 'en'">English <small>/en</small></button>
    </div>
    <p v-if="lg === 'en'" class="sub">Bản tiếng Anh hiện khi khách mở link <code>/en/...</code> (và cho Google tiếng Anh). Để trống bản English thì hệ thống <b>tự dịch từ tiếng Việt khi bạn bấm Lưu</b>; bạn tự gõ thì được giữ nguyên.</p>
    <input v-model="q" type="search" class="seoq" placeholder="Tìm trang...">
    <div class="seopages">
      <div v-for="p in shown" :key="p.key" class="seop" :class="{ on: open === p.key }">
        <button type="button" class="seoh" :aria-expanded="open === p.key" @click="open = open === p.key ? null : p.key">
          <span class="serp">
            <small>{{ host }}{{ p.path === '/' ? '' : ' › ' + p.slug }}</small>
            <b>{{ title(p) }}</b>
            <span>{{ desc(p) }}</span>
          </span>
          <em v-if="edited(p)">đã sửa</em>
        </button>
        <div v-if="open === p.key" class="seof">
          <label class="f">Tiêu đề <small :class="lenCls((S()[K('seot_', p)] || '').length, 30, 60)">{{ (S()[K('seot_', p)] || '').length }}/60</small>
            <input type="text" maxlength="120" :value="S()[K('seot_', p)] || ''" :placeholder="lg === 'en' ? p.title_en : p.title" @input="setS(K('seot_', p), ($event.target as HTMLInputElement).value)"></label>
          <label class="f">Mô tả <small :class="lenCls((S()[K('seod_', p)] || '').length, 120, 160)">{{ (S()[K('seod_', p)] || '').length }}/160</small>
            <textarea rows="3" maxlength="320" :value="S()[K('seod_', p)] || ''" :placeholder="lg === 'en' ? p.desc_en : p.desc" @input="setS(K('seod_', p), ($event.target as HTMLTextAreaElement).value.replace(/\s*\n\s*/g, ' '))"></textarea></label>
          <a class="btn gh sm" :href="siteBase + '/' + lg + p.path" target="_blank" rel="noopener">Mở trang</a>
        </div>
      </div>
    </div>
  </div>
</template>
