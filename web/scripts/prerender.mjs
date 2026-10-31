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

/* nội dung mặc định (cùng nguồn với CMS) để dựng phần chữ cho máy tìm kiếm đọc được khi chưa chạy JavaScript */
const DEF = JSON.parse(readFileSync(new URL('../../server/seed/defaults.json', import.meta.url), 'utf8'))
const PRIO = { '': '1.0', 'san-pham': '0.9', baogia: '0.9', advertiser: '0.8', 'mo-hinh': '0.8', 'dang-ky': '0.8', 'cong-nghe': '0.7', 'doi-tac': '0.6', 'hoi-dap': '0.7', 'lien-he': '0.7', 'chinh-sach': '0.4' }
const plain = (md) => String(md || '').replace(/\{\{[a-z_]+\}\}/g, '').replace(/[#*_>`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()

/** Phần thân dựng sẵn: tiêu đề, mô tả, nội dung chính của trang và liên kết tới mọi trang. Vue thay toàn bộ khi chạy. */
function seedBody(slug, p) {
  let x = ''
  if (slug === 'hoi-dap') x = '<dl>' + DEF.faq.map((f) => `<dt>${esc(f.q.vi)}</dt><dd>${esc(plain(f.a.vi))}</dd>`).join('') + '</dl>'
  else if (slug === 'san-pham') x = DEF.product.projects.map((pr) => `<section><h2>${esc(pr.name.vi)}</h2><p>${esc(pr.tag.vi)}</p><p>${esc(pr.desc.vi)}</p>${(pr.points || []).length ? '<ul>' + pr.points.map((t) => `<li>${esc(t.vi)}</li>`).join('') + '</ul>' : ''}</section>`).join('')
  else if (slug === 'baogia') x = '<ul>' + DEF.quote.plans.map((pl) => `<li><b>${esc(pl.name.vi)}</b>: ${esc(pl.price.vi)} ${esc(pl.unit.vi)}. ${esc(pl.desc.vi)}</li>`).join('') + '</ul>'
  else if (slug === '') x = '<ul>' + DEF.product.projects.map((pr) => `<li><a href="/vi/san-pham">${esc(pr.name.vi)}</a>: ${esc(pr.tag.vi)}</li>`).join('') + '</ul>'
  else {
    const lg = Object.values(DEF.legal || {}).find((d) => d && d.slug === slug)
    if (lg) x = `<p>${esc(plain(lg.body?.vi || '').slice(0, 1200))}</p>`
  }
  const nav = Object.entries(seo.pages).map(([s2, q]) => `<li><a href="/vi${s2 ? '/' + s2 : ''}">${esc(q.title.replace(/ \| 3RDHub Vietnam$/, ''))}</a></li>`).join('')
  return `<main class="seedpg"><h1>${esc(p.head)}</h1><p>${esc(p.desc)}</p>${x}<nav aria-label="Các trang"><ul>${nav}</ul></nav>` +
    `<p>Công ty TNHH Công nghệ 3RDVN, mã số thuế 4001342613, Tổ 10 Tỉnh Thủy, Phường Quảng Phú, Thành phố Đà Nẵng. Hotline (+84) 398 192 414.</p></main>`
}

/** Tiêu đề và mô tả nằm trong khối SSI: nginx thay bằng bản sửa trong CMS (nếu có), không thì giữ bản dựng sẵn này. */
const ssi = (name, kind, page, inner) => `<!--# block name="${name}" -->${inner}<!--# endblock --><!--# include virtual="/api/seo/${kind}?p=${page}&l=$rh_lg" stub="${name}" -->`

const urls = []
for (const [slug, p] of Object.entries(seo.pages)) {
  const url = SITE + '/vi' + (slug ? '/' + slug : '')
  const enUrl = SITE + '/en' + (slug ? '/' + slug : '')
  const img = SITE + '/og/' + (slug || 'home') + '.png'
  const page = slug || 'home'
  let h = html
  h = set(h, /<title>[^<]*<\/title>\n?/, '')
  h = set(h, /<meta name="description" content="[^"]*">\n?/, '')
  h = set(h, /<meta property="og:title" content="[^"]*">\n?/, '')
  h = set(h, /<meta property="og:description" content="[^"]*">\n?/, '')
  h = set(h, /<meta property="og:url" content="[^"]*">\n?/, '')
  h = set(h, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${img}">\n<meta property="og:image:alt" content="${esc(p.head)}">`)
  h = set(h, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${img}">`)
  const t = esc(p.title), d = esc(p.desc)
  const head = [
    ssi('st', 't', page, `<title>${t}</title>\n<meta property="og:title" content="${t}">\n<meta name="twitter:title" content="${t}">`),
    ssi('sd', 'd', page, `<meta name="description" content="${d}">\n<meta property="og:description" content="${d}">\n<meta name="twitter:description" content="${d}">`),
    // địa chỉ chuẩn và ngôn ngữ: /en/... được máy chủ đổi sang bản tiếng Anh
    ssi('sc', 'c', page, `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:locale" content="vi_VN">\n<meta property="og:locale:alternate" content="en_US">`),
    ssi('sv', 'v', page, ''),
    ssi('sl', 'l', page, ''),
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<link rel="alternate" hreflang="vi" href="${url}">`,
    `<link rel="alternate" hreflang="en" href="${enUrl}">`,
    `<link rel="alternate" hreflang="x-default" href="${url}">`,
  ]
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE + '/' }]
  if (slug) crumbs.push({ '@type': 'ListItem', position: 2, name: p.title.replace(/ \| 3RDHub Vietnam$/, ''), item: url })
  const ld = { ...orgLd, '@graph': [...orgLd['@graph'],
    { '@type': 'WebPage', '@id': url + '#page', url, name: p.title, description: p.desc, inLanguage: 'vi', isPartOf: { '@id': SITE + '/#web' }, primaryImageOfPage: img, breadcrumb: { '@id': url + '#crumbs' } },
    { '@type': 'BreadcrumbList', '@id': url + '#crumbs', itemListElement: crumbs },
    ...(slug === 'san-pham' ? DEF.product.projects.map((pr) => ({ '@type': 'Service', name: pr.name.vi, description: pr.desc.vi, provider: { '@id': SITE + '/#org' }, areaServed: 'VN' })) : []),
  ] }
  h = h.replace('</head>', head.join('\n') + `\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`)
  h = set(h, /<div id="app">/, `<div id="app">${seedBody(slug, p)}`)
  writeFileSync(OUT + (slug ? slug + '.html' : 'index.html'), h)
  urls.push({ url, enUrl, img, alt: p.head, prio: PRIO[slug] || '0.3' })
}

const today = new Date().toISOString().slice(0, 10)
const alt = (u) => `<xhtml:link rel="alternate" hreflang="vi" href="${u.url}"/><xhtml:link rel="alternate" hreflang="en" href="${u.enUrl}"/><xhtml:link rel="alternate" hreflang="x-default" href="${u.url}"/>`
const entry = (loc, u) => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u.prio}</priority>${alt(u)}<image:image><image:loc>${u.img}</image:loc></image:image></url>`
writeFileSync(OUT + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.flatMap((u) => [entry(u.url, u), entry(u.enUrl, u)]).join('\n')}\n</urlset>\n`)
writeFileSync(OUT + 'robots.txt', `User-agent: *\nAllow: /\nAllow: /api/legal/\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`)
console.log('prerender:', urls.length, 'trang,', 'sitemap.xml, robots.txt')
