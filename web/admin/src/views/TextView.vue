<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAdmin } from '../store'
import type { StringItem, Strings } from '../types'
import strings from '../strings.json'
import AutoTextarea from '../components/AutoTextarea.vue'

// Sửa từng đoạn chữ của một trang (hoặc nhóm trang) trên website. Khoá là chuỗi gốc tiếng Việt; chỉ lưu những đoạn khác bản gốc.
const PAGE = 30
const props = defineProps<{ groups: string[] }>()
const a = useAdmin()
const S = strings as Strings
const scope = computed(() => S.items.filter((it) => props.groups.includes(it.g)))
const ov = computed(() => a.content!.ov)

const q = ref('')
const group = ref('*')
watch(() => props.groups, () => { group.value = '*'; page.value = 0 })
const only = ref(false)
const page = ref(0)

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return scope.value.filter((it) => {
    if (group.value !== '*' && it.g !== group.value) return false
    if (only.value && !ov.value[it.k]) return false
    if (!s) return true
    const o = ov.value[it.k] || {}
    return (it.k + ' ' + it.en + ' ' + (o.vi || '') + ' ' + (o.en || '')).toLowerCase().includes(s)
  })
})
const pages = computed(() => Math.max(1, Math.ceil(list.value.length / PAGE)))
watch([q, group, only], () => { page.value = 0 })
watch(pages, (n) => { if (page.value >= n) page.value = n - 1 })
const shown = computed(() => list.value.slice(page.value * PAGE, page.value * PAGE + PAGE))

function cur(it: StringItem, lg: 'vi' | 'en') {
  return ov.value[it.k]?.[lg] ?? (lg === 'vi' ? it.k : it.en)
}
function setField(it: StringItem, lg: 'vi' | 'en', val: string) {
  const def = lg === 'vi' ? it.k : it.en
  const v = val.replace(/\r\n/g, '\n').trim()
  if (v === def.trim() || !v) {
    if (ov.value[it.k]) delete ov.value[it.k][lg]
  } else {
    (ov.value[it.k] = ov.value[it.k] || {})[lg] = v
  }
  const o = ov.value[it.k]
  if (o && !o.vi && !o.en) delete ov.value[it.k]
}
const busy = ref('')
/** Dịch riêng đoạn này từ tiếng Việt sang English và điền vào ô (bấm Lưu để đăng). */
async function tr(it: StringItem) {
  busy.value = it.k
  const [en] = await a.translate([cur(it, 'vi')])
  busy.value = ''
  if (en) setField(it, 'en', en)
}
function reset(it: StringItem) { delete ov.value[it.k] }
function turn(d: number) { page.value += d; window.scrollTo(0, 0) }
</script>

<template>
  <div class="bar">
    <input v-model="q" type="search" class="grow" placeholder="Tìm chữ cần sửa…" aria-label="Tìm chữ">
    <select v-if="groups.length > 1" v-model="group" aria-label="Lọc theo khu vực">
      <option value="*">Tất cả khu vực ({{ scope.length }})</option>
      <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
    </select>
    <label style="display:flex;gap:8px;align-items:center;font-weight:800"><input v-model="only" type="checkbox">Chỉ đã sửa</label>
  </div>
  <p class="sub">{{ list.length }} đoạn chữ. Ô viền cam là đoạn đã tuỳ chỉnh. Chữ gốc hiện nhỏ phía trên mỗi ô.</p>
  <div v-if="!list.length" class="empty">Không có đoạn chữ phù hợp.</div>
  <template v-else>
    <div v-if="pages > 1" class="pager">
      <button class="btn gh sm" type="button" :disabled="page === 0" @click="turn(-1)">← Trước</button>Trang {{ page + 1 }}/{{ pages }}<button class="btn gh sm" type="button" :disabled="page >= pages - 1" @click="turn(1)">Sau →</button>
    </div>
    <div v-for="it in shown" :key="it.k" class="trow" :class="{ chg: !!ov[it.k] }">
      <div class="meta">
        <span class="tag">{{ it.g }}</span>
        <span v-if="ov[it.k]" class="tag or">Đã sửa</span>
        <span class="orig">{{ ov[it.k] ? 'Gốc: ' + it.k.slice(0, 140) : '' }}</span>
        <button class="btn gh sm" type="button" title="Về chữ gốc" @click="reset(it)">Về gốc</button>
      </div>
      <div class="cols">
        <label>Tiếng Việt<AutoTextarea :model-value="cur(it, 'vi')" @update:model-value="setField(it, 'vi', $event)" /></label>
        <label>English <span v-if="ov[it.k]?.x" class="tag">Tự dịch</span><span v-else-if="ov[it.k]?.vi && !ov[it.k]?.en" class="tag or">Sẽ tự dịch khi lưu</span><button class="btn gh sm trbtn" type="button" :disabled="busy === it.k" @click.prevent="tr(it)">{{ busy === it.k ? 'Đang dịch…' : 'Dịch từ tiếng Việt' }}</button><AutoTextarea :model-value="cur(it, 'en')" @update:model-value="setField(it, 'en', $event)" /></label>
      </div>
    </div>
    <div v-if="pages > 1" class="pager">
      <button class="btn gh sm" type="button" :disabled="page === 0" @click="turn(-1)">← Trước</button>Trang {{ page + 1 }}/{{ pages }}<button class="btn gh sm" type="button" :disabled="page >= pages - 1" @click="turn(1)">Sau →</button>
    </div>
  </template>
</template>
