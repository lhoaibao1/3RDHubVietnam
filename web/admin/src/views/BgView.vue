<script setup lang="ts">
import { computed } from 'vue'
import { useAdmin } from '../store'
import { BG_AREAS, BG_PATTERNS, bgDecl, bgValue, parseBg, type Bg } from '@/lib/look'
import '@/styles/patterns.css'

// Nền của từng khu vực trang chủ và từng trang con: chọn hoạ tiết và hai màu, xem trước ngay tại đây.
const a = useAdmin()
const groups = computed(() => [...new Set(BG_AREAS.map((x) => x.group))].map((g) => ({ g, items: BG_AREAS.filter((x) => x.group === g) })))
const cur = (id: string, def: string): Bg => parseBg(a.content!.settings['bg_' + id], def)
const isDefault = (id: string) => !a.content!.settings['bg_' + id]
function set(id: string, def: string, patch: Partial<Bg>) {
  const b = { ...cur(id, def), ...patch }
  if (bgValue(b) === def) delete a.content!.settings['bg_' + id]
  else a.content!.settings['bg_' + id] = bgValue(b)
}
function reset(id: string) { delete a.content!.settings['bg_' + id] }
/** Trang công khai nằm ở tên miền gốc (bỏ tiền tố cms.). */
const siteBase = location.protocol + '//' + location.host.replace(/^cms\./, '')
const PATHS: Record<string, string> = { 'home-biz': '/', 'home-tech': '/', 'home-partners': '/', 'home-faq': '/', 'home-contact': '/', 'bao-gia': '/baogia', 'chinh-sach': '/chinh-sach' }
const pathOf = (id: string) => PATHS[id] || '/' + id
</script>

<template>
  <div class="panel">
    <h2>Nền từng trang</h2>
    <p class="sub">Mỗi khu vực ở trang chủ và mỗi trang con có nền riêng: chọn hoạ tiết và hai màu chủ đạo (vệt màu loang). Nền tự đổi theo chế độ sáng/tối. Sửa xong bấm Lưu rồi mở "Xem trang" để kiểm tra.</p>
    <div v-for="gr in groups" :key="gr.g" class="bggrp">
      <h3>{{ gr.g }}</h3>
      <div class="bgareas">
        <div v-for="ar in gr.items" :key="ar.id" class="bgarea">
          <span class="bgsw" :class="{ off: cur(ar.id, ar.bg).pat === 'none' }" :style="bgDecl(cur(ar.id, ar.bg))" aria-hidden="true"><i></i></span>
          <div class="bgf">
            <b>{{ ar.name }} <small v-if="isDefault(ar.id)">mặc định</small></b>
            <label>Hoạ tiết
              <select :value="cur(ar.id, ar.bg).pat" @change="set(ar.id, ar.bg, { pat: ($event.target as HTMLSelectElement).value })">
                <option v-for="p in BG_PATTERNS" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select></label>
            <div class="bgc">
              <label>Màu 1 <input type="color" :value="cur(ar.id, ar.bg).c1" @input="set(ar.id, ar.bg, { c1: ($event.target as HTMLInputElement).value })"></label>
              <label>Màu 2 <input type="color" :value="cur(ar.id, ar.bg).c2" @input="set(ar.id, ar.bg, { c2: ($event.target as HTMLInputElement).value })"></label>
            </div>
            <div class="bga">
              <button v-if="!isDefault(ar.id)" type="button" class="btn gh sm" @click="reset(ar.id)">Về mặc định</button>
              <a class="btn gh sm" :href="siteBase + pathOf(ar.id)" target="_blank" rel="noopener">Xem trang</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <h3 class="bgall">Tất cả hoạ tiết</h3>
    <div class="bgpats">
      <span v-for="p in BG_PATTERNS" :key="p.id" class="bgpat">
        <span class="bgsw" :class="{ off: p.id === 'none' }" :style="bgDecl({ pat: p.id, c1: '#FF6A2B', c2: '#7B4DFF' })" aria-hidden="true"><i></i></span>
        <small>{{ p.name }}</small>
      </span>
    </div>
  </div>
</template>
