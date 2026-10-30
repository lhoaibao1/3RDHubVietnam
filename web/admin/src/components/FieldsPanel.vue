<script setup lang="ts">
import { useAdmin } from '../store'
import type { Field } from '../types'

// Khung các ô cài đặt (tên công ty, link, SEO...). Để trống ô thì dùng giá trị mặc định (hiện mờ trong ô).
defineProps<{ title: string; sub: string; fields: Field[] }>()
const a = useAdmin()

function set(key: string, v: string) {
  const val = v.trim()
  if (val) a.content!.settings[key] = val
  else delete a.content!.settings[key]
}
</script>

<template>
  <div class="panel">
    <h2>{{ title }}</h2>
    <p class="sub">{{ sub }}</p>
    <div class="grid g2">
      <div v-for="f in fields" :key="f.key" :style="f.wide ? 'grid-column:1/-1' : undefined">
        <label class="f">{{ f.label }}
          <textarea v-if="f.big" rows="3" :placeholder="a.defaults!.settings[f.key] || ''" :value="a.content!.settings[f.key] || ''" @input="set(f.key, ($event.target as HTMLTextAreaElement).value)" />
          <input v-else :type="f.type || 'text'" :placeholder="a.defaults!.settings[f.key] || ''" :value="a.content!.settings[f.key] || ''" @input="set(f.key, ($event.target as HTMLInputElement).value)">
          <small>{{ f.hint }}</small>
        </label>
      </div>
    </div>
  </div>
</template>
