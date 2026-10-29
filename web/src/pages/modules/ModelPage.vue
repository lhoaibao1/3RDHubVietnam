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
<section ref="root" class="w pg" id="p-mo-hinh">
  <div class="pgh">
    <div>
      <h1>Một hồ sơ đi qua <span class="o">3RDHub</span> như thế nào.</h1>
      <p class="lead">Từ lúc Advertiser đăng chiến dịch đến khi hoa hồng về ví publisher, mỗi bước đều có người chịu trách nhiệm và có dữ liệu ghi lại để đối chiếu.</p></div>
    <Page3D id="mo-hinh" tint="#FF6A2B"><div class="ft" style="left:18px;bottom:18px"><b>Hồ sơ #A-1042</b><span>Đã duyệt · +350.000đ vào ví</span></div><div class="ft" style="right:18px;top:18px"><b>ref=RD260001</b><span>Link của publisher</span></div></Page3D>
  </div>

  <div class="ps"><div class="k2">Ba bên trong mô hình</div><h2>Mỗi bên một vai trò rõ ràng</h2>
    <div class="g3">
      <article class="cd"><span class="ic"><Icon name="building-2" /></span><h3>Advertiser</h3><p>Ngân hàng, công ty tài chính có sản phẩm cần tìm khách hàng.</p><ul class="ck"><li>Đăng chiến dịch, đặt mức hoa hồng</li><li>Duyệt hồ sơ khách đăng ký</li><li>Gửi trạng thái về 3RDHub qua postback</li></ul></article>
      <article class="cd hl"><span class="ic"><Icon name="network" /></span><h3>3RDHub</h3><p>Nền tảng đứng giữa, giữ dữ liệu cho cả hai bên.</p><ul class="ck"><li>Tạo link riêng gắn mã publisher</li><li>Ghi nhận lượt bấm, lead, đơn</li><li>Đối soát, cộng hoa hồng vào ví</li><li>Xử lý báo mất đơn</li></ul></article>
      <article class="cd"><span class="ic"><Icon name="megaphone" /></span><h3>Publisher</h3><p>Cộng tác viên có kênh tiếp cận khách: TikTok, Facebook, Zalo, website.</p><div class="soc"><span><Icon brand="tiktok" />TikTok</span><span><Icon brand="facebook" />Facebook</span><span><Icon brand="zalo" />Zalo</span></div><ul class="ck"><li>Chọn chiến dịch, lấy link</li><li>Chia sẻ lên kênh của mình</li><li>Theo dõi báo cáo, rút hoa hồng</li></ul></article>
    </div></div>

  <div class="ps"><div class="k2">Năm bước</div><h2>Hành trình của một hồ sơ</h2>
    <ol class="tl">
      <li><b>1</b><div><h3>Advertiser đăng chiến dịch</h3><p>Sản phẩm như thẻ tín dụng, vay tiêu dùng được đưa lên 3RDHub kèm hình thức tính và mức hoa hồng cho mỗi hồ sơ thành công.</p><dl><dt>Ai làm</dt><dd>Advertiser, 3RDHub cấu hình</dd><dt>Ghi nhận</dt><dd>Chiến dịch, mức hoa hồng, điều kiện duyệt</dd></dl></div></li>
      <li><b>2</b><div><h3>3RDHub tạo link riêng</h3><p>Mỗi publisher nhận một link gắn mã của mình. Có thể thêm Sub ID để tách từng kênh.</p><dl><dt>Ai làm</dt><dd>Hệ thống tự tạo</dd><dt>Ghi nhận</dt><dd>Mã publisher, Sub ID</dd></dl></div></li>
      <li><b>3</b><div><h3>Publisher chia sẻ</h3><p>Link được đăng lên TikTok, Facebook, nhóm Zalo hoặc gửi cho khách quen. Mỗi lượt bấm được ghi lại theo thời gian thực.</p><dl><dt>Ai làm</dt><dd>Publisher</dd><dt>Ghi nhận</dt><dd>Lượt bấm theo kênh, thời điểm</dd></dl></div></li>
      <li><b>4</b><div><h3>Khách đăng ký, đối tác duyệt</h3><p>Khách điền thông tin trên trang của Advertiser. Kết quả duyệt được gửi về 3RDHub qua postback.</p><dl><dt>Ai làm</dt><dd>Khách hàng, Advertiser</dd><dt>Ghi nhận</dt><dd>Lead, trạng thái hồ sơ</dd></dl></div></li>
      <li><b>5</b><div><h3>Hoa hồng về ví</h3><p>Hồ sơ được duyệt và qua đối soát thì hoa hồng cộng vào số dư. Publisher gửi yêu cầu rút và theo dõi trạng thái.</p><dl><dt>Ai làm</dt><dd>3RDHub, Publisher</dd><dt>Ghi nhận</dt><dd>Số dư ví, lịch sử rút</dd></dl></div></li>
    </ol></div>

  <div class="ps"><div class="k2">Hình thức tính hoa hồng</div><h2>CPL, CPS hay CPA</h2><p class="sub">Mỗi chiến dịch ghi rõ hình thức tính và mức hoa hồng ngay trên trang chiến dịch.</p>
    <div class="g3">
      <article class="cd"><span class="tg">CPL</span><h3>Theo hồ sơ</h3><p>Trả khi hồ sơ khách đăng ký được Advertiser duyệt.</p><p class="ex">Ví dụ: mở thẻ tín dụng</p></article>
      <article class="cd"><span class="tg">CPS</span><h3>Theo khoản bán</h3><p>Trả theo khoản vay hoặc giao dịch thành công.</p><p class="ex">Ví dụ: vay tiêu dùng</p></article>
      <article class="cd"><span class="tg">CPA</span><h3>Theo hành động</h3><p>Trả khi khách hoàn tất một hành động cụ thể như ký hợp đồng, mở tài khoản.</p><p class="ex">Ví dụ: bảo hiểm sức khoẻ, mở tài khoản số</p></article>
    </div></div>

  <div class="ps"><div class="k2">Trạng thái đơn</div><h2>Một đơn đi qua những trạng thái nào</h2>
    <div class="states"><span>Ghi nhận</span><span class="wt">Chờ duyệt</span><span class="ok">Đã duyệt</span><span>Đối soát</span><span class="ok">Cộng ví</span><span>Rút tiền</span></div>
    <p class="sub">Hồ sơ bị Advertiser từ chối sẽ chuyển sang <b class="no">Từ chối</b> và không tính hoa hồng. Nếu khách đã đăng ký mà đơn không hiện, publisher gửi báo mất đơn để 3RDHub đối chiếu với dữ liệu postback.</p></div>

  <div class="ps"><div class="k2">Link của publisher</div><h2>Đọc một đường link</h2>
    <div class="anat"><code><span class="a1">3rdvn.io.vn/aff/</span><span class="a2">shb-finance</span><span class="a1">?ref=</span><span class="a3">RD260001</span><span class="a1">&amp;sub=</span><span class="a4">tiktok-04</span></code>
      <div class="g4"><div><i class="a2"></i><b>Chiến dịch</b><span>Sản phẩm khách sẽ đăng ký</span></div><div><i class="a3"></i><b>Mã publisher</b><span>Đơn về đúng người giới thiệu</span></div><div><i class="a4"></i><b>Sub ID</b><span>Tách báo cáo theo từng kênh</span></div><div><i class="a1"></i><b>Tên miền 3RDHub</b><span>Nơi ghi nhận lượt bấm</span></div></div>
      <p class="note">Đường link minh hoạ. Link thật lấy trong mục Tạo link trên app.</p></div></div>

  <PageCta />
</section>
</template>
