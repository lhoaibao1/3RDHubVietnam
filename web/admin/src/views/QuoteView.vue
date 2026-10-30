<script setup lang="ts">
import { computed } from 'vue'
import { useAdmin } from '../store'
import type { QuotePlan } from '@/lib/content'

// Các gói trên trang Báo giá (/baogia). Chỉ cần viết tiếng Việt, bản English tự dịch khi lưu (ô English để trống hoặc đang là bản tự dịch).
const a = useAdmin()
const plans = computed(() => a.content!.quote!.plans)
const uid = () => 'q' + Math.random().toString(36).slice(2, 7)
const empty = () => ({ vi: '', en: '' })

function add() {
  plans.value.push({ id: uid(), name: empty(), price: { vi: 'Liên hệ báo giá', en: '' }, unit: empty(), desc: empty(), features: [empty()], hot: false })
}
function restore() {
  if (confirm('Khôi phục các gói báo giá mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.quote!.plans = a.cloneOf(a.defaults!.quote.plans)
}
function move(i: number, d: number) {
  const j = i + d, arr = plans.value
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
function remove(i: number) {
  if (confirm('Xoá gói "' + (plans.value[i].name.vi || 'chưa đặt tên') + '"?')) plans.value.splice(i, 1)
}
function addFeature(p: QuotePlan) { p.features.push(empty()) }
const en = (p: { en?: string }) => p.en ?? ''
</script>

<template>
  <div class="bar">
    <button class="btn" type="button" @click="add">+ Thêm gói</button>
    <button class="btn gh" type="button" @click="restore">Khôi phục mặc định</button>
    <span class="sub" style="margin:0">{{ plans.length }} gói. Trang trống thì website dùng các gói mặc định. Giá để chữ tuỳ ý (ví dụ "Từ 50.000.000đ" hoặc "Liên hệ báo giá").</span>
  </div>
  <div v-for="(p, i) in plans" :key="p.id" class="panel">
    <div class="bar" style="margin:0 0 10px">
      <h2 style="margin:0">Gói {{ i + 1 }}{{ p.name.vi ? ': ' + p.name.vi : '' }}</h2>
      <label style="display:flex;gap:8px;align-items:center;font-weight:800;margin-left:auto"><input v-model="p.hot" type="checkbox">Nổi bật ("Được chọn nhiều")</label>
      <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="move(i, -1)">↑</button>
      <button class="ib" type="button" title="Xuống" :disabled="i === plans.length - 1" @click="move(i, 1)">↓</button>
      <button class="ib" type="button" title="Xoá" @click="remove(i)">✕</button>
    </div>
    <div class="grid g2">
      <label class="f">Tên gói (Tiếng Việt)<input v-model="p.name.vi" type="text"></label>
      <label class="f">Name (English)<input :value="en(p.name)" type="text" placeholder="Tự dịch khi lưu" @input="p.name.en = ($event.target as HTMLInputElement).value"></label>
      <label class="f">Giá (Tiếng Việt)<input v-model="p.price.vi" type="text"></label>
      <label class="f">Price (English)<input :value="en(p.price)" type="text" placeholder="Tự dịch khi lưu" @input="p.price.en = ($event.target as HTMLInputElement).value"></label>
      <label class="f">Đơn vị / cách tính<input v-model="p.unit.vi" type="text" placeholder="Ví dụ: Theo phạm vi dự án"></label>
      <label class="f">Unit (English)<input :value="en(p.unit)" type="text" placeholder="Tự dịch khi lưu" @input="p.unit.en = ($event.target as HTMLInputElement).value"></label>
      <label class="f">Mô tả ngắn<input v-model="p.desc.vi" type="text"></label>
      <label class="f">Description (English)<input :value="en(p.desc)" type="text" placeholder="Tự dịch khi lưu" @input="p.desc.en = ($event.target as HTMLInputElement).value"></label>
    </div>
    <h3 style="margin:16px 0 8px;font-size:15px">Tính năng trong gói</h3>
    <div v-for="(f, fi) in p.features" :key="fi" class="grid g2" style="margin-bottom:8px;align-items:center">
      <input v-model="f.vi" type="text" placeholder="Một dòng tính năng">
      <div style="display:flex;gap:8px"><input :value="en(f)" type="text" placeholder="Tự dịch khi lưu" style="flex:1" @input="f.en = ($event.target as HTMLInputElement).value"><button class="ib" type="button" title="Xoá dòng" @click="p.features.splice(fi, 1)">✕</button></div>
    </div>
    <button class="btn gh sm" type="button" @click="addFeature(p)">+ Thêm dòng</button>
  </div>
  <div v-if="!plans.length" class="empty">Chưa có gói nào. Bấm "+ Thêm gói" hoặc "Khôi phục mặc định".</div>
</template>
