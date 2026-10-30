<script setup lang="ts">
import { computed } from 'vue'
import { useAdmin } from '../store'

// Các nhóm chức năng của phần mềm, hiện ở trang Sản phẩm (mục "Toàn bộ module HUB"). Chỉ cần viết tiếng Việt, tự dịch khi lưu.
const a = useAdmin()
const mods = computed(() => a.content!.product!.modules)
const uid = () => 'm' + Math.random().toString(36).slice(2, 7)
function add() { mods.value.push({ id: uid(), code: { vi: String(mods.value.length + 1).padStart(2, '0') + ' · ', en: '' }, title: { vi: '', en: '' }, items: [{ vi: '', en: '' }] }) }
function restore() { if (confirm('Khôi phục các nhóm chức năng mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.product!.modules = a.cloneOf(a.defaults!.product.modules) }
function move(i: number, d: number) { const j = i + d, arr = mods.value; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]] }
function remove(i: number) { if (confirm('Xoá nhóm "' + (mods.value[i].title.vi || 'chưa đặt tên') + '"?')) mods.value.splice(i, 1) }
</script>

<template>
  <div class="bar">
    <button class="btn" type="button" @click="add">+ Thêm nhóm chức năng</button>
    <button class="btn gh" type="button" @click="restore">Khôi phục mặc định</button>
    <span class="sub" style="margin:0">{{ mods.length }} nhóm, hiện ở trang Sản phẩm. Trống thì website dùng danh sách mặc định.</span>
  </div>
  <div class="mgrid">
    <div v-for="(m, i) in mods" :key="m.id" class="panel" style="margin:0">
      <div class="bar" style="margin:0 0 8px">
        <input v-model="m.code.vi" type="text" style="max-width:170px" aria-label="Mã nhóm" placeholder="01 · ĐIỀU HÀNH">
        <span style="flex:1" />
        <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button class="ib" type="button" title="Xuống" :disabled="i === mods.length - 1" @click="move(i, 1)">↓</button>
        <button class="ib" type="button" title="Xoá" @click="remove(i)">✕</button>
      </div>
      <label class="f">Tên nhóm<input v-model="m.title.vi" type="text"></label>
      <div v-for="(it, k) in m.items" :key="k" style="display:flex;gap:8px;margin-top:8px"><input v-model="it.vi" type="text" style="flex:1" placeholder="Một dòng chức năng"><button class="ib" type="button" title="Xoá dòng" @click="m.items.splice(k, 1)">✕</button></div>
      <button class="btn gh sm" type="button" style="margin-top:8px" @click="m.items.push({ vi: '', en: '' })">+ Thêm dòng</button>
    </div>
  </div>
</template>
