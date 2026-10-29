<script setup lang="ts">
import { useSite } from '@/stores/site'
import CopyButton from './CopyButton.vue'
import LeadForm from './LeadForm.vue'

const site = useSite()
</script>

<template>
  <section class="w" id="lien-he">
    <div class="contact">
      <div class="ppath">
        <div class="k2" style="color:#FFB38E">Publisher</div>
        <h2>Muốn kiếm hoa hồng?<span>Đăng ký ngay trên app.</span></h2>
        <p class="lead">Tạo tài khoản, hoàn tất định danh và lấy link chiến dịch đầu tiên. Không cần chờ liên hệ.</p>
        <div class="acts"><a class="btn or" :href="site.S('signup_url')" target="_blank" rel="noopener">Đăng ký làm publisher</a></div>
        <div class="cl">
          <div><span><small>Email</small>{{ site.S('email') }}</span><CopyButton :value="site.S('email')" /></div>
          <div><span><small>Hotline</small>{{ site.S('hotline') }}</span><CopyButton :value="site.S('hotline_tel')" /></div>
        </div>
      </div>
      <LeadForm variant="home" />
    </div>
  </section>
</template>
