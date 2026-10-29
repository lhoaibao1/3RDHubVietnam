<script setup lang="ts">
import { computed } from 'vue'
import { LEGAL_SLUGS, NAV, okUrl } from '@/lib/content'
import { BRANDS } from '@/lib/icons.generated'
import { useSite } from '@/stores/site'
import BrandMark from './BrandMark.vue'

const site = useSite()
const SOCIAL: [string, string][] = [['facebook', 'Facebook'], ['zalo', 'Zalo'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['instagram', 'Instagram']]
const socials = computed(() => SOCIAL.filter(([k]) => /^https?:\/\//i.test(site.S(k))).map(([k, label]) => ({ k, label, url: okUrl(site.S(k)), path: BRANDS[k].p })))
const hours = computed(() => (site.lang === 'en' && site.S('working_hours_en')) || site.S('working_hours'))
const year = new Date().getFullYear()
const copy = computed(() => site.t('© {year} {name}. Bảo lưu mọi quyền.').replace('{year}', String(year)).replace('{name}', site.S('company_name')))
const note = computed(() => site.t('Nội dung, thương hiệu và hình ảnh trên website thuộc quyền sở hữu của {name} và các chủ sở hữu tương ứng. Không sao chép khi chưa có sự đồng ý bằng văn bản.').replace('{name}', site.S('company_name')))
const legal = Object.keys(LEGAL_SLUGS)
</script>

<template>
  <footer class="ft2">
    <div class="w ftg">
      <div class="ftb">
        <RouterLink class="brand ftl" to="/" aria-label="3RDHub Vietnam"><BrandMark /></RouterLink>
        <p class="ftd">Nền tảng tiếp thị liên kết kết nối Advertiser tài chính với mạng lưới publisher. Mỗi lượt bấm, mỗi hồ sơ và mỗi đồng hoa hồng đều được ghi nhận.</p>
        <div class="ftsoc">
          <a v-for="s in socials" :key="s.k" :href="s.url" target="_blank" rel="noopener noreferrer" :aria-label="s.label"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="s.path" /></svg></a>
        </div>
      </div>
      <nav class="ftc" aria-label="Khám phá">
        <h3>Khám phá</h3>
        <RouterLink v-for="n in NAV" :key="n[0]" :to="'/' + n[0]">{{ $t(n[1]) }}</RouterLink>
      </nav>
      <nav class="ftc" aria-label="Pháp lý">
        <h3>Pháp lý</h3>
        <RouterLink :to="'/' + legal[0]">Điều khoản sử dụng</RouterLink>
        <RouterLink :to="'/' + legal[1]">Chính sách bảo mật</RouterLink>
      </nav>
      <div class="ftc ftco">
        <h3>Thông tin công ty</h3>
        <ul>
          <li class="coname"><b>{{ site.S('company_name') }}</b></li>
          <li><span>Mã số thuế</span><b>{{ site.S('tax_id') }}</b></li>
          <li v-if="site.S('address')"><span>Địa chỉ</span><b>{{ site.S('address') }}</b></li>
          <li><span>Website công ty</span><a :href="site.S('parent_url')" target="_blank" rel="noopener">{{ site.S('parent_url').replace(/^https?:\/\//, '').replace(/\/$/, '') }}</a></li>
          <li><span>Email</span><a :href="'mailto:' + site.S('email')">{{ site.S('email') }}</a></li>
          <li><span>Hotline</span><a :href="'tel:' + site.S('hotline_tel')">{{ site.S('hotline') }}</a></li>
          <li v-if="hours"><span>Giờ làm việc</span><b>{{ hours }}</b></li>
        </ul>
      </div>
    </div>
    <div class="w ftbot">
      <p class="ftcopy">{{ copy }}</p>
      <p class="ftnote">{{ note }}</p>
    </div>
  </footer>
</template>
