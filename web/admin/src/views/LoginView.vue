<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAdmin } from '../store'
import BrandLogo from '../components/BrandLogo.vue'

const a = useAdmin()
const pw = ref('')
const busy = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function submit() {
  busy.value = true
  try { await a.login(pw.value) } catch { input.value?.select() } finally { busy.value = false }
}
onMounted(() => input.value?.focus())
</script>

<template>
  <div class="login">
    <form @submit.prevent="submit">
      <BrandLogo />
      <h1>Đăng nhập quản trị</h1>
      <p>Quản lý nội dung website 3RDHub Vietnam.</p>
      <div v-if="a.loginError" class="msg err" role="alert">{{ a.loginError }}</div>
      <label class="f" for="pw">Mật khẩu<input id="pw" ref="input" v-model="pw" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit" :disabled="busy">Đăng nhập</button>
    </form>
  </div>
</template>
