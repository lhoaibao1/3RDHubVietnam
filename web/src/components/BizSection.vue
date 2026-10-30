<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import brand from '@/assets/brand.webp'
import { RM } from '@/three/core'
import { useSite } from '@/stores/site'

const site = useSite()
const TABS = ['Tổng quan', 'Chiến dịch', 'Đơn hàng', 'Ví hoa hồng']
const cur = ref(0)
let timer = 0

function auto() {
  clearInterval(timer)
  if (!RM) timer = window.setInterval(() => { cur.value = (cur.value + 1) % TABS.length }, 4200)
}
function show(i: number) {
  cur.value = i
  auto()
}
onMounted(auto)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
<section class="w biz" id="doanh-nghiep">
  <div class="bh">
    <div>
      <div class="k2">Sản phẩm</div>
      <h2><span>Hệ thống affiliate riêng,</span><span class="o">mang thương hiệu của bạn.</span></h2>
      <p class="lead">3RDVN Technology thiết kế và lập trình trọn gói: website cho cộng tác viên, nền tảng quản trị và kết nối với đối tác. 3RDHub Vietnam chính là hệ thống chúng tôi tự xây và đang vận hành.</p>
      <RouterLink class="more" to="/san-pham">Xem chi tiết →</RouterLink> <RouterLink class="more" to="/baogia">Xem báo giá →</RouterLink>
    </div>
    <div class="lyr">
      <div><span class="n">1</span><span><b>Website cho cộng tác viên</b><span>Trang chiến dịch, đăng ký publisher, tạo link, ví hoa hồng, định danh</span></span></div>
      <div><span class="n">2</span><span><b>Hệ thống quản trị</b><span>Chiến dịch, báo cáo click, lead, đơn, đối soát, chia hoa hồng, đội nhóm</span></span></div>
      <div><span class="n">3</span><span><b>Kết nối đối tác</b><span>Postback, API key, môi trường test, tài liệu API</span></span></div>
    </div>
  </div>
  <div class="demo">
    <div class="dtabs" role="tablist" aria-label="Màn hình demo">
      <button v-for="(n, i) in TABS" :key="n" role="tab" :aria-selected="cur === i" @click="show(i)">{{ $t(n) }}</button>
    </div>
    <div class="devices">
      <div class="laptop"><div class="lid"><div class="app">
        <aside class="asb"><div class="alogo"><img :src="brand" alt=""><b>3RDHub</b></div><i :class="{ on: cur === 0 }">Tổng quan</i><i :class="{ on: cur === 1 }">Chiến dịch</i><i>Tạo link</i><i :class="{ on: cur === 2 }">Đơn hàng</i><i :class="{ on: cur === 3 }">Ví hoa hồng</i><i>Đội nhóm</i><i>Tích hợp API</i></aside>
        <div class="amain"><div class="atop"><span>3RDHub Vietnam / <b>{{ site.t(TABS[cur]) }}</b></span><span class="ausr"><i></i>Publisher</span></div>
          <div class="apane" :class="{ on: cur === 0 }">
            <div class="kpi"><div class="kc g"><small>Hoa hồng đã duyệt</small><b>12.450.000đ</b><em>+18% so với tháng trước</em></div><div class="kc"><small>Lượt click</small><b>18.240</b><svg viewBox="0 0 100 30"><path d="M0 26 C15 24 20 12 35 16 S55 4 70 10 S90 2 100 4" fill="none" stroke="#7B4DFF" stroke-width="3"/></svg></div><div class="kc"><small>Đơn hàng</small><b>412</b><svg viewBox="0 0 100 30"><path d="M0 22 C15 26 25 10 40 14 S60 18 75 8 S92 6 100 2" fill="none" stroke="#1BA6D9" stroke-width="3"/></svg></div><div class="kc"><small>Tỷ lệ duyệt</small><b>68%</b><div class="bar"><i style="width:68%"></i></div></div></div>
            <div class="chart"><div class="ch"><b>Click và đơn theo ngày</b><span><i style="background:#7B4DFF"></i>Click <i style="background:#FF6A2B"></i>Đơn</span></div><svg viewBox="0 0 600 160" preserveAspectRatio="none"><path class="ar" d="M0 130 C50 120 80 70 130 80 S220 40 270 60 S360 20 420 35 S520 10 600 18 L600 160 L0 160Z"/><path class="l1" d="M0 130 C50 120 80 70 130 80 S220 40 270 60 S360 20 420 35 S520 10 600 18"/><path class="l2" d="M0 150 C60 140 90 120 140 126 S230 100 280 110 S370 80 430 92 S520 70 600 74"/></svg></div>
          </div>
          <div class="apane" :class="{ on: cur === 1 }">
            <div class="cgrid"><div class="cpg"><i style="background:#EFEAFF;color:#7B4DFF">💳</i><b>Mở thẻ tín dụng</b><span>CPL · theo hồ sơ duyệt</span><em>Đang chạy</em></div><div class="cpg"><i style="background:#E2F5FC;color:#1BA6D9">💰</i><b>Vay tiêu dùng</b><span>CPS · theo khoản vay</span><em>Đang chạy</em></div><div class="cpg"><i style="background:#DFF3EA;color:#14A06A">🛡️</i><b>Bảo hiểm sức khoẻ</b><span>CPA · theo hợp đồng</span><em>Đang chạy</em></div><div class="cpg"><i style="background:#FFF1DE;color:#E8890C">🏦</i><b>Mở tài khoản số</b><span>CPA · theo tài khoản</span><em class="w">Sắp mở</em></div></div>
          </div>
          <div class="apane" :class="{ on: cur === 2 }">
            <div class="tbl"><div class="th2"><span>Mã đơn</span><span>Chiến dịch</span><span>Sub ID</span><span>Trạng thái</span></div><div class="tr"><span>#A-1042</span><span>Mở thẻ tín dụng</span><span>tiktok-04</span><span class="ok">Đã duyệt</span></div><div class="tr"><span>#A-1039</span><span>Mở thẻ tín dụng</span><span>fb-group</span><span class="ok">Đã duyệt</span></div><div class="tr"><span>#B-2210</span><span>Bảo hiểm sức khoẻ</span><span>zalo-01</span><span class="wt">Chờ duyệt</span></div><div class="tr"><span>#C-0871</span><span>Vay tiêu dùng</span><span>tiktok-02</span><span class="ok">Đã duyệt</span></div><div class="tr"><span>#C-0866</span><span>Vay tiêu dùng</span><span>web</span><span class="no">Từ chối</span></div></div>
          </div>
          <div class="apane" :class="{ on: cur === 3 }">
            <div class="wal"><small>Số dư khả dụng</small><b>12.450.000đ</b><span><em>Rút tiền</em><em class="g">Lịch sử</em></span></div>
            <div class="txl"><div><span>Hoa hồng #A-1042</span><b>+350.000đ</b></div><div><span>Hoa hồng #A-1039</span><b>+350.000đ</b></div><div><span>Rút tiền về ngân hàng</span><b class="out">-5.000.000đ</b></div><div><span>Hoa hồng #C-0871</span><b>+370.000đ</b></div></div>
          </div>
        </div>
      </div></div><div class="base"></div></div>
      <div class="phone"><div class="pnotch"></div><div class="pscr">
        <div class="ph1"><img :src="brand" alt=""><b>3RDHub</b></div>
        <div class="pwal"><small>Hoa hồng tháng này</small><b>12.450.000đ</b></div>
        <div class="plink"><small>Link của bạn</small><span>3rdvn.io.vn/aff/shb-finance?ref=<em>RD260001</em></span><button type="button" tabindex="-1">Sao chép link</button></div>
        <div class="pnoti"><i>✓</i><span><b>Hồ sơ #A-1042 đã duyệt</b><small>+350.000đ vào ví</small></span></div>
      </div></div>
    </div>
    <p class="dnote">Giao diện minh hoạ từ hệ thống 3RDHub, số liệu là ví dụ.</p>
  </div>
</section>
</template>
