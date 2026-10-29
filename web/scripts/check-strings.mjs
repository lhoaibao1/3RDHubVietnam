// Kiểm tra chữ trên website: mọi chuỗi tiếng Việt trong template phải (1) sửa được trong CMS (admin/src/strings.json)
// và (2) có bản dịch tiếng Anh (src/lib/en.json). In ra phần còn thiếu. Chạy: npm run check:strings
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { NodeTypes, createSimpleExpression } from '@vue/compiler-dom'
import { createServer } from 'vite'

const { i18nTransform } = (await import('../build/i18nTransform.ts').catch(async () => {
  const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  const m = await s.ssrLoadModule('/build/i18nTransform.ts')
  await s.close()
  return m
}))

const files = []
;(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.vue')) files.push(p)
  }
})('src')

const used = new Set()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const { descriptor } = parse(src, { filename: f })
  if (descriptor.template) {
    const r = compileTemplate({ source: descriptor.template.content, filename: f, id: 'x', compilerOptions: { nodeTransforms: [i18nTransform], prefixIdentifiers: true } })
    for (const m of r.code.matchAll(/\$t\(("(?:[^"\\]|\\.)*")\)/g)) used.add(JSON.parse(m[1]))
  }
  for (const m of src.matchAll(/\b(?:\$t|site\.t|\bt)\(\s*'((?:[^'\\]|\\.)*)'/g)) used.add(m[1].replace(/\\'/g, "'"))
}

const en = JSON.parse(readFileSync('src/lib/en.json', 'utf8'))
const cat = new Set(JSON.parse(readFileSync('admin/src/strings.json', 'utf8')).items.map((x) => x.k))
const LETTER = /[A-Za-zÀ-ỹ]/
const keys = [...used].filter((k) => LETTER.test(k))
const noEn = keys.filter((k) => !(k in en))
const noCat = keys.filter((k) => !cat.has(k))
console.log(`Chuỗi trong template: ${keys.length}`)
console.log(`Chưa có bản dịch EN (${noEn.length}):`, noEn.slice(0, 80))
console.log(`Chưa có trong danh mục sửa chữ của CMS (${noCat.length}):`, noCat.slice(0, 80))
