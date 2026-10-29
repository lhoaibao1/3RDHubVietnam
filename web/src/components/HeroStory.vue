<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { createHero, type Hero } from '@/three/hero'
import { RM } from '@/three/core'
import { useSite } from '@/stores/site'

const site = useSite()
const NAMES = ['Tổng quan', 'Advertiser', '3RDHub', 'Publisher', 'Khách hàng', 'Hoa hồng']
const DUR = [4200, 5200, 5200, 5200, 5200, 5200]

const pin = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const tag = ref<HTMLElement | null>(null)
const steps = ref<HTMLElement | null>(null)
const rails = ref<HTMLButtonElement[]>([])
const cur = ref(0)
const playing = !RM  // tự chạy, tôn trọng "giảm chuyển động"
const tagK = ref(1)
const tagLabel = ref('Advertiser')

let hero: Hero | null = null
let stepT = 0
let raf = 0

function go(k: number) {
  cur.value = k
  stepT = 0
  hero?.go(k)
}

onMounted(() => {
  try {
    hero = createHero(canvas.value!, tag.value!, { onTag(k, label) { tagK.value = k; tagLabel.value = label } })
  } catch (e) {
    console.error(e)
  }
  let last = performance.now()
  const tick = (n: number) => {
    raf = requestAnimationFrame(tick)
    const d = Math.min(100, n - last)
    last = n
    const k = cur.value
    if ((!hero || hero.visible()) && playing) {
      stepT += d
      if (stepT >= DUR[k]) go((k + 1) % NAMES.length)
    }
    rails.value.forEach((bt, j) => bt.style.setProperty('--f', String(j < k ? 1 : j === k ? Math.min(1, stepT / DUR[k]).toFixed(3) : 0)))
  }
  raf = requestAnimationFrame(tick)
  if (steps.value) gsap.from(steps.value.querySelectorAll('.st.on > *'), { y: 26, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', delay: 0.15 })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  hero?.dispose()
})
</script>

<template>
<section class="story" id="mo-hinh">
  <div ref="pin" class="pin">
    <canvas id="gl" ref="canvas" aria-label="Cảnh 3D mô hình tiếp thị liên kết: doanh nghiệp, 3RDHub, publisher, khách hàng, hoa hồng"></canvas>
    <div ref="tag" class="tag"><b>{{ tagK }}</b><span>{{ site.t(tagLabel) }}</span></div>
    <div class="panel">
      <div id="steps" ref="steps" class="steps">
        <article class="st" :class="{ on: cur === 0 }" :aria-hidden="cur !== 0"><div class="k">3RDHub Vietnam, thuộc 3RDVN Technology</div><h1><span>Tiếp thị liên kết,</span><span class="o">minh bạch từng đồng.</span></h1><p>Nền tảng kết nối Advertiser tài chính với mạng lưới publisher. Mỗi lượt bấm, mỗi hồ sơ và mỗi đồng hoa hồng đều được ghi nhận. Xem cảnh 3D tự chạy qua từng bước của một hồ sơ.</p><div class="acts"><a class="btn or" :href="site.S('signup_url')" target="_blank" rel="noopener">Đăng ký làm publisher</a><a class="btn gh" href="#doanh-nghiep">Dành cho Advertiser</a></div></article>
        <article class="st" :class="{ on: cur === 1 }" :aria-hidden="cur !== 1"><div class="k">Bước 1, Advertiser</div><h2><span>Advertiser đăng chiến dịch,</span><span class="o">chỉ trả cho kết quả.</span></h2><p>Ngân hàng, công ty tài chính đưa sản phẩm như thẻ tín dụng, vay tiêu dùng lên 3RDHub và đặt mức hoa hồng cho mỗi hồ sơ thành công.</p><div class="mini"><div class="r"><b>Mở thẻ tín dụng</b><span class="pl">Đang chạy</span></div><div class="r"><span class="lb">Đối tác</span><span>SHB Finance</span></div><div class="r"><span class="lb">Tính hoa hồng</span><span>theo hồ sơ được duyệt</span></div></div></article>
        <article class="st" :class="{ on: cur === 2 }" :aria-hidden="cur !== 2"><div class="k">Bước 2, nền tảng 3RDHub</div><h2><span>Mỗi publisher một link,</span><span class="o">mỗi link một mã.</span></h2><p>3RDHub tạo link riêng gắn mã của bạn, nên mọi lượt bấm và hồ sơ đều về đúng người giới thiệu.</p><div class="mini"><span class="lb">Link của bạn</span><div class="url">3rdvn.io.vn/aff/shb-finance?ref=<em>RD260001</em></div></div></article>
        <article class="st" :class="{ on: cur === 3 }" :aria-hidden="cur !== 3"><div class="k">Bước 3, publisher</div><h2><span>Chia sẻ lên kênh,</span><span class="o">khách tìm đến bạn.</span></h2><p>Đăng link lên TikTok, Facebook, nhóm Zalo hay gửi cho khách quen. Báo cáo lượt bấm theo từng kênh ngay trên app.</p><div class="mini"><div class="r"><b>Lượt bấm hôm nay</b><span class="pl w">Thời gian thực</span></div><div class="r"><span class="lb">TikTok, Facebook, Zalo</span><span class="lb">theo Sub ID</span></div></div></article>
        <article class="st" :class="{ on: cur === 4 }" :aria-hidden="cur !== 4"><div class="k">Bước 4, khách hàng</div><h2><span>Khách đăng ký,</span><span class="o">đối tác duyệt hồ sơ.</span></h2><p>Khách điền thông tin trên trang của đối tác. Trạng thái hồ sơ cập nhật về 3RDHub qua postback, bạn thấy ngay.</p><div class="mini"><div class="r"><span>Hồ sơ #A-1042</span><span class="pl w">Chờ duyệt</span></div><div class="r"><span>Hồ sơ #A-1039</span><span class="pl">Đã duyệt</span></div></div></article>
        <article class="st" :class="{ on: cur === 5 }" :aria-hidden="cur !== 5"><div class="k">Bước 5, hoa hồng</div><h2><span>Hồ sơ được duyệt,</span><span class="o">tiền về ví.</span></h2><p>Hoa hồng cộng vào số dư sau đối soát. Bạn gửi yêu cầu rút và theo dõi trạng thái duyệt rút tiền.</p><div class="mini"><div class="r"><span class="lb">Số dư ví hoa hồng</span><b>12.450.000đ</b></div><div class="r"><span>Yêu cầu rút #W-208</span><span class="pl">Đã chuyển</span></div></div><div class="acts"><a class="btn or" :href="site.S('signup_url')" target="_blank" rel="noopener">Bắt đầu làm publisher</a></div></article>
      </div>
    </div>
    <div class="rail">
      <button v-for="(n, i) in NAMES" :key="n" ref="rails" type="button" :class="{ on: cur === i }" :aria-label="$t(n)" @click="go(i)">{{ $t(n) }}</button>
    </div>
  </div>
</section>
</template>
