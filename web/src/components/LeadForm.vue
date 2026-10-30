<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useSite } from '@/stores/site'

// Form tư vấn cho Advertiser: gửi về /api/lead (CMS); nếu máy chủ không nhận thì mở email soạn sẵn.
const props = defineProps<{ variant: 'home' | 'page'; need?: string; prefill?: string }>()
const site = useSite()

const NEEDS: { n: string; home: string; page: string }[] = [
  { n: 'Chạy chiến dịch trên 3RDHub', home: 'Chạy chiến dịch trên 3RDHub', page: 'Chạy chiến dịch' },
  { n: 'Xây hệ thống affiliate riêng', home: 'Xây hệ thống riêng', page: 'Hệ thống riêng' },
  { n: 'Nhận bản quyền 3RDHub', home: 'Nhận bản quyền 3RDHub', page: 'Bản quyền 3RDHub' },
  { n: 'Nhận báo giá hệ thống', home: 'Nhận báo giá', page: 'Báo giá' },
  { n: 'Đăng ký dùng thử', home: 'Dùng thử 3RDVN HUB', page: 'Dùng thử' },
]
const need = ref(NEEDS.find((o) => o.n === props.need)?.n || NEEDS[0].n)
const f = reactive({ name: '', phone: '', email: '', company: '', msg: '', website: '' })
watch(() => [props.prefill, props.need], () => { const v = props.prefill; if (props.need) need.value = props.need; if (v) { f.msg = site.t('Tôi quan tâm đến') + ' ' + v + '.' } })
const busy = ref(false)
const msg = ref('')
const msgClass = ref('')
const nameEl = ref<HTMLInputElement | null>(null)
const phoneEl = ref<HTMLInputElement | null>(null)
const pre = props.variant === 'home' ? 'f' : 'g'

function say(text: string, cls = '') { msg.value = text; msgClass.value = cls }

function mailFallback() {
  const body = `Nhu cầu: ${need.value}\nHọ và tên: ${f.name.trim()}\nSố điện thoại: ${f.phone.trim()}\nCông ty: ${f.company.trim()}\n\n${f.msg.trim()}`
  location.href = `mailto:${site.S('email')}?subject=${encodeURIComponent('[3RDHub] ' + need.value)}&body=${encodeURIComponent(body)}`
  say(site.t('Đã mở ứng dụng email với nội dung soạn sẵn. Nếu không thấy, hãy gọi số hotline trên trang này.'), 'ok')
}

async function submit() {
  say('')
  if (f.name.trim().length < 2) { say(site.t('Nhập họ và tên.'), 'err2'); nameEl.value?.focus(); return }
  if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { say(site.t('Email không hợp lệ.'), 'err2'); return }
  if (f.phone.replace(/\D/g, '').length < 9) { say(site.t('Số điện thoại cần ít nhất 9 chữ số.'), 'err2'); phoneEl.value?.focus(); return }
  if (location.protocol === 'file:' || !window.fetch) { mailFallback(); return }
  busy.value = true
  say(site.t('Đang gửi...'))
  try {
    const r = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.name.trim(), phone: f.phone.trim(), company: f.company.trim(), email: f.email.trim(), need: need.value, message: f.msg.trim(), website: f.website, lang: site.lang }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j.ok) {
      say(site.t('Cảm ơn bạn! Yêu cầu đã được gửi, đội ngũ 3RDVN Technology sẽ liên hệ sớm.'), 'ok')
      f.name = f.phone = f.email = f.company = f.msg = ''
    } else if (r.status === 400 || r.status === 429) {
      say(j.error || site.t('Chưa gửi được, vui lòng thử lại.'), 'err2')
    } else mailFallback()
  } catch {
    mailFallback()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form :id="variant === 'page' ? 'form2' : 'form'" :class="{ cd: variant === 'page' }" novalidate @submit.prevent="submit">
    <div v-if="variant === 'home'"><div class="k2">Advertiser</div><h3>Chạy chiến dịch hoặc xây hệ thống affiliate</h3></div>
    <div v-else><div class="k2">Advertiser</div><h2>Gửi yêu cầu tư vấn</h2></div>
    <div class="need" role="group" aria-label="Nhu cầu">
      <button v-for="o in NEEDS" :key="o.n" type="button" :aria-pressed="need === o.n" @click="need = o.n">{{ $t(variant === 'home' ? o.home : o.page) }}</button>
    </div>
    <div class="two">
      <label :for="pre + '1'">Họ và tên<input :id="pre + '1'" ref="nameEl" v-model="f.name" name="name" autocomplete="name"></label>
      <label :for="pre + '2'">Số điện thoại<input :id="pre + '2'" ref="phoneEl" v-model="f.phone" name="phone" type="tel" autocomplete="tel"></label>
    </div>
    <label :for="pre + '5'">Email (để nhận xác nhận)<input :id="pre + '5'" v-model="f.email" name="email" type="email" autocomplete="email" placeholder="ban@congty.vn"></label>
    <label :for="pre + '3'">Công ty<input :id="pre + '3'" v-model="f.company" name="company" placeholder="Tên công ty, sản phẩm cần chạy"></label>
    <input v-model="f.website" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    <label :for="pre + '4'">Nội dung<textarea :id="pre + '4'" v-model="f.msg" name="msg" placeholder="Sản phẩm, số lượng publisher dự kiến, thời gian mong muốn" /></label>
    <button class="btn or" type="submit" :disabled="busy">Gửi yêu cầu</button>
    <p class="msg" :class="msgClass" aria-live="polite">{{ msg }}</p>
  </form>
</template>
