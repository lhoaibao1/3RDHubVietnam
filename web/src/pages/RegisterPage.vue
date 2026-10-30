<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSite } from '@/stores/site'

// Trang Đăng ký sản phẩm (/dang-ky): khách đăng ký sản phẩm (vay, thẻ...) rồi nhận mã để nhắn vào Zalo OA.
// Trình duyệt chỉ gọi /api/products và /api/register của trang này; backend chuyển tiếp sang 3RDHub kèm khoá.
// Không đưa họ tên, số điện thoại hay dữ liệu khách vào analytics hay log.
interface Product { code: string; name: string; partner: string }
interface Done { code: string; zalo_url: string; expires_at: string; product_name: string }
type Field = 'full_name' | 'phone' | 'product_code' | 'consent'

const site = useSite()
const route = useRoute()
const products = ref<Product[]>([])
const listErr = ref('')
const f = reactive({ full_name: '', phone: '', product_code: '', province: '', note: '', consent: false, website: '' })
const errs = reactive<Partial<Record<Field, string>>>({})
const formErr = ref('')
const busy = ref(false)
const done = ref<Done | null>(null)
const copied = ref(false)
const consentText = ref<HTMLElement | null>(null)
const doneHead = ref<HTMLElement | null>(null)
const codeBox = ref<HTMLInputElement | null>(null)

const q = (k: string) => { const v = route.query[k]; return (Array.isArray(v) ? v[0] : v) || '' }

/** Bỏ khoảng trắng, dấu chấm, gạch; đổi +84 thành 0 (giống backend). */
function normPhone(s: string) {
  let p = s.replace(/[\s.\-() ]/g, '')
  if (p.startsWith('+84')) p = '0' + p.slice(3)
  else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2)
  return p
}

onMounted(async () => {
  try {
    const r = await fetch('/api/products', { headers: { Accept: 'application/json' } })
    const j = await r.json().catch(() => ({}))
    if (r.ok && Array.isArray(j.data)) {
      products.value = j.data
      const want = q('product')
      if (want && j.data.some((p: Product) => p.code === want)) f.product_code = want
      if (!j.data.length) listErr.value = site.t('Hiện chưa có sản phẩm nhận đăng ký. Vui lòng gọi hotline trên trang.')
    } else listErr.value = j.error?.message || site.t('Chưa lấy được danh sách sản phẩm. Tải lại trang hoặc gọi hotline trên trang.')
  } catch {
    listErr.value = site.t('Không kết nối được. Kiểm tra mạng rồi tải lại trang.')
  }
})

function check(): Field | '' {
  for (const k of Object.keys(errs) as Field[]) delete errs[k]
  if (f.full_name.trim().length < 2) errs.full_name = site.t('Nhập họ và tên của bạn (ít nhất 2 ký tự).')
  f.phone = normPhone(f.phone)
  if (!/^0[35789]\d{8}$/.test(f.phone)) errs.phone = site.t('Số điện thoại chưa đúng. Nhập số di động 10 chữ số, bắt đầu bằng 0, ví dụ 0912345678.')
  if (!f.product_code) errs.product_code = site.t('Chọn sản phẩm bạn muốn đăng ký.')
  if (!f.consent) errs.consent = site.t('Bạn cần tích vào ô đồng ý để chúng tôi được liên hệ tư vấn.')
  return (['full_name', 'phone', 'product_code', 'consent'] as Field[]).find((k) => errs[k]) || ''
}
function focusField(k: string) { document.getElementById('rg-' + k)?.focus() }

async function submit() {
  formErr.value = ''
  const bad = check()
  if (bad) { focusField(bad); return }
  busy.value = true
  try {
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        full_name: f.full_name.trim(), phone: f.phone, product_code: f.product_code, province: f.province.trim(), note: f.note.trim(),
        consent: f.consent, consent_text: (consentText.value?.textContent || '').replace(/\s+/g, ' ').trim(),
        source_url: location.origin + location.pathname + location.search,
        utm: { source: q('utm_source'), medium: q('utm_medium'), campaign: q('utm_campaign'), content: q('utm_content'), term: q('utm_term') },
        ref: q('ref'), website: f.website,
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.status === 201 && j.data?.code) {
      done.value = j.data
      // chỉ ghi sự kiện kèm mã sản phẩm, không kèm dữ liệu cá nhân (và chỉ khi khách đã đồng ý cookie phân tích)
      const g = (window as any).gtag
      if (typeof g === 'function') g('event', 'lead_submitted', { product_code: f.product_code })
      await nextTick()
      doneHead.value?.focus()
      doneHead.value?.scrollIntoView({ block: 'center' })
    } else if (j.error?.field && ['full_name', 'phone', 'product_code', 'consent'].includes(j.error.field)) {
      errs[j.error.field as Field] = j.error.message
      focusField(j.error.field)
    } else formErr.value = j.error?.message || site.t('Chưa gửi được. Vui lòng thử lại sau ít phút hoặc gọi hotline trên trang.')
  } catch {
    formErr.value = site.t('Không gửi được vì mất kết nối mạng. Kiểm tra mạng rồi bấm Gửi đăng ký lần nữa.')
  } finally {
    busy.value = false
  }
}

