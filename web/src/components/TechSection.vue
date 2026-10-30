<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createDevScene } from '@/three/devscene'
import { useTerminal } from '@/composables/useTerminal'
import { useSite } from '@/stores/site'

const STEPS = ['Khởi tạo', 'Viết API', 'Kiểm thử', 'Build', 'Triển khai']
const devCanvas = ref<HTMLCanvasElement | null>(null)
const term = ref<HTMLElement | null>(null)
const tout = ref<HTMLElement | null>(null)
const terminal = useTerminal(term, tout)
let scene: { dispose(): void } | null = null
const site = useSite()
// Kiểu cảnh 3D khác "Cổ điển": khu này dùng cảnh Công nghệ của chính kiểu đó cho đồng bộ với cả trang
const style = computed(() => site.sceneStyle)
let gen = 0

async function build() {
  const my = ++gen
  scene?.dispose(); scene = null
  if (!devCanvas.value) return
  try {
    if (style.value === 'classic') scene = createDevScene(devCanvas.value, terminal.source)
    else {
      const h = (await import('@/three/styles/host')).createHost(devCanvas.value, style.value as never, { side: false })
      if (my !== gen) { h.dispose(); return }
      h.show('cong-nghe'); h.tour(true); scene = h
    }
  } catch (e) {
    console.error(e)
  }
}
onMounted(build)
watch(style, build, { flush: 'post' })
onBeforeUnmount(() => { gen++; scene?.dispose() })
</script>

<template>
<section class="w tech" id="cong-nghe">
  <div class="th"><div><div class="k2">Công nghệ</div><h2>Frontend Vue.js, backend Go.</h2></div><p class="lead">Giao diện nhanh, dễ mở rộng cho cộng tác viên và quản trị viên. Backend Go xử lý lượt bấm, postback và đối soát với độ trễ thấp, chịu được lưu lượng lớn khi chiến dịch bùng nổ.</p>
      <RouterLink class="more" to="/cong-nghe">Xem chi tiết →</RouterLink></div>
  <div class="arch">
    <svg class="flow" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
      <path id="fl1" d="M250 110 C 330 110 340 150 420 150"/><path id="fl2" d="M580 150 C 660 150 670 110 750 110"/><path id="fl3" d="M250 230 C 330 230 340 160 420 160"/><path id="fl4" d="M580 160 C 660 160 670 230 750 230"/>
      <circle r="6"><animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#fl1"/></animateMotion></circle>
      <circle r="6"><animateMotion dur="1.8s" begin=".6s" repeatCount="indefinite"><mpath href="#fl2"/></animateMotion></circle>
      <circle r="6" class="b"><animateMotion dur="2.2s" begin=".3s" repeatCount="indefinite"><mpath href="#fl3"/></animateMotion></circle>
      <circle r="6" class="b"><animateMotion dur="2.2s" begin="1s" repeatCount="indefinite"><mpath href="#fl4"/></animateMotion></circle>
    </svg>
    <div class="col">
      <div class="node fe"><i class="dot" style="background:#42B883"></i><b>Website publisher</b><span>Vue.js, Nuxt</span></div>
      <div class="node fe"><i class="dot" style="background:#42B883"></i><b>Trang quản trị</b><span>Vue.js, TypeScript</span></div>
    </div>
    <div class="col mid"><div class="node core"><i class="dot" style="background:#00ADD8"></i><b>API Go</b><span>Tracking click, postback, đối soát</span></div></div>
    <div class="col">
      <div class="node db"><i class="dot" style="background:#336791"></i><b>Cơ sở dữ liệu</b><span>PostgreSQL, Redis</span></div>
      <div class="node db"><i class="dot" style="background:#FF6A2B"></i><b>Đối tác Advertiser</b><span>Postback, webhook</span></div>
    </div>
  </div>
  <div class="dev">
    <div class="dev-stage" :class="{ styled: style !== 'classic' }"><canvas id="gl3" :key="style" ref="devCanvas" aria-label="Cảnh 3D: robot 3RDVN đang lập trình hệ thống affiliate"></canvas>
      <div class="ft" style="left:6%;top:10%"><b>Vue.js</b><span>Giao diện publisher, quản trị</span></div>
      <div class="ft" style="left:30%;top:4%"><b>Go</b><span>API, tracking, postback</span></div>
    </div>
    <div ref="term" class="term" aria-label="Terminal minh hoạ quá trình lập trình">
      <div class="tb"><i></i><i></i><i></i><span>~/3rdhub-affiliate</span><em>{{ $t(terminal.finished.value ? 'đã triển khai' : 'đang code') }}</em></div>
      <pre ref="tout" v-html="terminal.html.value"></pre>
      <div class="tsteps">
        <span v-for="(s, j) in STEPS" :key="s" :class="{ on: j === terminal.step.value && !terminal.finished.value, done: j < terminal.step.value || terminal.finished.value }">{{ $t(s) }}</span>
      </div>
    </div>
  </div>
  <div class="stack2">
    <div class="sc2"><h3>Frontend</h3><div class="chips"><span><i style="background:#42B883"></i>Vue.js</span><span><i style="background:#00DC82"></i>Nuxt</span><span><i style="background:#3178C6"></i>TypeScript</span><span><i style="background:#FFD859"></i>Pinia</span><span><i style="background:#38BDF8"></i>Tailwind CSS</span><span><i style="background:#646CFF"></i>Vite</span></div><p>Giao diện responsive cho điện thoại, trang chiến dịch tải nhanh, bảng báo cáo cập nhật theo thời gian thực.</p></div>
    <div class="sc2"><h3>Backend</h3><div class="chips"><span><i style="background:#00ADD8"></i>Go</span><span><i style="background:#0B2A6F"></i>REST API</span><span><i style="background:#336791"></i>PostgreSQL</span><span><i style="background:#DC382D"></i>Redis</span><span><i style="background:#2496ED"></i>Docker</span><span><i style="background:#009639"></i>Nginx</span></div><p>Ghi nhận lượt bấm và postback tức thời, phân quyền theo vai trò, API key riêng cho từng đối tác và môi trường test tách biệt.</p></div>
    <div class="sc2 dk"><h3>Bạn nhận được</h3><ul><li>Website và trang quản trị mang thương hiệu riêng</li><li>Tài liệu API cho đối tác kết nối</li><li>Tài liệu bàn giao và hướng dẫn vận hành</li><li>Lộ trình nâng cấp theo từng giai đoạn</li></ul><a class="btn or" href="#lien-he">Nhận tư vấn xây hệ thống</a></div>
  </div>
</section>
</template>
