<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { hidePage3D, showPage3D } from '@/three/pages3d'
import { hideStyledPage, showStyledPage } from '@/three/scenes'
import { useSite } from '@/stores/site'

// Khung 3D của một trang module: canvas dùng chung được gắn vào đây khi trang mở, gỡ ra khi rời trang.
// Kiểu cảnh (cũ hoặc ba kiểu mới) lấy từ cài đặt CMS, hoặc ?scene=... để xem thử.
const props = defineProps<{ id: string; tint: string }>()
const site = useSite()
const slot = ref<HTMLElement | null>(null)

function mount() {
  try {
    if (!slot.value) return
    if (site.sceneStyle === 'classic') { hideStyledPage(); showPage3D(slot.value, props.id, site.partners) }
    else { hidePage3D(); showStyledPage(site.sceneStyle, slot.value, props.id) }
  } catch (e) {
    console.error(e)
  }
}
onMounted(mount)
watch(() => site.sceneStyle, mount)
onBeforeUnmount(() => { hidePage3D(); hideStyledPage() })
</script>

<template>
  <div ref="slot" class="p3d" :class="{ solid: site.sceneStyle !== 'classic' }" :style="{ '--tint': tint }"><slot /></div>
</template>
