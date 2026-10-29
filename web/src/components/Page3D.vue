<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { hidePage3D, showPage3D } from '@/three/pages3d'
import { useSite } from '@/stores/site'

// Khung 3D của một trang module: canvas dùng chung được gắn vào đây khi trang mở, gỡ ra khi rời trang.
const props = defineProps<{ id: string; tint: string }>()
const site = useSite()
const slot = ref<HTMLElement | null>(null)

onMounted(() => {
  try {
    if (slot.value) showPage3D(slot.value, props.id, site.partners)
  } catch (e) {
    console.error(e)
  }
})
onBeforeUnmount(() => hidePage3D())
</script>

<template>
  <div ref="slot" class="p3d" :style="{ '--tint': tint }"><slot /></div>
</template>
