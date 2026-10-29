<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useAdmin } from '../store'
import type { Faq } from '@/lib/content'
import AutoTextarea from '../components/AutoTextarea.vue'

const a = useAdmin()
const faq = computed(() => a.content!.faq)
const cats = computed(() => [...new Set(faq.value.map((f) => f.cat.vi))])
const open = reactive<Record<string, boolean>>({})
const uid = () => 'f' + Math.random().toString(36).slice(2, 8)

function add() {
  const last = faq.value[faq.value.length - 1]
  const id = uid()
  faq.value.push({ id, cat: last ? a.cloneOf(last.cat) : { vi: 'Chung', en: 'General' }, q: { vi: '', en: '' }, a: { vi: '', en: '' }, home: false })
  open[id] = true
}
function restore() {
  if (confirm('Khôi phục toàn bộ hỏi đáp về danh sách mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.faq = a.cloneOf(a.defaults!.faq)
}
function move(i: number, d: number) {
  const j = i + d
  const arr = faq.value
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
function remove(i: number) {
  if (confirm('Xoá câu hỏi này?')) faq.value.splice(i, 1)
}
/** Chọn nhóm đã có thì tự điền luôn tên tiếng Anh của nhóm đó. */
function catChanged(f: Faq) {
  const m = faq.value.find((x) => x !== f && x.cat.vi === f.cat.vi && x.cat.en)
  if (m) f.cat.en = m.cat.en
}
function toggle(f: Faq) { open[f.id] = !open[f.id] }
const en = (p: { vi: string; en?: string }) => p.en ?? ''
</script>

<template>
  <div class="bar">
    <button class="btn" type="button" @click="add">+ Thêm câu hỏi</button>
    <button class="btn gh" type="button" @click="restore">Khôi phục mặc định</button>
    <span class="sub" style="margin:0">{{ faq.length }} câu hỏi. Câu có dấu "Trang chủ" sẽ hiện ở mục Hỏi đáp của trang chủ.</span>
  </div>
  <datalist id="cats"><option v-for="c in cats" :key="c" :value="c" /></datalist>
  <div v-if="!faq.length" class="empty">Chưa có câu hỏi nào.</div>
  <div v-for="(f, i) in faq" :key="f.id" class="item" :class="{ open: open[f.id] }">
    <div class="hd" @click="(e) => { if (!(e.target as HTMLElement).closest('.acts')) toggle(f) }">
      <span class="tag">{{ f.cat.vi || '—' }}</span>
      <span class="t">{{ f.q.vi || '(câu hỏi mới)' }}</span>
      <span v-if="f.home" class="tag or">Trang chủ</span>
      <div class="acts">
        <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button class="ib" type="button" title="Xuống" :disabled="i === faq.length - 1" @click="move(i, 1)">↓</button>
        <button class="ib" type="button" title="Xoá" @click="remove(i)">✕</button>
      </div>
    </div>
    <div class="bd">
      <div class="row2">
        <label class="f">Nhóm (Tiếng Việt)<input v-model="f.cat.vi" type="text" list="cats" @input="catChanged(f)"></label>
        <label class="f">Nhóm (English)<input v-model="f.cat.en" type="text"></label>
      </div>
      <div class="row2">
        <label class="f">Câu hỏi (Tiếng Việt)<input v-model="f.q.vi" type="text"></label>
        <label class="f">Câu hỏi (English)<input v-model="f.q.en" type="text"></label>
      </div>
      <div class="row2">
        <label class="f">Trả lời (Tiếng Việt)<AutoTextarea v-model="f.a.vi" /></label>
        <label class="f">Trả lời (English)<AutoTextarea :model-value="en(f.a)" @update:model-value="f.a.en = $event" /></label>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-weight:800"><input v-model="f.home" type="checkbox">Hiện ở mục Hỏi đáp của trang chủ</label>
    </div>
  </div>
</template>
