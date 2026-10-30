<script setup lang="ts">
import { computed } from 'vue'
import { fmt, useAdmin } from '../store'

const a = useAdmin()
const c = computed(() => a.content!)
</script>

<template>
  <div class="grid g4" style="margin-bottom:16px">
    <div class="stat ink"><b>{{ a.newLeads }}</b><span>Yêu cầu mới chưa xử lý</span></div>
    <div class="stat"><b>{{ a.totalLeads }}</b><span>Tổng yêu cầu đã nhận</span></div>
    <div class="stat"><b>{{ Object.keys(c.ov).length }}</b><span>Đoạn chữ đã tuỳ chỉnh</span></div>
    <div class="stat"><b>{{ c.faq.length }} · {{ c.partners.length }}</b><span>Câu hỏi · đối tác</span></div>
  </div>
  <div class="panel">
    <h2>Bắt đầu nhanh</h2>
    <p class="sub">Lần chỉnh sửa gần nhất: {{ a.updated ? fmt(a.updated) : 'chưa có' }}</p>
    <div class="bar">
      <button class="btn" type="button" @click="a.go('live')">Sửa chữ ngay trên trang</button>
      <button class="btn gh" type="button" @click="a.go('quote')">Báo giá</button>
      <button class="btn gh" type="button" @click="a.go('clients')">Khách hàng</button>
      <button class="btn gh" type="button" @click="a.go('faq')">Quản lý hỏi đáp</button>
      <button class="btn gh" type="button" @click="a.go('partners')">Quản lý đối tác</button>
      <button class="btn gh" type="button" @click="a.go('legal')">Điều khoản và bảo mật</button>
      <button class="btn gh" type="button" @click="a.go('leads')">Xem yêu cầu khách</button>
    </div>
  </div>
  <div class="panel help">
    <h2>Cách hoạt động</h2>
    <ul>
      <li><b>Sửa xong bấm "Lưu và đăng lên website"</b>: website cập nhật ngay, không cần chạy lại gì.</li>
      <li><b>Mỗi đoạn chữ có 2 ô</b>: Tiếng Việt và English. Để trống ô English thì dùng bản dịch mặc định.</li>
      <li><b>Chữ giống nhau ở nhiều chỗ</b> (ví dụ nút "Đăng ký làm publisher") đổi một lần là đổi hết.</li>
      <li><b>Làm sai?</b> Vào mục "Lịch sử" để khôi phục phiên bản trước.</li>
      <li><b>Sửa chữ: vào "Sửa trên trang"</b>, bấm thẳng vào chữ trên website để sửa. Không nhớ chữ nằm ở trang nào thì dùng "Tìm chữ để sửa".</li>
      <li><b>Chỉ cần viết tiếng Việt</b>: khi lưu, hệ thống tự dịch sang tiếng Anh.</li>
    </ul>
  </div>
</template>
