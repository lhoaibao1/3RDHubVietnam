// Tạo src/lib/icons.generated.ts từ lucide-static và simple-icons (chỉ các icon đang dùng).
// Chạy: npm run icons   (chỉ cần khi đổi danh sách icon, kết quả đã được commit)
import { readFileSync, writeFileSync } from 'node:fs'
import * as si from 'simple-icons'

const LUCIDE = ['blocks', 'building', 'building-2', 'credit-card', 'file-check', 'flask-conical', 'globe', 'hand-coins', 'key-round', 'landmark', 'link', 'mail', 'megaphone',
  'mouse-pointer-click', 'network', 'brain-circuit', 'cpu', 'database', 'banknote', 'radar', 'workflow', 'chart-column', 'bot', 'scan-line', 'layers', 'box', 'factory', 'cog', 'handshake', 'target', 'smartphone', 'coins', 'badge-check', 'package', 'phone', 'rocket', 'scroll-text', 'send', 'server', 'shield-check', 'users', 'wallet']
const BRANDS = ['docker', 'facebook', 'go', 'nginx', 'nuxt', 'pinia', 'postgresql', 'redis', 'tailwindcss', 'tiktok', 'typescript', 'vite', 'vuedotjs', 'zalo', 'youtube', 'instagram']

const all = Object.values(si).filter((v) => v && typeof v === 'object' && 'slug' in v)
const lu = {}
for (const k of LUCIDE) {
  const t = readFileSync(`node_modules/lucide-static/icons/${k}.svg`, 'utf8')
  lu[k] = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(t)[1].replace(/\s+/g, ' ').trim()
}
const br = {}
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
