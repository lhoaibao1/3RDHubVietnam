<script setup lang="ts">
import { useSite } from '@/stores/site'

// Bảng so sánh các gói: cột là các gói báo giá, dòng sửa trong CMS (mục Báo giá).
const site = useSite()
const yes = (s: string) => /^(có|yes)$/i.test(s.trim())
</script>

<template>
  <div v-if="site.quoteRows.length" class="cmpw" data-cms="quote"><table class="cmp">
    <thead><tr><th>{{ $t('Hạng mục') }}</th><th v-for="p in site.quotePlans" :key="p.id">{{ site.pick(p.name) }} <small>{{ site.pick(p.price) }}</small></th></tr></thead>
    <tbody>
      <tr v-for="(r, i) in site.quoteRows" :key="i">
        <th>{{ site.pick(r.label) }}</th>
        <td v-for="(p, k) in site.quotePlans" :key="p.id" :data-l="site.pick(p.name)" :class="{ y: yes(site.pick(r.cells[k])) }">{{ r.cells[k] ? site.pick(r.cells[k]) : '' }}</td>
      </tr>
    </tbody>
  </table></div>
</template>
