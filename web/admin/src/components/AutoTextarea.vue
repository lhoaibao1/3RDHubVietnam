<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

// textarea tự giãn theo nội dung. Không ghi đè khi người dùng đang gõ: chỉ đồng bộ nếu giá trị
// từ ngoài khác với nội dung hiện có (sau khi bỏ khoảng trắng đầu/cuối), ví dụ khi bấm "Về gốc".
const props = defineProps<{ modelValue: string; rows?: number; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const el = ref<HTMLTextAreaElement | null>(null)

const norm = (s: string) => s.replace(/\r\n/g, '\n').trim()

function grow() {
  const t = el.value
  if (!t) return
  t.style.height = 'auto'
  t.style.height = Math.max(44, t.scrollHeight + 2) + 'px'
}
onMounted(() => {
  el.value!.value = props.modelValue
  requestAnimationFrame(grow)
})
watch(() => props.modelValue, (v) => {
  const t = el.value
  if (t && norm(t.value) !== norm(v)) {
    t.value = v
    nextTick(grow)
  }
})
function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  grow()
}
</script>

<template>
  <textarea ref="el" :rows="rows ?? 1" :placeholder="placeholder" @input="onInput" />
</template>
