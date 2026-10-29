<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { fmt, useAdmin } from '../store'
import { LEAD_LABEL, type Lead } from '../types'

const a = useAdmin()
const FILTERS: [string, string][] = [['', 'Tất cả'], ['new', 'Mới'], ['contacted', 'Đã liên hệ'], ['done', 'Hoàn tất'], ['spam', 'Spam']]
const status = ref('')
const q = ref('')
const leads = ref<Lead[]>([])
const open = reactive<Record<number, boolean>>({})
const notes = reactive<Record<number, string>>({})
let timer = 0

async function load() {
  const qs: string[] = []
  if (status.value) qs.push('status=' + status.value)
  if (q.value.trim()) qs.push('q=' + encodeURIComponent(q.value.trim()))
  leads.value = await api<Lead[]>('GET', 'leads' + (qs.length ? '?' + qs.join('&') : ''))
  leads.value.forEach((l) => { notes[l.id] = l.note || '' })
}
const guard = (p: Promise<unknown>) => p.catch((e) => a.say((e as Error).message, true))
function setStatus(s: string) { status.value = s; guard(load()) }
function search() { clearTimeout(timer); timer = window.setTimeout(() => guard(load()), 300) }
async function refresh() { await Promise.all([load(), a.refreshCounts()]); a.say('Đã làm mới') }

async function changeStatus(l: Lead, s: Lead['status']) {
  await guard(api('PATCH', 'leads/' + l.id, { status: s }).then(() => { l.status = s; return a.refreshCounts() }))
}
async function saveNote(l: Lead) {
  await guard(api('PATCH', 'leads/' + l.id, { note: notes[l.id] }).then(() => a.say('Đã lưu ghi chú')))
}
async function remove(l: Lead) {
  if (!confirm('Xoá yêu cầu của ' + l.name + '? Không khôi phục được.')) return
  await guard(api('DELETE', 'leads/' + l.id).then(() => { leads.value = leads.value.filter((x) => x.id !== l.id); return a.refreshCounts() }))
}
const badge = (s: Lead['status']) => (s === 'new' ? 'or' : s === 'done' ? 'ok' : s === 'spam' ? 'bad' : '')
const tel = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '')

onMounted(() => { guard(Promise.all([load(), a.refreshCounts()])) })
</script>

<template>
  <div class="bar">
    <div class="chips">
      <button v-for="f in FILTERS" :key="f[0]" type="button" :aria-pressed="status === f[0]" @click="setStatus(f[0])">{{ f[1] }}{{ f[0] && a.leadCounts[f[0]] ? ' (' + a.leadCounts[f[0]] + ')' : '' }}</button>
    </div>
    <input v-model="q" type="search" class="grow" placeholder="Tìm theo tên, số điện thoại, công ty…" aria-label="Tìm yêu cầu" @input="search">
    <button class="btn gh sm" type="button" @click="refresh">Làm mới</button>
    <a class="btn gh sm" href="/api/admin/leads.csv">Tải CSV</a>
  </div>
  <div v-if="!leads.length" class="empty">Chưa có yêu cầu nào.</div>
  <div v-for="l in leads" :key="l.id" class="lead" :class="[l.status, { open: open[l.id] }]">
    <div class="hd" @click="(e) => { if (!(e.target as HTMLElement).closest('select,a')) open[l.id] = !open[l.id] }">
      <b>{{ l.name }}</b>
      <div><a :href="tel(l.phone)">{{ l.phone }}</a><div v-if="l.company"><small>{{ l.company }}</small></div></div>
      <span class="tag" :class="badge(l.status)">{{ LEAD_LABEL[l.status] }}</span>
      <small>{{ fmt(l.ts) }}</small>
    </div>
    <div class="bd">
      <dl class="kv">
        <dt>Nhu cầu</dt><dd>{{ l.need || '—' }}</dd>
        <dt>Công ty</dt><dd>{{ l.company || '—' }}</dd>
        <dt>Ngôn ngữ</dt><dd>{{ l.lang === 'en' ? 'English' : 'Tiếng Việt' }}</dd>
        <dt>IP</dt><dd>{{ l.ip || '—' }}</dd>
      </dl>
      <div v-if="l.message" class="msgbox">{{ l.message }}</div>
      <div class="row2">
        <label class="f">Trạng thái
          <select :value="l.status" aria-label="Trạng thái" @change="changeStatus(l, ($event.target as HTMLSelectElement).value as Lead['status'])">
            <option v-for="(label, k) in LEAD_LABEL" :key="k" :value="k">{{ label }}</option>
          </select>
        </label>
        <label class="f">Ghi chú<textarea v-model="notes[l.id]" rows="2" placeholder="Ghi chú nội bộ…" /></label>
      </div>
      <div class="bar" style="margin:0">
        <button class="btn gh sm" type="button" @click="saveNote(l)">Lưu ghi chú</button>
        <span style="flex:1" />
        <button class="btn bad sm" type="button" @click="remove(l)">Xoá</button>
      </div>
    </div>
  </div>
</template>
