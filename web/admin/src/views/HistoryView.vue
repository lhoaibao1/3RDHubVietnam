<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { fmt, useAdmin } from '../store'
import type { Content } from '@/lib/content'
import type { Revision } from '../types'

const a = useAdmin()
const revs = ref<Revision[] | null>(null)
const error = ref('')

async function load() {
  try { revs.value = await api<Revision[]>('GET', 'revisions') } catch (e) { error.value = (e as Error).message }
}
async function restore(r: Revision) {
  if (a.dirty && !confirm('Bạn đang có thay đổi chưa lưu, khôi phục sẽ bỏ chúng. Tiếp tục?')) return
  if (!confirm('Khôi phục phiên bản ' + fmt(r.ts) + '? Website sẽ đổi ngay.')) return
  try {
    const x = await api<{ content: Content }>('POST', 'revisions/' + r.id + '/restore')
    a.adopt(x.content)
    a.say('Đã khôi phục')
    await load()
  } catch (e) {
    a.say((e as Error).message, true)
  }
}
onMounted(load)
</script>

<template>
  <div class="panel">
    <h2>Các phiên bản đã lưu</h2>
    <p class="sub">Mỗi lần bấm Lưu tạo một phiên bản (giữ 60 bản gần nhất). Khôi phục sẽ đưa nội dung về thời điểm đó và tạo thêm một phiên bản mới.</p>
    <p v-if="error" class="sub">{{ error }}</p>
    <p v-else-if="!revs" class="sub">Đang tải…</p>
    <div v-else-if="!revs.length" class="empty">Chưa có phiên bản nào.</div>
    <div v-for="(r, i) in revs" :key="r.id" class="hist">
      <small>{{ fmt(r.ts) }}</small>
      <div><b>{{ r.note || 'Lưu thay đổi' }}</b><br><small>{{ r.ov }} chữ tuỳ chỉnh · {{ r.faq }} câu hỏi · {{ r.partners }} đối tác</small></div>
      <span v-if="i === 0" class="tag ok">Mới nhất</span>
      <button v-else class="btn gh sm" type="button" @click="restore(r)">Khôi phục</button>
    </div>
  </div>
</template>
