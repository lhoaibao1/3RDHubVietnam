<script setup lang="ts">
import { computed } from 'vue'
import { LEGAL_SLUGS, NAV, okUrl } from '@/lib/content'
import { BRANDS } from '@/lib/icons.generated'
import { useSite } from '@/stores/site'
import BrandMark from './BrandMark.vue'
import Icon from './Icon.vue'
import { openConsent } from '@/composables/useConsent'

const site = useSite()
const SOCIAL: [string, string][] = [['facebook', 'Facebook'], ['zalo', 'Zalo'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']]
const socials = computed(() => SOCIAL.filter(([k]) => /^https?:\/\//i.test(site.S(k))).map(([k, label]) => ({ k, label, url: okUrl(site.S(k)), path: BRANDS[k].p })))
const hours = computed(() => (site.lang === 'en' && site.S('working_hours_en')) || site.S('working_hours'))
const year = new Date().getFullYear()
const copy = computed(() => site.t('© {year} {name}. Bảo lưu mọi quyền.').replace('{year}', String(year)).replace('{name}', site.SL('company_name')))
const note = computed(() => site.t('Nội dung, thương hiệu và hình ảnh trên website thuộc quyền sở hữu của {name} và các chủ sở hữu tương ứng. Không sao chép khi chưa có sự đồng ý bằng văn bản.').replace('{name}', site.SL('company_name')))
const legal = Object.keys(LEGAL_SLUGS)
const top = () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
</script>

<template>
  <footer class="ft2">
    <div class="ftwave" aria-hidden="true"><svg viewBox="0 0 1440 90" preserveAspectRatio="none"><path d="M0 90V46C140 12 300 0 470 20s330 56 500 44 330-44 470-34V90z" /></svg></div>
    <div class="ftbg" aria-hidden="true"><i class="o1"></i><i class="o2"></i><i class="o3"></i><span>3RDHub</span></div>
    <div class="w ftg">
      <div class="ftb">
        <RouterLink class="brand ftl" to="/" aria-label="3RDHub Vietnam"><BrandMark /></RouterLink>
        <p class="ftd">Nền tảng tiếp thị liên kết kết nối Advertiser tài chính với mạng lưới publisher. Mỗi lượt bấm, mỗi hồ sơ và mỗi đồng hoa hồng đều được ghi nhận.</p>
        <div class="ftquick">
          <a :href="'tel:' + site.S('hotline_tel')"><Icon name="phone" />{{ site.S('hotline') }}</a>
          <a :href="'mailto:' + site.S('email')"><Icon name="mail" />{{ site.S('email') }}</a>
        </div>
        <div class="ftsoc">
          <a v-for="s in socials" :key="s.k" :href="s.url" target="_blank" rel="noopener noreferrer" :aria-label="s.label"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="s.path" /></svg></a>
        </div>
      </div>
      <nav class="ftc" aria-label="Khám phá">
        <h3>Khám phá</h3>
        <RouterLink v-for="n in NAV" :key="n[0]" :to="'/' + n[0]"><Icon name="chevron-right" />{{ $t(n[1]) }}</RouterLink>
      </nav>
      <nav class="ftc" aria-label="Pháp lý">
        <h3>Pháp lý</h3>
        <RouterLink :to="'/' + legal[0]"><Icon name="file-text" />Điều khoản sử dụng</RouterLink>
        <RouterLink :to="'/' + legal[1]"><Icon name="shield-check" />Chính sách bảo mật</RouterLink>
        <button type="button" class="ftcookie" @click="openConsent"><Icon name="cookie" />Cài đặt cookie</button>
      </nav>
      <div class="ftc ftco">
        <h3>Thông tin công ty</h3>
        <div class="ftcard" data-cms="company">
          <p class="coname"><Icon name="building-2" /><b>{{ site.SL('company_name') }}</b></p>
          <ul>
            <li><i><Icon name="file-text" /></i><span><small>Mã số thuế</small><b>{{ site.S('tax_id') }}</b></span></li>
            <li v-if="site.SL('address')"><i><Icon name="map-pin" /></i><span><small>Địa chỉ</small><b>{{ site.SL('address') }}</b></span></li>
            <li><i><Icon name="globe" /></i><span><small>Website công ty</small><a :href="site.S('parent_url')" target="_blank" rel="noopener">{{ site.S('parent_url').replace(/^https?:\/\//, '').replace(/\/$/, '') }}</a></span></li>
            <li v-if="hours"><i><Icon name="clock" /></i><span><small>Giờ làm việc</small><b>{{ hours }}</b></span></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="w ftbot">
      <p class="ftcopy">{{ copy }}</p>
      <p class="ftnote">{{ note }}</p>
      <button type="button" class="fttop" :aria-label="$t('Lên đầu trang')" @click="top"><Icon name="arrow-up" /></button>
    </div>
  </footer>
</template>
