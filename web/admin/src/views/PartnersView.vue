<script setup lang="ts">
import { computed } from 'vue'
import { api } from '../api'
import { useAdmin } from '../store'
import type { Partner } from '@/lib/content'

const a = useAdmin()
const ps = computed(() => a.content!.partners)
const groups = computed(() => [...new Set(ps.value.map((p) => p.group.vi))])
const uid = () => 'p' + Math.random().toString(36).slice(2, 8)

function add() {
  const last = ps.value[ps.value.length - 1]
  ps.value.push({ id: uid(), name: '', logo: '', group: last ? a.cloneOf(last.group) : { vi: 'Công ty tài chính', en: 'Finance company' } })
}
function restore() {
  if (confirm('Khôi phục danh sách đối tác mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.partners = a.cloneOf(a.defaults!.partners)
}
function move(i: number, d: number) {
  const j = i + d
  const arr = ps.value
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
function remove(i: number) {
  if (confirm('Xoá đối tác "' + (ps.value[i].name || 'chưa đặt tên') + '"?')) ps.value.splice(i, 1)
}
function groupChanged(p: Partner) {
  const m = ps.value.find((x) => x !== p && x.group.vi === p.group.vi && x.group.en)
  if (m) p.group.en = m.group.en
}
async function upload(p: Partner, e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (f.size > 2 * 1024 * 1024) { a.say('Ảnh quá lớn (tối đa 2MB).', true); return }
  a.say('Đang tải logo lên…')
  try {
    const r = await api<{ path: string }>('POST', 'upload', undefined, { body: f, headers: { 'X-Filename': encodeURIComponent(f.name), 'Content-Type': 'application/octet-stream' } })
    p.logo = r.path
    a.say('Đã tải logo. Nhớ bấm Lưu.')
  } catch (err) {
    a.say((err as Error).message, true)
  }
}
const en = (p: { vi: string; en?: string }) => p.en ?? ''
</script>

<template>
  <div class="bar">
    <button class="btn" type="button" @click="add">+ Thêm đối tác</button>
    <button class="btn gh" type="button" @click="restore">Khôi phục mặc định</button>
    <span class="sub" style="margin:0">{{ ps.length }} đối tác. Website chỉ hiện logo (không có link). Thứ tự ở đây là thứ tự hiện trên website (trong từng nhóm).</span>
  </div>
  <datalist id="groups"><option v-for="g in groups" :key="g" :value="g" /></datalist>
  <div class="plist">
    <div v-for="(p, i) in ps" :key="p.id || i" class="pcard">
      <div class="logo"><img v-if="p.logo" :src="p.logo" :alt="p.name"><span v-else>Chưa có logo</span></div>
      <div class="bar" style="margin:0">
        <label class="btn gh sm" style="cursor:pointer">{{ p.logo ? 'Đổi logo' : 'Tải logo' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="upload(p, $event)"></label>
        <button v-if="p.logo" class="btn gh sm" type="button" @click="p.logo = ''">Bỏ logo</button>
        <span style="flex:1" />
        <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button class="ib" type="button" title="Xuống" :disabled="i === ps.length - 1" @click="move(i, 1)">↓</button>
        <button class="ib" type="button" title="Xoá" @click="remove(i)">✕</button>
      </div>
      <label class="f">Tên đối tác<input v-model="p.name" type="text"></label>
      <div class="row2">
        <label class="f">Nhóm (VI)<input v-model="p.group.vi" type="text" list="groups" @input="groupChanged(p)"></label>
        <label class="f">Nhóm (EN)<input :value="en(p.group)" type="text" @input="p.group.en = ($event.target as HTMLInputElement).value"></label>
      </div>
    </div>
  </div>
</template>
