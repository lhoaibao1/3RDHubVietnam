// Tạo src/lib/icons.generated.ts từ lucide-static và simple-icons (chỉ các icon đang dùng).
// Chạy: npm run icons   (chỉ cần khi đổi danh sách icon, kết quả đã được commit)
import { readFileSync, writeFileSync } from 'node:fs'
import * as si from 'simple-icons'

const LUCIDE = ['blocks', 'building', 'building-2', 'credit-card', 'file-check', 'flask-conical', 'globe', 'hand-coins', 'key-round', 'landmark', 'link', 'mail', 'megaphone',
  'mouse-pointer-click', 'network', 'brain-circuit', 'cpu', 'database', 'banknote', 'radar', 'workflow', 'chart-column', 'bot', 'scan-line', 'layers', 'box', 'factory', 'cog', 'handshake', 'target', 'smartphone', 'coins', 'map-pin', 'phone', 'clock', 'arrow-up', 'chevron-right', 'file-text', 'shield-check', 'cookie', 'building-2', 'badge-check', 'package', 'phone', 'rocket', 'scroll-text', 'send', 'server', 'shield-check', 'users', 'wallet', 'download', 'message-square-warning', 'tag', 'list-checks', 'undo-2', 'headset']
const BRANDS = ['docker', 'facebook', 'go', 'nginx', 'nuxt', 'pinia', 'postgresql', 'redis', 'tailwindcss', 'tiktok', 'typescript', 'vite', 'vuedotjs', 'zalo', 'youtube', 'instagram']

const all = Object.values(si).filter((v) => v && typeof v === 'object' && 'slug' in v)
const lu = {}
for (const k of LUCIDE) {
  const t = readFileSync(`node_modules/lucide-static/icons/${k}.svg`, 'utf8')
  lu[k] = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(t)[1].replace(/\s+/g, ' ').trim()
}
const br = {}
// LinkedIn không còn trong simple-icons: dùng hình cũ (CC0) của simple-icons
const EXTRA = { linkedin: { p: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z', c: '#0A66C2' } }
Object.assign(br, EXTRA)
for (const k of BRANDS) {
  const i = all.find((x) => x.slug === k)
  if (!i) throw new Error('thiếu icon thương hiệu: ' + k)
  br[k] = { p: i.path, c: '#' + i.hex }
}
writeFileSync('src/lib/icons.generated.ts',
  '// Tệp sinh tự động bởi scripts/gen-icons.mjs, không sửa tay.\n' +
  `export const LUCIDE: Record<string, string> = ${JSON.stringify(lu, null, 1)}\n` +
  `export const BRANDS: Record<string, { p: string; c: string }> = ${JSON.stringify(br, null, 1)}\n`)
console.log('icons:', LUCIDE.length, 'lucide,', BRANDS.length, 'brands')
