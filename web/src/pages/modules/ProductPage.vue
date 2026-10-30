<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'
import Page3D from '@/components/Page3D.vue'
import PageCta from '@/components/PageCta.vue'
import ClientsSection from '@/components/ClientsSection.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)
</script>

<template>
<section ref="root" class="w pg" id="p-san-pham">
  <div class="pgh">
    <div>
      <h1><span>Hệ thống affiliate riêng,</span> <span class="o">mang thương hiệu của bạn.</span></h1>
      <p class="lead">Xây hệ thống theo yêu cầu, hoặc nhận bản quyền chính hệ thống 3RDHub đang vận hành thực tế. 3RDVN Technology lo trọn gói từ thiết kế, lập trình đến bàn giao.</p>
      <div class="acts"><RouterLink class="btn or" to="/baogia">Xem báo giá</RouterLink><a class="btn gh" :href="site.S('demo_url')" target="_blank" rel="noopener">Xem demo</a></div></div>
    <Page3D id="san-pham" tint="#1BA6D9"><div class="ft" style="left:18px;top:18px"><b>Hệ thống quản trị</b><span>Chiến dịch, báo cáo, đối soát</span></div><div class="ft" style="right:18px;bottom:18px"><b>Bàn giao trọn gói</b><span>Mã nguồn, tài liệu, đào tạo</span></div></Page3D>
  </div>

  <div class="ps"><div class="k2">Hai cách sở hữu</div><h2>Chọn cách phù hợp với bạn</h2>
    <div class="g2">
      <article class="cd hl"><span class="ic"><Icon name="blocks" /></span><h3>Xây hệ thống affiliate riêng</h3><p>Phù hợp khi bạn muốn tự quản lý mạng lưới cộng tác viên dưới thương hiệu của mình.</p><ul class="ck"><li>Website publisher và trang quản trị riêng</li><li>Tính năng theo nghiệp vụ của bạn</li><li>Bàn giao, hướng dẫn vận hành</li></ul></article>
      <article class="cd"><span class="ic"><Icon name="package" /></span><h3>Nhận bản quyền 3RDHub</h3><p>Phù hợp khi bạn muốn triển khai nhanh trên nền tảng đã chạy thực tế.</p><ul class="ck"><li>Dùng lại hệ thống 3RDHub đang vận hành</li><li>Đổi thương hiệu, cấu hình theo bạn</li><li>Lộ trình nâng cấp theo giai đoạn</li></ul></article>
    </div></div>

  <div class="ps"><div class="k2">So sánh</div><h2>Khác nhau ở đâu</h2>
    <div class="cmpw"><table class="cmp">
      <thead><tr><th></th><th>Hệ thống riêng</th><th>Bản quyền 3RDHub</th></tr></thead>
      <tbody>
        <tr><th>Thương hiệu riêng</th><td data-l="Hệ thống riêng" class="y">Có</td><td data-l="Bản quyền 3RDHub" class="y">Có</td></tr>
        <tr><th>Website publisher và trang quản trị</th><td data-l="Hệ thống riêng" class="y">Riêng của bạn</td><td data-l="Bản quyền 3RDHub" class="y">Riêng của bạn</td></tr>
        <tr><th>Postback, API cho đối tác</th><td data-l="Hệ thống riêng" class="y">Có</td><td data-l="Bản quyền 3RDHub" class="y">Có</td></tr>
        <tr><th>Tuỳ biến tính năng</th><td data-l="Hệ thống riêng" class="y">Theo yêu cầu</td><td data-l="Bản quyền 3RDHub">Theo giai đoạn</td></tr>
        <tr><th>Thời gian bắt đầu</th><td data-l="Hệ thống riêng">Lâu nhất</td><td data-l="Bản quyền 3RDHub">Trung bình</td></tr>
      </tbody></table></div>
    <p class="note">Phạm vi và thời gian cụ thể được thống nhất khi tư vấn.</p></div>

  <div class="ps"><div class="k2">Ba tầng hệ thống</div><h2>Bạn nhận được gì khi xây hệ thống</h2>
    <div class="g3">
      <article class="cd"><span class="n">1</span><h3>Website cho cộng tác viên</h3><ul class="ck"><li>Trang danh sách chiến dịch</li><li>Đăng ký, định danh publisher</li><li>Tạo link, gắn Sub ID</li><li>Ví hoa hồng, yêu cầu rút</li><li>Báo mất đơn</li></ul></article>
      <article class="cd"><span class="n">2</span><h3>Hệ thống quản trị</h3><ul class="ck"><li>Quản lý chiến dịch, mức hoa hồng</li><li>Báo cáo click, lead, đơn</li><li>Đối soát với đối tác</li><li>Chia hoa hồng, đội nhóm</li><li>Duyệt rút tiền, phân quyền</li></ul></article>
      <article class="cd"><span class="n">3</span><h3>Kết nối đối tác</h3><ul class="ck"><li>Postback trạng thái đơn</li><li>API key riêng cho từng đối tác</li><li>Môi trường test tách biệt</li><li>Tài liệu API</li></ul></article>
    </div></div>

  <div class="ps"><div class="k2">Quy trình</div><h2>Triển khai trong sáu bước</h2>
    <ol class="steps6"><li><b>01</b><h3>Tư vấn</h3><p>Nghe sản phẩm, quy mô publisher và cách bạn muốn trả hoa hồng.</p></li><li><b>02</b><h3>Thiết kế</h3><p>Chốt luồng nghiệp vụ, giao diện và phạm vi tính năng.</p></li><li><b>03</b><h3>Lập trình</h3><p>Frontend Vue.js, backend Go, kết nối đối tác.</p></li><li><b>04</b><h3>Kiểm thử</h3><p>Chạy thử tracking và postback trên môi trường test.</p></li><li><b>05</b><h3>Bàn giao</h3><p>Tài liệu bàn giao, hướng dẫn đội vận hành.</p></li><li><b>06</b><h3>Nâng cấp</h3><p>Bổ sung tính năng theo từng giai đoạn.</p></li></ol></div>

  <ClientsSection />

  <div class="ps"><div class="cta xs"><div><h2>Muốn biết chi phí?</h2><p>Xem các gói và để lại thông tin, chúng tôi báo giá theo đúng phạm vi của bạn.</p></div><RouterLink class="btn or" to="/baogia">Xem báo giá</RouterLink></div></div>

  <PageCta />
</section>
</template>
