<script setup lang="ts">
import { ref } from 'vue'
import { RM } from '@/three/core'

// <details> có hiệu ứng mở/đóng mượt; nội dung nhiều dòng tách theo "\n".
const props = defineProps<{ summary: string; text: string; open?: boolean }>()
const el = ref<HTMLDetailsElement | null>(null)
const body = ref<HTMLElement | null>(null)

function toggle() {
  const d = el.value!
  const p = body.value!
  if (RM || !p.animate) { d.open = !d.open; return }
  if (d.open) {
    const h = p.offsetHeight
    const a = p.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 280, easing: 'cubic-bezier(.4,0,.2,1)' })
    p.style.overflow = 'hidden'
    a.onfinish = () => { d.open = false; p.style.overflow = '' }
  } else {
    d.open = true
    const h2 = p.offsetHeight
    p.style.overflow = 'hidden'
    const a2 = p.animate([{ height: '0px', opacity: 0, transform: 'translateY(-6px)' }, { height: h2 + 'px', opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' })
    a2.onfinish = () => { p.style.overflow = '' }
  }
}
</script>

<template>
  <details ref="el" :open="props.open">
    <summary @click.prevent="toggle">{{ summary }}</summary>
    <p ref="body"><template v-for="(l, i) in text.split('\n')" :key="i"><br v-if="i">{{ l }}</template></p>
  </details>
</template>
