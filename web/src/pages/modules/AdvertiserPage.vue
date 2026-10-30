<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'
import Page3D from '@/components/Page3D.vue'
import PageCta from '@/components/PageCta.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)
</script>

<template>
<section ref="root" class="w pg" id="p-advertiser">
  <div class="pgh">
    <div>
      <h1>Chạy chiến dịch, <span class="o">chỉ trả cho kết quả.</span></h1>
      <p class="lead">Advertiser đưa sản phẩm lên 3RDHub, đặt mức hoa hồng và nhận hồ sơ từ mạng lưới publisher. Mỗi lượt bấm, hồ sơ và đơn đều được ghi nhận để hai bên đối soát minh bạch.</p>
      <div class="acts"><RouterLink class="btn or" to="/lien-he">Gửi chiến dịch</RouterLink><RouterLink class="btn gh" to="/mo-hinh">Xem mô hình</RouterLink></div></div>
    <Page3D id="advertiser" tint="#7B4DFF"><div class="ft" style="left:18px;top:18px"><b>Mở thẻ tín dụng</b><span>CPL · Đang chạy</span></div><div class="ft" style="right:18px;bottom:18px"><b>Báo cáo theo kênh</b><span>Click, lead, đơn mỗi ngày</span></div></Page3D>
  </div>

  <div class="ps"><div class="k2">Vì sao chọn 3RDHub</div><h2>Khách hàng đến từ mạng lưới publisher</h2>
    <div class="g3">
      <article class="cd"><span class="ic"><Icon name="rocket" /></span><h3>Mạng lưới sẵn có</h3><p>Tiếp cận ngay publisher trên TikTok, Facebook, Zalo và website.</p><ul class="ck"><li>Không cần tự tuyển cộng tác viên</li><li>Publisher đã được định danh</li><li>Mở rộng thêm kênh khi cần</li></ul></article>
      <article class="cd hl"><span class="ic"><Icon name="target" /></span><h3>Chỉ trả cho kết quả</h3><p>Chi phí gắn với hồ sơ được duyệt, không phải lượt hiển thị.</p><ul class="ck"><li>Đặt hoa hồng theo CPL, CPS hoặc CPA</li><li>Hồ sơ không đạt thì không tính phí</li><li>Kiểm soát ngân sách theo chiến dịch</li></ul></article>
      <article class="cd"><span class="ic"><Icon name="chart-column" /></span><h3>Số liệu minh bạch</h3><p>Dữ liệu theo từng kênh, từng Sub ID và từng hồ sơ.</p><ul class="ck"><li>Báo cáo click, lead, đơn mỗi ngày</li><li>Postback trạng thái về hệ thống của bạn</li><li>Đối soát cuối kỳ rõ ràng</li></ul></article>
    </div></div>

  <div class="ps"><div class="k2">Hình thức hoa hồng</div><h2>Chọn cách tính phù hợp với sản phẩm</h2>
    <div class="g3">
      <article class="cd"><span class="n t">CPL</span><h3>Theo hồ sơ hợp lệ</h3><p>Hợp với thẻ tín dụng và tài khoản số, nơi mỗi hồ sơ đạt điều kiện đã có giá trị.</p></article>
      <article class="cd"><span class="n t">CPS</span><h3>Theo đơn thành công</h3><p>Hợp với khoản vay và bảo hiểm, tính khi giao dịch được duyệt.</p></article>
      <article class="cd"><span class="n t">CPA</span><h3>Theo hành động thoả thuận</h3><p>Tính khi khách hoàn thành bước hai bên đã chốt, như kích hoạt thẻ hoặc giải ngân.</p></article>
    </div></div>

  <div class="ps"><div class="k2">Quy trình</div><h2>Từ chiến dịch đến hoa hồng</h2>
    <ol class="steps6"><li><b>01</b><h3>Gửi chiến dịch</h3><p>Cung cấp sản phẩm, điều kiện duyệt hồ sơ và mức hoa hồng.</p></li><li><b>02</b><h3>Thiết lập</h3><p>Chúng tôi cấu hình chiến dịch, link và tracking.</p></li><li><b>03</b><h3>Chạy thử</h3><p>Kiểm tra click và postback trên môi trường test.</p></li><li><b>04</b><h3>Publisher chia sẻ</h3><p>Mạng lưới đưa sản phẩm tới khách hàng trên nhiều kênh.</p></li><li><b>05</b><h3>Duyệt hồ sơ</h3><p>Bạn duyệt hồ sơ, trạng thái cập nhật về 3RDHub.</p></li><li><b>06</b><h3>Đối soát</h3><p>Chốt số liệu và chia hoa hồng cho publisher.</p></li></ol></div>

  <div class="ps"><div class="cta xs"><div><h2>Muốn tự vận hành mạng lưới affiliate?</h2><p>3RDVN Technology cũng xây hệ thống riêng và cấp bản quyền chính hệ thống 3RDHub.</p></div><RouterLink class="btn or" to="/san-pham">Xem sản phẩm</RouterLink></div></div>

  <PageCta />
</section>
</template>
