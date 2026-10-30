<script setup lang="ts">
import { computed } from 'vue'
import { api } from '../api'
import { useAdmin } from '../store'
import type { Client } from '@/lib/content'

// Khách hàng của chúng tôi: chỉ logo, hiện ngay dưới khu Đối tác. Trống thì ẩn mục đó.
const a = useAdmin()
const list = computed(() => a.content!.clients!)
const uid = () => 'c' + Math.random().toString(36).slice(2, 8)
function add() { list.value.push({ id: uid(), name: '', logo: '', url: '', desc: { vi: '', en: '' } }) }
function restore() { if (confirm('Khôi phục danh sách khách hàng mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.clients = a.cloneOf(a.defaults!.clients) }
function move(i: number, d: number) { const j = i + d, arr = list.value; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]] }
function remove(i: number) { if (confirm('Xoá khách hàng "' + (list.value[i].name || 'chưa đặt tên') + '"?')) list.value.splice(i, 1) }
async function upload(c: Client, e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (f.size > 2 * 1024 * 1024) { a.say('Ảnh quá lớn (tối đa 2MB).', true); return }
  try {
    const r = await api<{ path: string }>('POST', 'upload', undefined, { body: f, headers: { 'X-Filename': encodeURIComponent(f.name), 'Content-Type': 'application/octet-stream' } })
    c.logo = r.path
    a.say('Đã tải logo. Nhớ bấm Lưu.')
  } catch (err) { a.say((err as Error).message, true) }
}
</script>

<template>
  <div class="bar">
    <button class="btn" type="button" @click="add">+ Thêm khách hàng</button>
    <button class="btn gh" type="button" @click="restore">Khôi phục mặc định</button>
    <span class="sub" style="margin:0">{{ list.length }} khách hàng. Chỉ hiện logo, ngay dưới khu Đối tác (trang chủ và trang Đối tác). Danh sách trống thì mục này ẩn.</span>
  </div>
  <div class="plist">
    <div v-for="(c, i) in list" :key="c.id" class="pcard">
      <div class="logo"><img v-if="c.logo" :src="c.logo" :alt="c.name"><span v-else>Chưa có logo (tạm hiện tên)</span></div>
      <div class="bar" style="margin:0">
        <label class="btn gh sm" style="cursor:pointer">{{ c.logo ? 'Đổi logo' : 'Tải logo' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="upload(c, $event)"></label>
        <button v-if="c.logo" class="btn gh sm" type="button" @click="c.logo = ''">Bỏ logo</button>
        <span style="flex:1" />
        <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button class="ib" type="button" title="Xuống" :disabled="i === list.length - 1" @click="move(i, 1)">↓</button>
        <button class="ib" type="button" title="Xoá" @click="remove(i)">✕</button>
      </div>
      <label class="f">Tên (không hiện trên web, dùng khi chưa có logo)<input v-model="c.name" type="text"></label>
    </div>
  </div>
</template>
