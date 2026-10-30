<script setup lang="ts">
import { computed } from 'vue'
import { useAdmin } from '../store'
import { api } from '../api'
import type { Shot } from '@/lib/content'

// Các nhóm chức năng của phần mềm, hiện ở trang Sản phẩm (mục "Toàn bộ module HUB"). Chỉ cần viết tiếng Việt, tự dịch khi lưu.
const a = useAdmin()
const mods = computed(() => a.content!.product!.modules)
// Các dự án (dòng sản phẩm) hiện đầu trang Sản phẩm, mỗi dự án có phần giải thích và danh sách "Có gì".
const prjs = computed(() => a.content!.product!.projects!)
const ICONS: [string, string][] = [['layers', 'Lớp (SaaS)'], ['globe', 'Quả địa cầu (Website)'], ['database', 'Cơ sở dữ liệu (CRM/ERP)'], ['mail', 'Thư (Email)'], ['blocks', 'Khối'], ['cpu', 'Chip'], ['network', 'Mạng'], ['workflow', 'Quy trình'], ['box', 'Hộp'], ['smartphone', 'Điện thoại']]
function addP() { prjs.value.push({ id: 'p' + Math.random().toString(36).slice(2, 7), icon: 'blocks', name: { vi: '', en: '' }, tag: { vi: '', en: '' }, desc: { vi: '', en: '' }, points: [{ vi: '', en: '' }] }) }
function restoreP() { if (confirm('Khôi phục các dự án mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.product!.projects = a.cloneOf(a.defaults!.product.projects || []) }
function moveP(i: number, d: number) { const j = i + d, arr = prjs.value; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]] }
// Ảnh giao diện hệ thống (khu "Giao diện hệ thống" của SaaS ở trang Sản phẩm). Xoá hết thì khu ảnh bị ẩn.
const shots = computed<Shot[]>(() => a.content!.product!.shots || [])
// ảnh mẫu (/hub/...) nằm ở website chính, ảnh tải lên (/uploads/...) có ở cả hai tên miền
const siteOrigin = location.protocol + '//' + location.host.replace(/^cms\./, '')
const imgSrc = (p: string) => (p.startsWith('/hub/') ? siteOrigin + p : p)
function ensureShots() { const p = a.content!.product!; if (!p.shots) p.shots = a.cloneOf(a.defaults!.product.shots || []); return p.shots }
async function pickImage(e: Event): Promise<string> {
  const inp = e.target as HTMLInputElement, f = inp.files?.[0]
  inp.value = ''
  if (!f) return ''
  if (f.size > 2 * 1024 * 1024) { a.say('Ảnh tối đa 2MB. Nên dùng ảnh WEBP hoặc JPG rộng khoảng 1280px.', true); return '' }
  try {
    const r = await api<{ path: string }>('POST', 'upload', undefined, { body: f, headers: { 'X-Filename': encodeURIComponent(f.name), 'Content-Type': 'application/octet-stream' } })
    return r.path
  } catch (err) { a.say((err as Error).message, true); return '' }
}
async function addShot(e: Event) {
  const img = await pickImage(e)
  if (img) ensureShots().push({ id: 's' + Math.random().toString(36).slice(2, 7), img, label: { vi: '', en: '' } })
}
async function changeShot(i: number, e: Event) { const img = await pickImage(e); if (img) ensureShots()[i].img = img }
function moveS(i: number, d: number) { const arr = ensureShots(), j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]] }
function removeS(i: number) { const arr = ensureShots(); if (confirm('Gỡ ảnh "' + (arr[i].label.vi || 'chưa đặt tên') + '" khỏi trang Sản phẩm?')) arr.splice(i, 1) }
function restoreS() { if (confirm('Khôi phục bộ ảnh giao diện mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) a.content!.product!.shots = a.cloneOf(a.defaults!.product.shots || []) }
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
  <div class="panel">
    <h2>Ảnh giao diện hệ thống</h2>
    <p class="sub">Các ảnh chạy trong khu "Giao diện hệ thống" của SaaS ở trang Sản phẩm. Gỡ, đổi ảnh, đổi tên hoặc đổi thứ tự rồi bấm Lưu. Gỡ hết thì khu ảnh bị ẩn. Ảnh nên rộng khoảng 1280px, tỉ lệ 16:10, tối đa 2MB, và không để lộ dữ liệu khách hàng.</p>
    <div class="bar">
      <label class="btn" style="cursor:pointer">+ Thêm ảnh<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="addShot"></label>
      <button class="btn gh" type="button" @click="restoreS">Khôi phục mặc định</button>
      <span class="sub" style="margin:0">{{ shots.length }} ảnh</span>
    </div>
    <div v-if="!shots.length" class="empty">Không có ảnh nào: khu "Giao diện hệ thống" đang bị ẩn.</div>
    <div class="shgrid">
      <div v-for="(s, i) in shots" :key="s.id" class="shcard">
        <img :src="imgSrc(s.img)" alt="" loading="lazy">
        <input v-model="s.label.vi" type="text" placeholder="Tên màn hình, ví dụ Tổng quan" aria-label="Tên màn hình">
        <div class="bar" style="margin:0">
          <label class="btn gh sm" style="cursor:pointer">Đổi ảnh<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="changeShot(i, $event)"></label>
          <span style="flex:1" />
          <button class="ib" type="button" title="Lên" :disabled="i === 0" @click="moveS(i, -1)">↑</button>
          <button class="ib" type="button" title="Xuống" :disabled="i === shots.length - 1" @click="moveS(i, 1)">↓</button>
          <button class="ib" type="button" title="Gỡ ảnh" @click="removeS(i)">✕</button>
        </div>
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
