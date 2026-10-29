// Sau khi build: tạo trang HTML riêng cho từng đường dẫn (tiêu đề, mô tả, ảnh chia sẻ riêng) để Google, Facebook, Zalo,
// Telegram... đọc được ngay mà không cần chạy JavaScript. Tạo thêm sitemap.xml và robots.txt.
// Địa chỉ gốc lấy từ SITE_URL (mặc định trong scripts/seo.json).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const seo = JSON.parse(readFileSync(new URL('./seo.json', import.meta.url), 'utf8'))
const SITE = (process.env.SITE_URL || seo.site).replace(/\/$/, '')
const OUT = new URL('../../site/', import.meta.url).pathname
const html = readFileSync(OUT + 'index.html', 'utf8')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function set(h, re, to) {
  if (!re.test(h)) throw new Error('index.html thiếu thẻ khớp ' + re)
  return h.replace(re, to)
}

const orgLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': SITE + '/#org', name: 'Công ty TNHH Công nghệ 3RDVN', alternateName: '3RDVN Technology', url: 'https://3rdvn.io.vn', taxID: '4001342613', logo: SITE + '/icon-512.png',
      address: { '@type': 'PostalAddress', streetAddress: 'Tổ 10 Tỉnh Thủy, Phường Quảng Phú', addressLocality: 'Thành phố Đà Nẵng', addressCountry: 'VN' },
      contactPoint: { '@type': 'ContactPoint', telephone: '+84398192414', email: 'admin_support@3rdvn.io.vn', contactType: 'customer support', availableLanguage: ['vi', 'en'] } },
    { '@type': 'WebSite', '@id': SITE + '/#web', url: SITE + '/', name: seo.name, inLanguage: 'vi', publisher: { '@id': SITE + '/#org' } },
  ],
}

const urls = []
for (const [slug, p] of Object.entries(seo.pages)) {
  const url = SITE + (slug ? '/' + slug : '/')
  const img = SITE + '/og/' + (slug || 'home') + '.png'
  let h = html
  h = set(h, /<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
  h = set(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(p.desc)}">`)
  h = set(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(p.title)}">`)
  h = set(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(p.desc)}">`)
  h = set(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
  h = set(h, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${img}">\n<meta property="og:image:alt" content="${esc(p.head)}">`)
  h = set(h, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${img}">\n<meta name="twitter:title" content="${esc(p.title)}">\n<meta name="twitter:description" content="${esc(p.desc)}">`)
  h = h.replace('</head>', `<link rel="canonical" href="${url}">\n<script type="application/ld+json">${JSON.stringify(orgLd)}</script>\n</head>`)
  writeFileSync(OUT + (slug ? slug + '.html' : 'index.html'), h)
  urls.push(url)
}

const today = new Date().toISOString().slice(0, 10)
writeFileSync(OUT + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`)
writeFileSync(OUT + 'robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
console.log('prerender:', urls.length, 'trang,', 'sitemap.xml, robots.txt')
