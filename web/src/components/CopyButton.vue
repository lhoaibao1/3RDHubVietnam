<script setup lang="ts">
import { ref } from 'vue'

// Nút "Sao chép": chép `value` vào clipboard rồi đổi chữ thành "Đã chép" một lúc.
const props = defineProps<{ value: string }>()
const done = ref(false)
let timer = 0

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    done.value = true
    clearTimeout(timer)
    timer = window.setTimeout(() => { done.value = false }, 1800)
  } catch { /* trình duyệt không cho chép */ }
}
</script>

<template>
  <button type="button" @click="copy"><slot>{{ done ? $t('Đã chép') : $t('Sao chép') }}</slot></button>
</template>