async function copy() {
  const code = done.value?.code || ''
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    codeBox.value?.select()
    try { document.execCommand('copy') } catch { /* bỏ qua */ }
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 4000)
}

const expiry = computed(() => {
  const s = done.value?.expires_at
  const d = s ? new Date(s) : null
  if (!d || isNaN(d.getTime())) return ''
  return d.toLocaleString(site.lang === 'en' ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
})
</script>

<template>
<section class="w pg rgpg" id="p-dang-ky">
  <div class="rgwrap">
    <div class="rgintro">
      <div class="k2">3RDHub Vietnam</div>
      <h1>Đăng ký sản phẩm, <span class="o">theo dõi hồ sơ qua Zalo.</span></h1>
      <p class="lead">Để lại thông tin, nhân viên tư vấn sẽ liên hệ bạn. Sau khi gửi, bạn nhận một mã để theo dõi hồ sơ qua Zalo.</p>
    </div>

    <form v-if="!done" class="rgform" novalidate @submit.prevent="submit">
      <h2>Thông tin đăng ký</h2>
      <label for="rg-full_name">Họ và tên<input id="rg-full_name" v-model="f.full_name" name="full_name" autocomplete="name" maxlength="100" required :aria-invalid="!!errs.full_name" aria-describedby="rg-e-full_name"></label>
      <p v-if="errs.full_name" id="rg-e-full_name" class="rgerr">{{ errs.full_name }}</p>

      <label for="rg-phone">Số điện thoại<input id="rg-phone" v-model="f.phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="0912345678" required :aria-invalid="!!errs.phone" aria-describedby="rg-e-phone"></label>
      <p v-if="errs.phone" id="rg-e-phone" class="rgerr">{{ errs.phone }}</p>

      <label for="rg-product_code">Sản phẩm
        <select id="rg-product_code" v-model="f.product_code" name="product_code" required :aria-invalid="!!errs.product_code" aria-describedby="rg-e-product_code rg-e-list">
          <option value="" disabled>Chọn sản phẩm</option>
          <option v-for="p in products" :key="p.code" :value="p.code">{{ p.name }}</option>
        </select></label>
      <p v-if="errs.product_code" id="rg-e-product_code" class="rgerr">{{ errs.product_code }}</p>
      <p v-if="listErr" id="rg-e-list" class="rgerr">{{ listErr }}</p>

      <div class="two">
        <label for="rg-province">Tỉnh/thành (không bắt buộc)<input id="rg-province" v-model="f.province" name="province" autocomplete="address-level1" maxlength="60"></label>
        <label for="rg-note">Ghi chú (không bắt buộc)<input id="rg-note" v-model="f.note" name="note" maxlength="500"></label>
      </div>
      <input v-model="f.website" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="rghp">

      <label class="rgck" for="rg-consent"><input id="rg-consent" v-model="f.consent" type="checkbox" name="consent" required :aria-invalid="!!errs.consent" aria-describedby="rg-e-consent">
        <span ref="consentText">Tôi đồng ý để 3RDVN và đối tác cho vay/tài chính liên hệ và xử lý thông tin của tôi để tư vấn sản phẩm này, theo <RouterLink to="/bao-mat" target="_blank">Chính sách bảo mật</RouterLink>.</span></label>
      <p v-if="errs.consent" id="rg-e-consent" class="rgerr">{{ errs.consent }}</p>

      <button class="btn or" type="submit" :disabled="busy">Gửi đăng ký</button>
      <p class="rgerr" role="alert">{{ formErr }}</p>
    </form>

    <div v-else class="cd rgdone">
      <h2 ref="doneHead" tabindex="-1">Đã nhận đăng ký của bạn</h2>
      <p v-if="done.product_name" class="rgprod">{{ done.product_name }}</p>
      <div class="rgzalo">
        <h3>Nhận thông báo hồ sơ qua Zalo</h3>
        <div class="rgcode"><span>Mã của bạn</span><b>{{ done.code }}</b><input ref="codeBox" :value="done.code" readonly tabindex="-1" aria-hidden="true" class="rghp"></div>
        <div class="acts">
          <button class="btn or" type="button" @click="copy">Chép mã</button>
          <a v-if="done.zalo_url" class="btn gh" :href="done.zalo_url" target="_blank" rel="noopener">Mở Zalo OA</a>
        </div>
        <p class="rgcopied" aria-live="polite"><template v-if="copied">Đã chép mã vào bộ nhớ tạm.</template></p>
        <ol class="rgsteps">
          <li><span>Bấm</span> <b>Mở Zalo OA</b> <span>và bấm</span> <b>Quan tâm</b>.</li>
          <li><span>Gửi mã</span> <b>{{ done.code }}</b> <span>vào khung chat.</span></li>
          <li>Bạn sẽ nhận tin khi hồ sơ được duyệt, giải ngân.</li>
        </ol>
        <p class="rgnote"><template v-if="expiry"><span>Mã dùng được tới</span> <b>{{ expiry }}</b>. </template><span>Nếu bạn không dùng Zalo, nhân viên sẽ gọi theo số đã đăng ký.</span></p>
      </div>
    </div>
  </div>
</section>
</template>
