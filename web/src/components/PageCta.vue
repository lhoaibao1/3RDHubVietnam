<script setup lang="ts">
import { useSite } from '@/stores/site'

const site = useSite()
</script>

<template>
  <div class="pnext">
    <div class="cta">
      <h2>Sẵn sàng bắt đầu?</h2>
      <p>Publisher đăng ký trên app. Advertiser để lại yêu cầu, đội ngũ 3RDVN Technology sẽ liên hệ.</p>
      <div class="acts">
        <a class="btn or" :href="site.S('signup_url')" target="_blank" rel="noopener">Đăng ký làm publisher</a>
        <RouterLink class="btn gh" to="/lien-he">Advertiser liên hệ</RouterLink>
      </div>
    </div>
  </div>
</template>
