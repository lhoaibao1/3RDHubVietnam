<script setup lang="ts">
import { useAdmin } from '../store'
import { SCROLL_FX } from '@/lib/look'

const a = useAdmin()
const scenes = [
  { id: 'classic', name: 'Cổ điển', desc: 'Các đảo trắng sáng với robot linh vật. Nhẹ máy, hợp cả sáng lẫn tối.' },
  { id: 'isometric', name: '3D đẳng cự (Isometric)', desc: 'Hòn đảo nổi nhìn góc isometric: mỗi module là một công trình, nối bằng đường dữ liệu có hạt chạy.' },
  { id: 'factory', name: 'Nhà máy tự động', desc: 'Băng chuyền đưa dữ liệu qua các trạm: cánh tay robot, máy dập, cổng quét, đèn trạng thái.' },
  { id: 'ecosystem', name: 'Hệ sinh thái số', desc: '3RDHub phát sáng ở giữa, Advertiser, Publisher, Tracking, Finance, API, AI bay quanh và trao đổi dữ liệu.' },
  { id: 'orbit', name: 'Trạm không gian (Orbit)', desc: 'Các trạm nổi giữa vũ trụ, hành tinh, sao và vệ tinh bay quanh. Nền tối, cảm giác công nghệ cao.' },
  { id: 'voxel', name: 'Thành phố khối (Voxel)', desc: 'Phong cách đồ chơi khối, nền trời ban ngày, màu tươi và dễ thương. Cảnh luôn sáng.' },
  { id: 'blueprint', name: 'Bản vẽ kỹ thuật (Blueprint)', desc: 'Nền xanh bản vẽ, các công trình dạng khung dây trong suốt, đường dữ liệu phát sáng.' },
  { id: 'neon', name: 'Thành phố Neon', desc: 'Đêm cyberpunk: toà nhà sáng đèn, hoàng hôn tím hồng, viền neon rực.' },
]
const fxNow = () => a.content!.settings.scroll_fx || 'rise'
function pickFx(id: string) { if (id === 'rise') delete a.content!.settings.scroll_fx; else a.content!.settings.scroll_fx = id }
const sceneNow = () => a.content!.settings.scene_style || 'classic'
function pickScene(id: string) { if (id === 'classic') delete a.content!.settings.scene_style; else a.content!.settings.scene_style = id }
/** Trang công khai nằm ở tên miền gốc (bỏ tiền tố cms.). */
const siteBase = location.protocol + '//' + location.host.replace(/^cms\./, '')

</script>

<template>
  <div class="panel">
    <h2>Kiểu cảnh 3D</h2>
    <p class="sub">Chọn kiểu 3D cho trang chủ và các trang con. Mỗi trang con có cảnh riêng theo nội dung của trang. Cảnh tự đổi màu theo chế độ sáng/tối mà khách đang dùng. Bấm "Xem thử" để mở website với kiểu đó (chỉ trên trình duyệt của bạn, chưa ai khác thấy), ưng ý thì chọn rồi bấm Lưu.</p>
    <div class="scenes">
      <div v-for="sc in scenes" :key="sc.id" class="scene" :class="{ on: sceneNow() === sc.id }">
        <button type="button" class="pick" :aria-pressed="sceneNow() === sc.id" @click="pickScene(sc.id)">
          <img :src="'scenes/' + sc.id + '.jpg'" :alt="sc.name" loading="lazy" width="520" height="339">
          <b>{{ sc.name }}</b>
          <small>{{ sc.desc }}</small>
        </button>
        <a class="btn gh sm" :href="siteBase + '/?scene=' + sc.id" target="_blank" rel="noopener">Xem thử</a>
      </div>
    </div>
  </div>
  <div class="panel">
    <h2>Hiệu ứng khi cuộn trang</h2>
    <p class="sub">Các khối nội dung hiện ra theo kiểu bạn chọn, khi cuộn xuống lẫn cuộn lên (cuộn lên thì khối đi vào từ phía trên). Bấm "Xem thử" để mở website với hiệu ứng đó (chỉ trên trình duyệt của bạn), ưng ý thì chọn rồi bấm Lưu.</p>
    <div class="fxs">
      <div v-for="f in SCROLL_FX" :key="f.id" class="scene fx" :class="{ on: fxNow() === f.id }">
        <button type="button" class="pick" :aria-pressed="fxNow() === f.id" @click="pickFx(f.id)">
          <span class="fxdemo" :data-fx="f.id" aria-hidden="true"><i></i><i></i><i></i></span>
          <b>{{ f.name }}</b>
          <small>{{ f.desc }}</small>
        </button>
        <a class="btn gh sm" :href="siteBase + '/?fx=' + f.id" target="_blank" rel="noopener">Xem thử</a>
      </div>
    </div>
  </div>
</template>
