<script setup lang="ts">
import { ref } from 'vue'
import CopyButton from '@/components/CopyButton.vue'
import Icon from '@/components/Icon.vue'
import LeadForm from '@/components/LeadForm.vue'
import Page3D from '@/components/Page3D.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)
</script>

<template>
  <section ref="root" class="w pg" id="p-lien-he">
    <div class="pgh">
      <div>
        <h1>Bạn là <span class="o">publisher</span> hay <span class="o">Advertiser?</span></h1>
        <p class="lead">Publisher đăng ký thẳng trên app, không cần chờ. Advertiser gửi yêu cầu, đội ngũ 3RDVN Technology phản hồi trong giờ làm việc.</p>
      </div>
      <Page3D id="lien-he" tint="#FF4D8D">
        <div class="ft" style="right:18px;top:18px"><b>{{ site.S('hotline') }}</b><span>Hotline</span></div>
        <div class="ft" style="left:18px;bottom:18px"><b>{{ site.S('email') }}</b><span>Email</span></div>
      </Page3D>
    </div>
    <div class="g2 ps0">
      <article class="cd path">
        <div class="k2">Publisher</div>
        <h2>Muốn kiếm hoa hồng?</h2>
        <ol class="mini3"><li>Tạo tài khoản trên app</li><li>Hoàn tất định danh</li><li>Chọn chiến dịch, lấy link đầu tiên</li></ol>
        <div class="acts"><a class="btn or" :href="site.S('signup_url')" target="_blank" rel="noopener">Đăng ký làm publisher</a></div>
      </article>
      <LeadForm variant="page" />
    </div>
    <div class="ps"><div class="k2">Kênh liên hệ</div><h2>Thông tin liên hệ</h2>
      <div class="g3">
        <article class="cd ch"><span class="ic"><Icon name="mail" /></span><small>Email</small><b>{{ site.S('email') }}</b><div class="acts sm"><a class="btn gh" :href="'mailto:' + site.S('email')">Gửi email</a><CopyButton class="btn gh" :value="site.S('email')" /></div></article>
        <article class="cd ch"><span class="ic"><Icon name="phone" /></span><small>Hotline</small><b>{{ site.S('hotline') }}</b><div class="acts sm"><a class="btn gh" :href="'tel:' + site.S('hotline_tel')">Gọi ngay</a><CopyButton class="btn gh" :value="site.S('hotline_tel')" /></div></article>
        <article class="cd ch"><span class="ic"><Icon name="building" /></span><small>Đơn vị vận hành</small><b>{{ site.SL('company_name') }}</b><span class="sub"><span>Mã số thuế</span> <span>{{ site.S('tax_id') }}</span></span></article>
      </div>
    </div>
  </section>
</template>
