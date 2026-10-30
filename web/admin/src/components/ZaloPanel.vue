<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { fmt } from '../store'

// Báo tin qua Zalo Bot cho đội ngũ khi có người đăng ký. Tin Zalo OA cho khách nằm ở ZaloOAPanel.
// Khoá bí mật chỉ nhập, được mã hoá trên máy chủ và không bao giờ hiện lại.
interface Z { bot_on: boolean; bot_chats: string; has_bot_token: boolean }
const z = reactive<Z>({ bot_on: false, bot_chats: '', has_bot_token: false })
const sec = reactive({ bot_token: '' })
const chats = ref<{ id: string; name: string }[]>([])
const busy = ref(false)
const msg = ref('')
const good = ref(false)
const logs = ref<{ ts: number; channel: string; to: string; ok: boolean; err?: string }[]>([])
const say = (t: string, g = false) => { msg.value = t; good.value = g }

async function load() {
  try { Object.assign(z, await api<Z>('GET', 'zalo')); logs.value = await api('GET', 'notify-log') } catch (e) { say((e as Error).message) }
}
onMounted(load)

async function save(extra: Record<string, unknown> = {}) {
  busy.value = true; say('')
  try {
    Object.assign(z, await api<Z>('PUT', 'zalo', { ...z, ...sec, ...extra }))
    sec.bot_token = ''
    say('Đã lưu cấu hình Zalo.', true)
  } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
async function run(path: string, body: object, done: string) {
  busy.value = true; say('Đang gửi…', true)
  try { await api('POST', path, body); say(done, true) } catch (e) { say((e as Error).message) } finally { busy.value = false; load() }
}
async function findChats() {
  busy.value = true; say('')
  try {
    const r = await api<{ chats: { id: string; name: string }[] | null }>('POST', 'zalo-bot-chats', {})
    chats.value = r.chats || []
    say(chats.value.length ? 'Bấm vào một người để thêm vào danh sách nhận tin.' : 'Chưa thấy ai nhắn bot. Mở Zalo, nhắn một tin bất kỳ cho bot rồi bấm lại.', !!chats.value.length)
  } catch (e) { say((e as Error).message) } finally { busy.value = false }
}
function addChat(id: string) {
  const list = z.bot_chats.split(/[,\s]+/).filter(Boolean)
  if (!list.includes(id)) list.push(id)
  z.bot_chats = list.join(', ')
}
</script>

<template>
  <div class="panel">
    <h2>Zalo Bot: báo cho đội ngũ</h2>
    <p class="sub">Khi có người đăng ký, bot nhắn vào Zalo của bạn (hoặc nhóm). Tạo bot tại <a href="https://bot.zaloplatforms.com" target="_blank" rel="noopener">bot.zaloplatforms.com</a>, dán token vào đây, nhắn cho bot một tin rồi bấm "Tìm người đã nhắn bot".</p>
    <div class="grid g2">
      <label class="f">Token của bot<input v-model="sec.bot_token" type="password" autocomplete="off" :placeholder="z.has_bot_token ? 'Đã lưu (mã hoá). Để trống để giữ nguyên' : 'Dạng 1234567890:AbCd...'"></label>
      <label class="f">Chat ID nhận tin<input v-model="z.bot_chats" type="text" placeholder="Nhiều ID cách nhau bởi dấu phẩy"></label>
    </div>
    <div class="bar" style="margin-top:12px">
      <label style="display:flex;gap:8px;align-items:center;font-weight:800"><input v-model="z.bot_on" type="checkbox">Bật báo tin qua Zalo Bot</label>
      <button class="btn gh sm" type="button" :disabled="busy || !z.has_bot_token" @click="findChats">Tìm người đã nhắn bot</button>
      <button class="btn gh sm" type="button" :disabled="busy || !z.has_bot_token" @click="run('zalo-bot-test', {}, 'Đã gửi tin thử qua Zalo Bot.')">Gửi tin thử</button>
    </div>
    <div v-if="chats.length" class="chips" style="margin-top:10px">
      <button v-for="c in chats" :key="c.id" type="button" @click="addChat(c.id)">+ {{ c.name || 'Không tên' }} ({{ c.id }})</button>
    </div>
  </div>

  <div class="panel">
    <div class="bar" style="margin:0">
      <button class="btn" type="button" :disabled="busy" @click="save()">Lưu cấu hình Zalo Bot</button>
      <button v-if="z.has_bot_token" class="btn gh sm" type="button" :disabled="busy" @click="save({ clear_bot_token: true })">Xoá token bot</button>
    </div>
    <div v-if="msg" class="msg" :class="good ? 'ok' : 'err'" style="margin-top:12px">{{ msg }}</div>
  </div>

  <div class="panel">
    <h2>Nhật ký gửi thông báo</h2>
    <p class="sub">40 lần gửi gần nhất (email, Zalo Bot) khi có người đăng ký.</p>
    <div v-if="!logs.length" class="empty">Chưa có lần gửi nào.</div>
    <table v-else class="nlog"><tbody>
      <tr v-for="(l, i) in logs" :key="i"><td>{{ fmt(l.ts) }}</td><td><b>{{ l.channel }}</b></td><td>{{ l.to }}</td><td><span class="tag" :class="l.ok ? 'ok' : 'bad'">{{ l.ok ? 'Đã gửi' : 'Lỗi' }}</span> <small v-if="l.err">{{ l.err }}</small></td></tr>
    </tbody></table>
  </div>
</template>
