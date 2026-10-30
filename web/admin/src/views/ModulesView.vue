<script setup lang="ts">
import { computed } from 'vue'
import { useAdmin } from '../store'

// Các nhóm chức năng của phần mềm, hiện ở trang Sản phẩm (mục "Toàn bộ module HUB"). Chỉ cần viết tiếng Việt, tự dịch khi lưu.
const a = useAdmin()
const mods = computed(() => a.content!.product!.modules)
// Các dự án (dòng sản phẩm) hiện đầu trang Sản phẩm, mỗi dự án có phần giải thích và danh sách "Có gì".
const prjs = computed(() => a.content!.product!.projects!)
const ICONS: [string, string][] = [['layers', 'Lớp (SaaS)'], ['globe', 'Quả địa cầu (Website)'], ['database', 'Cơ sở dữ liệu (CRM/ERP)'], ['mail', 'Thư (Email)'], ['blocks', 'Khối'], ['cpu', 'Chip'], ['network', 'Mạng'], ['workflow', 'Quy trình'], ['box', 'Hộp'], ['smartphone', 'Điện thoại']]
function addP() { prjs.value.push({ id: 'p' + Math.random().toString(36).slice(2, 7), icon: 'blocks', name: { vi: '', en: '' }, tag: { vi: '', en: '' }, desc: { vi: '', en: '' }, points: [{ vi: '', en: '' }] }) }
function restoreP() { if (confirm('Khôi phục các dự án mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.product!.projects = a.cloneOf(a.defaults!.product.projects || []) }
function moveP(i: number, d: number) { const j = i + d, arr = prjs.value; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]] }
function removeP(i: number) { if (confirm('Xoá dự án "' + (prjs.value[i].name.vi || 'chưa đặt tên') + '"?')) prjs.value.splice(i, 1) }
const uid = () => 'm' + Math.random().toString(36).slice(2, 7)
function add() { mods.value.push({ id: uid(), code: { vi: String(mods.value.length + 1).padStart(2, '0') + ' · ', en: '' }, title: { vi: '', en: '' }, items: [{ vi: '', en: '' }] }) }
function restore() { if (confirm('Khôi phục các nhóm chức năng mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.product!.modules = a.cloneOf(a.defaults!.product.modules) }
function move(i: number, d: number) { const j = i + d, arr = mods.value; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]] }
function remove(i: number) { if (confirm('Xoá nhóm "' + (mods.value[i].title.vi || 'chưa đặt tên') + '"?')) mods.value.splice(i, 1) }
</script>

<template>
  <div class="panel">
    <h2>Dự án (dòng sản phẩm)</h2>
    <p class="sub">Hiện đầu trang Sản phẩm: thẻ tóm tắt, rồi mỗi dự án một mục "Là gì" và "Có gì". Dự án có mã <b>saas</b> hiện thêm module, ảnh giao diện, so sánh và các gói bên dưới. Trống thì website dùng danh sách mặc định.</p>
    <div class="bar">
      <button class="btn" type="button" @click="addP">+ Thêm dự án</button>
      <button class="btn gh" type="button" @click="restoreP">Khôi phục mặc định</button>
    </div>
    <div class="mgrid">
      <div v-for="(p, i) in prjs" :key="i" class="panel" style="margin:0">
        <div class="bar" style="margin:0 0 8px">
          <select v-model="p.icon" aria-label="Biểu tượng" style="max-width:200px"><option v-for="o in ICONS" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select>
          <span style="flex:1" />
          <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="moveP(i, -1)">↑</button>
          <button class="ib" type="button" title="Xuống" :disabled="i === prjs.length - 1" @click="moveP(i, 1)">↓</button>
          <button class="ib" type="button" title="Xoá" @click="removeP(i)">✕</button>
        </div>
        <label class="f">Tên dự án<input v-model="p.name.vi" type="text"></label>
        <label class="f">Mô tả ngắn (một dòng)<input v-model="p.tag.vi" type="text"></label>
        <label class="f">Giải thích (Là gì)<textarea v-model="p.desc.vi" rows="4" /></label>
        <label class="f">Mã (dùng cho đường dẫn, chỉ chữ thường không dấu)<input v-model="p.id" type="text" pattern="[a-z0-9-]+"></label>
        <div class="sub" style="margin:8px 0 0">Có gì</div>
        <div v-for="(it, k) in p.points" :key="k" style="display:flex;gap:8px;margin-top:8px"><input v-model="it.vi" type="text" style="flex:1" placeholder="Một ý"><button class="ib" type="button" title="Xoá dòng" @click="p.points.splice(k, 1)">✕</button></div>
        <button class="btn gh sm" type="button" style="margin-top:8px" @click="p.points.push({ vi: '', en: '' })">+ Thêm ý</button>
      </div>
    </div>
  </div>
  <h2 style="margin:18px 0 10px">Module của SaaS 3RDVN HUB</h2>
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
