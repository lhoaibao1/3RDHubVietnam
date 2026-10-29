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
<section ref="root" class="w pg" id="p-cong-nghe">
  <div class="pgh">
    <div>
      <h1>Kiến trúc phía sau <span class="o">mỗi lượt bấm.</span></h1>
      <p class="lead">Frontend Vue.js cho giao diện nhanh, dễ mở rộng. Backend Go xử lý lượt bấm, postback và đối soát với độ trễ thấp, chịu được lưu lượng lớn khi chiến dịch bùng nổ.</p></div>
    <Page3D id="cong-nghe" tint="#00ADD8"><div class="ft" style="left:18px;top:18px"><b>POST /postback</b><span class="okc">200 OK · 12ms</span></div><div class="ft" style="right:18px;bottom:18px"><b>Vue.js → Go → PostgreSQL</b><span>Luồng dữ liệu</span></div></Page3D>
  </div>

  <div class="ps"><div class="k2">Công nghệ sử dụng</div><h2>Mỗi công cụ một việc</h2>
    <div class="g2">
      <article class="cd"><h3>Frontend</h3><dl class="stk2"><dt><span class="bl"><Icon brand="vuedotjs" /></span>Vue.js</dt><dd>Giao diện website publisher và trang quản trị</dd><dt><span class="bl"><Icon brand="nuxt" /></span>Nuxt</dt><dd>Trang tải nhanh, thân thiện tìm kiếm</dd><dt><span class="bl"><Icon brand="typescript" /></span>TypeScript</dt><dd>Giảm lỗi khi mở rộng mã nguồn</dd><dt><span class="bl"><Icon brand="pinia" /></span>Pinia</dt><dd>Quản lý trạng thái dữ liệu trên giao diện</dd><dt><span class="bl"><Icon brand="tailwindcss" /></span>Tailwind CSS</dt><dd>Giao diện responsive cho điện thoại</dd><dt><span class="bl"><Icon brand="vite" /></span>Vite</dt><dd>Build nhanh khi phát triển</dd></dl></article>
      <article class="cd"><h3>Backend</h3><dl class="stk2"><dt><span class="bl"><Icon brand="go" /></span>Go</dt><dd>API, tracking lượt bấm, xử lý postback</dd><dt><span class="bl gi"><Icon name="globe" /></span>REST API</dt><dd>Kết nối website, app và đối tác</dd><dt><span class="bl"><Icon brand="postgresql" /></span>PostgreSQL</dt><dd>Lưu chiến dịch, đơn, ví, đối soát</dd><dt><span class="bl"><Icon brand="redis" /></span>Redis</dt><dd>Bộ nhớ đệm, đếm lượt bấm nhanh</dd><dt><span class="bl"><Icon brand="docker" /></span>Docker</dt><dd>Đóng gói, triển khai đồng nhất</dd><dt><span class="bl"><Icon brand="nginx" /></span>Nginx</dt><dd>Cổng vào, chia tải, HTTPS</dd></dl></article>
    </div></div>

  <div class="ps"><div class="k2">Luồng tracking</div><h2>Từ lượt bấm đến hoa hồng</h2>
    <ol class="seq">
      <li><span class="si"><Icon name="mouse-pointer-click" /></span><b>Khách</b><span>Bấm link có mã publisher và Sub ID</span></li>
      <li><span class="si"><Icon name="server" /></span><b>API Go</b><span>Ghi lượt bấm, mã publisher, Sub ID, thời điểm</span></li>
      <li><span class="si"><Icon name="link" /></span><b>API Go</b><span>Chuyển khách sang trang đăng ký của Advertiser</span></li>
      <li><span class="si"><Icon name="file-check" /></span><b>Advertiser</b><span>Khách điền hồ sơ, đối tác xét duyệt</span></li>
      <li><span class="si"><Icon name="send" /></span><b>Advertiser</b><span>Gửi postback trạng thái hồ sơ về 3RDHub</span></li>
      <li><span class="si"><Icon name="wallet" /></span><b>API Go</b><span>Cập nhật đơn, đối soát, cộng hoa hồng vào ví</span></li>
    </ol></div>

  <div class="ps"><div class="k2">Kết nối đối tác</div><h2>Postback trông như thế nào</h2>
    <div class="g2 al">
      <pre class="codeb"><span class="c"># Đối tác gửi khi hồ sơ đổi trạng thái</span>
<span class="k">GET</span> /postback
  ?click_id=<span class="s">c_8f21a7</span>
  &amp;status=<span class="s">approved</span>
  &amp;order_id=<span class="s">A-1042</span>
  &amp;key=<span class="s">••••••••</span>

<span class="ok">200 OK</span>  <span class="c"># đơn A-1042 → Đã duyệt</span></pre>
      <div><p class="sub" style="margin-top:0">Mỗi đối tác có API key riêng. Khi hồ sơ đổi trạng thái, đối tác gọi postback và 3RDHub cập nhật đơn ngay, publisher thấy kết quả trên app.</p><ul class="ck" style="margin-top:18px"><li>Thử trên môi trường test trước khi chạy thật</li><li>Tài liệu API ghi đầy đủ tham số</li><li>Mỗi lần gọi đều có nhật ký để đối chiếu</li></ul><p class="note">Ví dụ minh hoạ. Tham số thực tế nằm trong tài liệu API cấp cho đối tác.</p></div>
    </div></div>

  <div class="ps"><div class="k2">Vận hành</div><h2>An toàn và ổn định</h2>
    <div class="g4c">
      <article class="cd"><span class="ic"><Icon name="key-round" /></span><h3>API key</h3><p>Mỗi đối tác một key, có thể thu hồi khi cần.</p></article>
      <article class="cd"><span class="ic"><Icon name="flask-conical" /></span><h3>Môi trường test</h3><p>Tách biệt khỏi dữ liệu thật để thử kết nối.</p></article>
      <article class="cd"><span class="ic"><Icon name="users" /></span><h3>Phân quyền</h3><p>Quản trị, kế toán, trưởng nhóm thấy đúng phần việc của mình.</p></article>
      <article class="cd"><span class="ic"><Icon name="scroll-text" /></span><h3>Nhật ký</h3><p>Lượt bấm, postback, thay đổi trạng thái đều được lưu lại.</p></article>
    </div></div>

  <PageCta />
</section>
</template>
